using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Xml.Linq;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TechNewsCore.Models;
using TechNewsWorker.Data;
using TechNewsWorker.Options;

namespace TechNewsWorker.Services
{
    /// <summary>
    /// YouTube ingestion via public RSS/Atom feed (NO API KEY, NO QUOTA).
    /// Feed URL: https://www.youtube.com/feeds/videos.xml?channel_id=UCxxxx
    ///
    /// KEY GOAL:
    /// - YouTube/Google sometimes returns transient 404/500 HTML error pages.
    /// - We MUST NOT store the HTML in LastError (keeps API clean).
    /// - Soft-fail transient issues and keep normal schedule (don’t miss items).
    /// </summary>
    public sealed class YouTubeIngestionService : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger<YouTubeIngestionService> _logger;
        private readonly IngestionOptions _opt;
        private readonly YouTubeOptions _yt;

        // YouTube safety: always fetch ONE at a time (prevents burst traffic)
        private const int ForcedMaxParallel = 1;

        // Quick retry inside same run for transient upstream issues
        private static readonly int[] TransientRetryDelaysMs = { 750, 1500 };

        // Global pacing (rate-limit friendly)
        private static readonly SemaphoreSlim _requestGate = new(1, 1);
        private static DateTimeOffset _lastRequestUtc = DateTimeOffset.MinValue;

        public YouTubeIngestionService(
            IServiceScopeFactory scopeFactory,
            IHttpClientFactory httpClientFactory,
            IOptions<IngestionOptions> opt,
            IOptions<YouTubeOptions> yt,
            ILogger<YouTubeIngestionService> logger)
        {
            _scopeFactory = scopeFactory;
            _httpClientFactory = httpClientFactory;
            _logger = logger;
            _opt = opt.Value;
            _yt = yt.Value;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            var interval = _opt.GetYouTubeInterval();

            _logger.LogInformation(
                "YT-RSS: START @ {NowUtc:o} interval={Interval} maxPerRun={MaxPerRun} forcedMaxParallel={MaxPar}",
                DateTimeOffset.UtcNow, interval, _opt.MaxSourcesPerRun, ForcedMaxParallel);

            using var timer = new PeriodicTimer(interval);

            await RunOnce(stoppingToken);

            while (await timer.WaitForNextTickAsync(stoppingToken))
                await RunOnce(stoppingToken);
        }

