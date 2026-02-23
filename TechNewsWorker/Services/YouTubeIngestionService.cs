using System.Globalization;
using System.Net;
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
    /// Uses ETag/Last-Modified for conditional GET to reduce bandwidth + avoid rate limits.
    /// </summary>
    public sealed class YouTubeIngestionService : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger<YouTubeIngestionService> _logger;
        private readonly IngestionOptions _opt;
        private readonly YouTubeOptions _yt;

        // Safety: limit one fetch per source per run (we only need latest list)
        private const int MaxFetchesPerSourcePerRun = 1;

        // Safety: small jitter so sources don’t all fire at the same second
        private const int ScheduleJitterMaxSeconds = 10;

        // Used for gentle spacing between requests (rate-limit friendly)
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
                "YT-RSS: START @ {NowUtc:o} interval={Interval} maxPerRun={MaxPerRun} maxParallel={MaxPar}",
                DateTimeOffset.UtcNow, interval, _opt.MaxSourcesPerRun, Math.Max(1, _opt.MaxParallelFetches));

            using var timer = new PeriodicTimer(interval);

            await RunOnce(stoppingToken);

            while (await timer.WaitForNextTickAsync(stoppingToken))
            {
                await RunOnce(stoppingToken);
            }
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

                // Only YouTube sources that are due
                var dueIds = await db.NewsSources.AsNoTracking()
                    .Where(s =>
                        s.IsActive &&
                        s.Type == NewsSourceType.YouTubeChannel &&
                        s.YouTubeChannelId != null && s.YouTubeChannelId != "" &&
                        (s.NextFetchAt == null || s.NextFetchAt <= nowUtc))
                    .OrderBy(s => s.NextFetchAt ?? safeEpochUtc)
                    .Take(_opt.MaxSourcesPerRun)
                    .Select(s => s.Id)
                    .ToListAsync(ct);

                _logger.LogInformation("YT-RSS[{Run}]: due={Due} nowUtc={Now:o}", runId, dueIds.Count, nowUtc);
                if (dueIds.Count == 0) return;

                // Keep parallelism modest to avoid YouTube throttling
                var maxParallel = Math.Max(1, _opt.MaxParallelFetches);
                using var gate = new SemaphoreSlim(maxParallel);

                var tasks = dueIds.Select(async id =>
                {
                    await gate.WaitAsync(ct);
                    try { await ProcessOne(runId, id, ct); }
                    finally { gate.Release(); }
                }).ToList();

                await Task.WhenAll(tasks);

                _logger.LogInformation("YT-RSS[{Run}]: COMPLETE due={Due} maxParallel={MaxPar}", runId, dueIds.Count, maxParallel);
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

            var src = await db.NewsSources.FirstAsync(x => x.Id == sourceId, ct);

            try
            {
                await IngestSource(db, http, src, ct);
                await db.SaveChangesAsync(ct);

                var gapSec = (src.NextFetchAt!.Value - src.LastFetchedAt!.Value).TotalSeconds;
                _logger.LogInformation("YT-RSS[{Run}]: done source={Name} gapSec={Gap} next={Next:o} err={Err} lastErr={LastErr}",
                    runId, src.Name, gapSec, src.NextFetchAt, src.ErrorCount, src.LastError);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "YT-RSS[{Run}]: source failed source={Name}", runId, src.Name);
            }
        }

        private async Task IngestSource(WorkerDbContext db, HttpClient http, NewsSource src, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(src.YouTubeChannelId))
            {
                TouchScheduleOk(src);
                return;
            }

            // Build channel feed url
            var feedUrl = BuildYouTubeFeedUrl(src.YouTubeChannelId!.Trim());

            // Only one fetch per run per source
            for (var fetch = 0; fetch < MaxFetchesPerSourcePerRun; fetch++)
            {
                ct.ThrowIfCancellationRequested();

                // Gentle request pacing (global, per worker instance)
                await EnforceMinDelayBetweenRequests(ct);

                using var req = new HttpRequestMessage(HttpMethod.Get, feedUrl);

                // Conditional GET (reusing your DB fields)
                if (!string.IsNullOrWhiteSpace(src.LastEtag))
                    req.Headers.TryAddWithoutValidation("If-None-Match", src.LastEtag);

                if (!string.IsNullOrWhiteSpace(src.LastModified))
                    req.Headers.TryAddWithoutValidation("If-Modified-Since", src.LastModified);

                using var resp = await http.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, ct);

                // 304 => nothing new
                if (resp.StatusCode == HttpStatusCode.NotModified)
                {
                    TouchScheduleOk(src);
                    src.ErrorCount = 0;
                    src.LastError = null;
                    return;
                }

                // Handle throttling / transient errors with backoff (no quota issues here)
                if ((int)resp.StatusCode == 429 || resp.StatusCode == HttpStatusCode.ServiceUnavailable || resp.StatusCode == HttpStatusCode.BadGateway)
                {
                    var body = await SafeReadBody(resp, ct);
                    TouchScheduleBackoff(src, $"YT-RSS throttled HTTP {(int)resp.StatusCode}: {Truncate(body, 300)}");
                    return;
                }

                if (!resp.IsSuccessStatusCode)
                {
                    var body = await SafeReadBody(resp, ct);
                    TouchScheduleFail(src, $"HTTP {(int)resp.StatusCode} {resp.ReasonPhrase}: {Truncate(body, 500)}");
                    return;
                }

                // Save caching headers
                if (resp.Headers.ETag != null)
                    src.LastEtag = resp.Headers.ETag.ToString();

                if (resp.Content.Headers.LastModified.HasValue)
                    src.LastModified = resp.Content.Headers.LastModified.Value.ToString("R");

                await using var stream = await resp.Content.ReadAsStreamAsync(ct);

                var parsed = await ParseYouTubeFeed(stream, ct);

                // Keep only newest items (DB insertion dedup is still applied)
                var take = Math.Max(1, _opt.MaxItemsPerSource);
                var newest = parsed
                    .OrderByDescending(x => x.PublishedAtUtc)
                    .Take(take)
                    .ToList();

                if (newest.Count == 0)
                {
                    TouchScheduleOk(src);
                    src.ErrorCount = 0;
                    src.LastError = null;
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
                        ExternalId = v.VideoId, // ✅ stable, perfect dedupe key
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

                    // Micro-optimization: if we already added enough, stop
                    if (added >= take) break;
                }

                TouchScheduleOk(src);
                src.ErrorCount = 0;
                src.LastError = null;
                src.Cursor = null;

                _logger.LogInformation("YT-RSS: finished source={Name} added={Added} url={Url}", src.Name, added, feedUrl);
            }
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
            // Atom namespaces
            XNamespace atom = "http://www.w3.org/2005/Atom";
            XNamespace yt = "http://www.youtube.com/xml/schemas/2015";
            XNamespace media = "http://search.yahoo.com/mrss/";

            // Load XML
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

                // link rel="alternate" href="..."
                var link = entry.Elements(atom + "link")
                    .FirstOrDefault(l => string.Equals((string?)l.Attribute("rel"), "alternate", StringComparison.OrdinalIgnoreCase))
                    ?.Attribute("href")?.Value?.Trim();

                if (string.IsNullOrWhiteSpace(link))
                    link = $"https://www.youtube.com/watch?v={videoId}";

                var publishedRaw = entry.Element(atom + "published")?.Value?.Trim();
                var published = ParseAtomDate(publishedRaw) ?? DateTimeOffset.UtcNow;

                var authorName = entry.Element(atom + "author")?.Element(atom + "name")?.Value?.Trim();

                // Try media:group/media:description
                var summary = entry.Element(media + "group")?.Element(media + "description")?.Value?.Trim();

                // Try media:group/media:thumbnail@url
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

        private void TouchScheduleOk(NewsSource src)
        {
            var now = DateTimeOffset.UtcNow;
            src.LastFetchedAt = now;
            src.UpdatedAt = now;

            var intervalSeconds =
                src.FetchIntervalSeconds > 0
                    ? src.FetchIntervalSeconds
                    : Math.Max(1, src.FetchIntervalMinutes) * 60;

            // small jitter to avoid herding
            intervalSeconds += Random.Shared.Next(0, ScheduleJitterMaxSeconds + 1);

            src.NextFetchAt = now.AddSeconds(Math.Max(5, intervalSeconds));
        }

        private void TouchScheduleFail(NewsSource src, string err)
        {
            var now = DateTimeOffset.UtcNow;
            src.LastFetchedAt = now;
            src.UpdatedAt = now;

            src.ErrorCount += 1;
            src.LastError = Truncate(err, 800);

            var intervalSeconds =
                src.FetchIntervalSeconds > 0
                    ? src.FetchIntervalSeconds
                    : Math.Max(1, src.FetchIntervalMinutes) * 60;

            // Backoff: up to 30 minutes
            var backoffSeconds = Math.Min(intervalSeconds * Math.Max(2, src.ErrorCount), 60 * 30);
            src.NextFetchAt = now.AddSeconds(Math.Max(10, backoffSeconds));
        }

        private void TouchScheduleBackoff(NewsSource src, string err)
        {
            var now = DateTimeOffset.UtcNow;
            src.LastFetchedAt = now;
            src.UpdatedAt = now;

            // Treat throttling as soft failure (no snowball)
            src.LastError = Truncate(err, 800);

            // Respect configured backoff minutes (default 10)
            var mins = Math.Max(5, _yt.ThrottleBackoffMinutes);
            src.NextFetchAt = now.AddMinutes(mins);
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

        private static async Task<string> SafeReadBody(HttpResponseMessage resp, CancellationToken ct)
        {
            try { return await resp.Content.ReadAsStringAsync(ct); }
            catch { return string.Empty; }
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