        private async Task RunOnce(CancellationToken ct)
        {
            var runId = Guid.NewGuid().ToString("N")[..8];
            var nowUtc = DateTimeOffset.UtcNow;

            try
            {
                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<WorkerDbContext>();

                var safeEpochUtc = DateTimeOffset.UnixEpoch;

                var dueIds = await db.NewsSources.AsNoTracking()
                    .Where(s =>
                        s.IsActive &&
                        s.Type == NewsSourceType.YouTubeChannel &&
                        !string.IsNullOrWhiteSpace(s.YouTubeChannelId) &&
                        (s.NextFetchAt == null || s.NextFetchAt <= nowUtc))
                    .OrderBy(s => s.NextFetchAt ?? safeEpochUtc)
                    .Take(_opt.MaxSourcesPerRun)
                    .Select(s => s.Id)
                    .ToListAsync(ct);

                _logger.LogInformation("YT-RSS[{Run}]: due={Due} nowUtc={Now:o}", runId, dueIds.Count, nowUtc);
                if (dueIds.Count == 0) return;

                using var gate = new SemaphoreSlim(ForcedMaxParallel);

                var tasks = dueIds.Select(async id =>
                {
                    await gate.WaitAsync(ct);
                    try { await ProcessOne(runId, id, ct); }
                    finally { gate.Release(); }
                }).ToList();

                await Task.WhenAll(tasks);

                _logger.LogInformation("YT-RSS[{Run}]: COMPLETE due={Due}", runId, dueIds.Count);
            }
            catch (OperationCanceledException)
            {
                _logger.LogWarning("YT-RSS: cancelled");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "YT-RSS: RunOnce failed");
            }
        }

        private async Task ProcessOne(string runId, Guid sourceId, CancellationToken ct)
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<WorkerDbContext>();
            var http = _httpClientFactory.CreateClient("ingestion");

            EnsureYouTubeFriendlyHeaders(http);

            var src = await db.NewsSources.FirstAsync(x => x.Id == sourceId, ct);

            try
            {
                await IngestSource(db, http, src, ct);
                await db.SaveChangesAsync(ct);

                _logger.LogInformation(
                    "YT-RSS[{Run}]: done source={Name} next={Next:o} err={Err} lastErr={LastErr}",
                    runId, src.Name, src.NextFetchAt, src.ErrorCount, src.LastError);
            }
            catch (Exception ex)
            {
                // IMPORTANT: do not crash the run
                _logger.LogWarning(ex, "YT-RSS[{Run}]: source failed source={Name}", runId, src.Name);
            }
        }

        private async Task IngestSource(WorkerDbContext db, HttpClient http, NewsSource src, CancellationToken ct)
        {
            // If ChannelId is missing/invalid => hard failure (this is REAL misconfig)
            var channelId = (src.YouTubeChannelId ?? "").Trim();
            if (!LooksLikeYouTubeChannelId(channelId))
            {
                MarkHardFailure(src, "Invalid YouTubeChannelId (expected UCxxxxxxxxxxxxxxxxxxxxxxxx).");
                ScheduleFailShort(src);
                return;
            }

            var feedUrl = BuildYouTubeFeedUrl(channelId);

            var attempt = 0;
            while (true)
            {
                ct.ThrowIfCancellationRequested();

                await EnforceMinDelayBetweenRequests(ct);

                using var req = new HttpRequestMessage(HttpMethod.Get, feedUrl);

                // Conditional GET
                if (!string.IsNullOrWhiteSpace(src.LastEtag))
                    req.Headers.TryAddWithoutValidation("If-None-Match", src.LastEtag);

                if (!string.IsNullOrWhiteSpace(src.LastModified))
                    req.Headers.TryAddWithoutValidation("If-Modified-Since", src.LastModified);

                using var resp = await http.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, ct);

                // 304 => nothing new, but still "success"
                if (resp.StatusCode == HttpStatusCode.NotModified)
                {
                    MarkSuccess(src);
                    ScheduleOkSpread(src);
                    return;
                }

                // Failure (non-2xx)
                if (!resp.IsSuccessStatusCode)
                {
                    // Read a SMALL preview only (never store it)
                    var preview = await SafeReadSmallBody(resp, ct);

                    // Treat YouTube HTML errors as transient
                    var transient = IsTransientYouTubeFailure(resp.StatusCode, resp, preview);

                    if (transient && attempt < TransientRetryDelaysMs.Length)
                    {
                        var delay = TransientRetryDelaysMs[attempt];
                        attempt++;

                        _logger.LogWarning(
                            "YT-RSS transient HTTP {Code} for {Name}. retry {Attempt}/{Max} in {Delay}ms",
                            (int)resp.StatusCode, src.Name, attempt, TransientRetryDelaysMs.Length, delay);

                        await Task.Delay(delay, ct);
                        continue;
                    }

                    if (transient)
                    {
                        // Soft transient: keep DB clean
                        MarkSoftTransientFailure(src);
                        ScheduleOkSpread(src);
                        return;
                    }

                    // Non-transient (rare): record short message ONLY (no HTML)
                    MarkHardFailure(src, $"HTTP {(int)resp.StatusCode} {resp.ReasonPhrase}");
                    ScheduleFailShort(src);
                    return;
                }

                // Success: store caching headers
                if (resp.Headers.ETag != null)
                    src.LastEtag = resp.Headers.ETag.ToString();

                if (resp.Content.Headers.LastModified.HasValue)
                    src.LastModified = resp.Content.Headers.LastModified.Value.ToString("R");

                await using var stream = await resp.Content.ReadAsStreamAsync(ct);

                // If somehow YouTube sent HTML with 200, parsing will fail -> treat as transient in catch
                List<YouTubeFeedVideo> parsed;
                try
                {
                    parsed = await ParseYouTubeFeed(stream, ct);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "YT-RSS: parse failed (likely transient HTML) source={Name}", src.Name);
                    MarkSoftTransientFailure(src);
                    ScheduleOkSpread(src);
                    return;
                }

                var take = Math.Max(1, _opt.MaxItemsPerSource);
                var newest = parsed
                    .OrderByDescending(x => x.PublishedAtUtc)
                    .Take(take)
                    .ToList();

                if (newest.Count == 0)
                {
                    MarkSuccess(src);
                    ScheduleOkSpread(src);
                    return;
                }

                var extIds = newest.Select(x => x.VideoId).Distinct().ToList();

                var existing = await db.FeedItems.AsNoTracking()
                    .Where(x => x.SourceId == src.Id && extIds.Contains(x.ExternalId))
                    .Select(x => x.ExternalId)
                    .ToListAsync(ct);

                var existingSet = existing.Count == 0 ? new HashSet<string>() : new HashSet<string>(existing);

                var added = 0;

                foreach (var v in newest)
                {
                    if (existingSet.Contains(v.VideoId)) continue;

                    db.FeedItems.Add(new FeedItem
                    {
                        Id = Guid.NewGuid(),
                        SourceId = src.Id,
                        ExternalId = v.VideoId,
                        Kind = FeedItemKind.Video,
                        Title = Truncate(v.Title, 500),
                        Summary = Truncate(CleanText(v.Summary), 2000),
                        LinkUrl = Truncate(v.WatchUrl, 1200),
                        ImageUrl = Truncate(v.ThumbnailUrl, 1200),
                        PublishedAt = v.PublishedAtUtc.UtcDateTime,
                        ImportedAt = DateTime.UtcNow,
                        Author = Truncate(v.ChannelTitle, 200),
                        YouTubeVideoId = Truncate(v.VideoId, 50),
                        EmbedUrl = Truncate($"https://www.youtube.com/embed/{v.VideoId}", 200),
                        IsActive = true
                    });

                    added++;
                    if (added >= take) break;
                }

                MarkSuccess(src);
                src.Cursor = null;

                _logger.LogInformation("YT-RSS: finished source={Name} added={Added}", src.Name, added);

                ScheduleOkSpread(src);
                return;
            }
        }

        private static void EnsureYouTubeFriendlyHeaders(HttpClient http)
        {
            if (!http.DefaultRequestHeaders.UserAgent.Any())
                http.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (compatible; WargalNewsWorker/1.0; +https://wargalnews.com)");

            if (!http.DefaultRequestHeaders.Accept.Any())
                http.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/atom+xml"));

            if (!http.DefaultRequestHeaders.AcceptEncoding.Any())
                http.DefaultRequestHeaders.AcceptEncoding.ParseAdd("gzip, deflate, br");
        }

        private static bool LooksLikeYouTubeChannelId(string channelId)
        {
            // Typical YouTube channel id starts with UC and has length 24
            // Example: UC_x5XG1OV2P6uZZ5FSM9Ttw
            return channelId.Length == 24 && channelId.StartsWith("UC", StringComparison.Ordinal);
        }

        private static bool IsTransientYouTubeFailure(HttpStatusCode code, HttpResponseMessage resp, string? preview)
        {
            var c = (int)code;

            // typical transient codes
            if (c == 408 || c == 429 || c == 500 || c == 502 || c == 503 || c == 504)
                return true;

            // YouTube sometimes returns 404 with Google HTML error page
            if (c == 404)
                return true;

            // If content-type is HTML, consider transient (even if status is weird)
            var ct = resp.Content.Headers.ContentType?.MediaType;
            if (!string.IsNullOrWhiteSpace(ct) && ct.Contains("text/html", StringComparison.OrdinalIgnoreCase))
                return true;

            // If preview looks like HTML, transient
            if (!string.IsNullOrWhiteSpace(preview))
            {
                var p = preview.TrimStart();
                if (p.StartsWith("<!DOCTYPE html", StringComparison.OrdinalIgnoreCase) ||
                    p.StartsWith("<html", StringComparison.OrdinalIgnoreCase) ||
                    preview.Contains("Error 404", StringComparison.OrdinalIgnoreCase) ||
                    preview.Contains("Error 500", StringComparison.OrdinalIgnoreCase) ||
                    preview.Contains("www.google.com/images/errors/robot.png", StringComparison.OrdinalIgnoreCase))
                    return true;
            }

            return false;
        }

        private static string BuildYouTubeFeedUrl(string channelId)
            => $"https://www.youtube.com/feeds/videos.xml?channel_id={Uri.EscapeDataString(channelId)}";

        private async Task EnforceMinDelayBetweenRequests(CancellationToken ct)
        {
            var minMs = Math.Max(0, _yt.MinDelayBetweenRequestsMs);
            if (minMs <= 0) return;

            await _requestGate.WaitAsync(ct);
            try
            {
                var now = DateTimeOffset.UtcNow;
                var elapsedMs = (now - _lastRequestUtc).TotalMilliseconds;
                var waitMs = minMs - elapsedMs;

                if (waitMs > 0)
                    await Task.Delay(TimeSpan.FromMilliseconds(waitMs), ct);

                _lastRequestUtc = DateTimeOffset.UtcNow;
            }
            finally
            {
                _requestGate.Release();
            }
        }

        private async Task<List<YouTubeFeedVideo>> ParseYouTubeFeed(Stream xmlStream, CancellationToken ct)
        {
            XNamespace atom = "http://www.w3.org/2005/Atom";
            XNamespace yt = "http://www.youtube.com/xml/schemas/2015";
            XNamespace media = "http://search.yahoo.com/mrss/";

            var doc = await XDocument.LoadAsync(xmlStream, LoadOptions.None, ct);

            var feed = doc.Element(atom + "feed");
            if (feed == null) return new List<YouTubeFeedVideo>();

            var results = new List<YouTubeFeedVideo>();

            foreach (var entry in feed.Elements(atom + "entry"))
            {
                var videoId = entry.Element(yt + "videoId")?.Value?.Trim();
                if (string.IsNullOrWhiteSpace(videoId)) continue;

                var title = entry.Element(atom + "title")?.Value?.Trim();
                if (string.IsNullOrWhiteSpace(title)) continue;

                var link = entry.Elements(atom + "link")
                    .FirstOrDefault(l => string.Equals((string?)l.Attribute("rel"), "alternate", StringComparison.OrdinalIgnoreCase))
                    ?.Attribute("href")?.Value?.Trim();

                if (string.IsNullOrWhiteSpace(link))
                    link = $"https://www.youtube.com/watch?v={videoId}";

                var publishedRaw = entry.Element(atom + "published")?.Value?.Trim();
                var published = ParseAtomDate(publishedRaw) ?? DateTimeOffset.UtcNow;

                var authorName = entry.Element(atom + "author")?.Element(atom + "name")?.Value?.Trim();

                var summary = entry.Element(media + "group")?.Element(media + "description")?.Value?.Trim();

                var thumb = entry.Element(media + "group")
                    ?.Elements(media + "thumbnail")
                    ?.Select(t => (string?)t.Attribute("url"))
                    .FirstOrDefault(u => !string.IsNullOrWhiteSpace(u))
                    ?.Trim();

                results.Add(new YouTubeFeedVideo
                {
                    VideoId = videoId,
                    Title = title,
                    WatchUrl = link!,
                    PublishedAtUtc = published,
                    ChannelTitle = authorName,
                    Summary = summary,
                    ThumbnailUrl = thumb
                });
            }

            return results;
        }

        /// <summary>
        /// Normal scheduling, BUT spread sources so they don't all hit YouTube at the same second.
        /// We do a deterministic "phase" based on SourceId.
        /// </summary>
        private void ScheduleOkSpread(NewsSource src)
        {
            var now = DateTimeOffset.UtcNow;
            src.LastFetchedAt = now;
            src.UpdatedAt = now;

            var intervalSeconds =
                src.FetchIntervalSeconds > 0
                    ? src.FetchIntervalSeconds
                    : Math.Max(1, src.FetchIntervalMinutes) * 60;

            // Spread window up to 90s (or up to interval if interval is smaller)
            var spreadWindow = Math.Min(90, Math.Max(10, intervalSeconds));
            var phase = DeterministicPhaseSeconds(src.Id, spreadWindow);

            // Never schedule too aggressively
            var baseNext = now.AddSeconds(Math.Max(10, intervalSeconds));
            src.NextFetchAt = baseNext.AddSeconds(phase);
        }

        private static int DeterministicPhaseSeconds(Guid id, int windowSeconds)
        {
            if (windowSeconds <= 0) return 0;
            // stable deterministic hash
            var b = id.ToByteArray();
            var h = 17;
            for (var i = 0; i < b.Length; i++)
                h = (h * 31) ^ b[i];
            h = Math.Abs(h);
            return h % windowSeconds;
        }

        // Soft transient failure: keep DB/API clean
        private void MarkSoftTransientFailure(NewsSource src)
        {
            // Track some count (optional), but cap it
            src.ErrorCount = Math.Min(src.ErrorCount + 1, 10);

            // IMPORTANT: do not store HTML or scary messages
            // Keep it null so your API/UI stays clean
            src.LastError = null;
        }

        private void MarkHardFailure(NewsSource src, string err)
        {
            src.ErrorCount = Math.Min(src.ErrorCount + 1, 50);
            src.LastError = Truncate(err, 300); // short + safe
        }

        private void ScheduleFailShort(NewsSource src)
        {
            var now = DateTimeOffset.UtcNow;
            src.LastFetchedAt = now;
            src.UpdatedAt = now;

            var intervalSeconds =
                src.FetchIntervalSeconds > 0
                    ? src.FetchIntervalSeconds
                    : Math.Max(1, src.FetchIntervalMinutes) * 60;

            // Cap backoff to 5 minutes
            var backoffSeconds = Math.Min(intervalSeconds * Math.Max(2, src.ErrorCount), 60 * 5);
            src.NextFetchAt = now.AddSeconds(Math.Max(30, backoffSeconds));
        }

        private static void MarkSuccess(NewsSource src)
        {
            src.ErrorCount = 0;
            src.LastError = null;
        }

        private static DateTimeOffset? ParseAtomDate(string? s)
        {
            if (string.IsNullOrWhiteSpace(s)) return null;

            if (DateTimeOffset.TryParse(
                    s,
                    CultureInfo.InvariantCulture,
                    DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal,
                    out var dto))
            {
                return dto;
            }

            return null;
        }

        private static async Task<string?> SafeReadSmallBody(HttpResponseMessage resp, CancellationToken ct)
        {
            try
            {
                // Read small preview only
                var str = await resp.Content.ReadAsStringAsync(ct);
                if (string.IsNullOrEmpty(str)) return null;
                return str.Length <= 600 ? str : str.Substring(0, 600);
            }
            catch
            {
                return null;
            }
        }

        private static string? CleanText(string? text)
        {
            if (string.IsNullOrWhiteSpace(text)) return null;
            var trimmed = text.Trim();
            return string.IsNullOrWhiteSpace(trimmed) ? null : trimmed;
        }

        private static string? Truncate(string? s, int max)
        {
            if (string.IsNullOrEmpty(s)) return s;
            return s.Length <= max ? s : s.Substring(0, max);
        }

        private sealed class YouTubeFeedVideo
        {
            public string VideoId { get; set; } = string.Empty;
            public string Title { get; set; } = string.Empty;
            public string WatchUrl { get; set; } = string.Empty;
            public DateTimeOffset PublishedAtUtc { get; set; }
            public string? ChannelTitle { get; set; }
            public string? Summary { get; set; }
            public string? ThumbnailUrl { get; set; }
        }
    }
}