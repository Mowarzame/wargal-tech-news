using System.Globalization;
using System.Net;
using System.Text;
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
    /// Anti-block strategy:
    /// - Global request gate + min delay between requests
    /// - Content-type + body sniffing to avoid XML parse crashes on HTML/JSON responses
    /// - Cooldown only on actual throttle / transient edge errors
    /// </summary>
    public sealed class YouTubeIngestionService : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger<YouTubeIngestionService> _logger;
        private readonly IngestionOptions _opt;
        private readonly YouTubeOptions _yt;

        // Global gate to prevent parallel YouTube requests (most important for anti-block)
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
                "YT-RSS: START @ {NowUtc:o} interval={Interval} opt.MaxItemsPerSource={MaxItems} yt.MaxSourcesPerRun={MaxSources} minDelayMs={MinDelay}",
                DateTimeOffset.UtcNow, interval, _opt.MaxItemsPerSource, _yt.MaxSourcesPerRun, _yt.MinDelayBetweenRequestsMs);

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

                var maxSources = Math.Max(1, _yt.MaxSourcesPerRun);

                // Only due YT sources
                var dueIds = await db.NewsSources.AsNoTracking()
                    .Where(s =>
                        s.IsActive &&
                        s.Type == NewsSourceType.YouTubeChannel &&
                        s.YouTubeChannelId != null && s.YouTubeChannelId != "" &&
                        (s.NextFetchAt == null || s.NextFetchAt <= nowUtc))
                    .OrderBy(s => s.NextFetchAt ?? safeEpochUtc)
                    .Take(maxSources)
                    .Select(s => s.Id)
                    .ToListAsync(ct);

                _logger.LogInformation("YT-RSS[{Run}]: due={Due} picked={Picked} nowUtc={Now:o}",
                    runId, dueIds.Count, Math.Min(dueIds.Count, maxSources), nowUtc);

                if (dueIds.Count == 0) return;

                // IMPORTANT: Even if ingestion "interval" is small, the global gate prevents storms.
                // We still process dueIds sequentially to be extra friendly.
                foreach (var id in dueIds)
                {
                    ct.ThrowIfCancellationRequested();
                    await ProcessOne(runId, id, ct);
                }

                _logger.LogInformation("YT-RSS[{Run}]: COMPLETE processed={Count}", runId, dueIds.Count);
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
            var http = _httpClientFactory.CreateClient("youtube");

            var src = await db.NewsSources.FirstAsync(x => x.Id == sourceId, ct);

            // sanitize dirty DB values (handles trailing \n, spaces)
            src.YouTubeChannelId = Sanitize(src.YouTubeChannelId);
            src.RssUrl = Sanitize(src.RssUrl);
            src.LastEtag = Sanitize(src.LastEtag);
            src.LastModified = Sanitize(src.LastModified);

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
                // If something unexpected escapes, mark fail & schedule soon.
                TouchScheduleFail(src, $"Unhandled: {ex.Message}", isThrottle: false);
                await db.SaveChangesAsync(ct);

                _logger.LogWarning(ex, "YT-RSS[{Run}]: source failed source={Name}", runId, src.Name);
            }
        }

        private async Task IngestSource(WorkerDbContext db, HttpClient http, NewsSource src, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(src.YouTubeChannelId))
            {
                TouchScheduleOk(src);
                src.ErrorCount = 0;
                src.LastError = null;
                return;
            }

            var channelId = Sanitize(src.YouTubeChannelId)!;
            var feedUrl = BuildYouTubeFeedUrl(channelId);

            // Global pacing to avoid YouTube blocks
            await EnforceMinDelayBetweenRequests(ct);

            using var req = new HttpRequestMessage(HttpMethod.Get, feedUrl);

            // Conditional GET
            if (!string.IsNullOrWhiteSpace(src.LastEtag))
                req.Headers.TryAddWithoutValidation("If-None-Match", src.LastEtag);

            if (!string.IsNullOrWhiteSpace(src.LastModified))
                req.Headers.TryAddWithoutValidation("If-Modified-Since", src.LastModified);

            using var resp = await http.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, ct);

            // 304: nothing new
            if (resp.StatusCode == HttpStatusCode.NotModified)
            {
                TouchScheduleOk(src);
                src.ErrorCount = 0;
                src.LastError = null;
                return;
            }

            // Throttle / edge transient -> cooldown (short, not 30 mins)
            if ((int)resp.StatusCode == 429 ||
                resp.StatusCode == HttpStatusCode.ServiceUnavailable ||
                resp.StatusCode == HttpStatusCode.BadGateway)
            {
                var body = await SafeReadBody(resp, ct);
                TouchScheduleFail(src, $"YT-RSS throttled HTTP {(int)resp.StatusCode}: {Truncate(body, 250)}", isThrottle: true);
                return;
            }

            if (!resp.IsSuccessStatusCode)
            {
                var body = await SafeReadBody(resp, ct);
                TouchScheduleFail(src, $"HTTP {(int)resp.StatusCode} {resp.ReasonPhrase}: {Truncate(body, 300)}", isThrottle: false);
                return;
            }

            // Save caching headers
            if (resp.Headers.ETag != null)
                src.LastEtag = Sanitize(resp.Headers.ETag.ToString());

            if (resp.Content.Headers.LastModified.HasValue)
                src.LastModified = resp.Content.Headers.LastModified.Value.ToString("R");

            // Guard: YouTube sometimes returns HTML “bot check” pages or other non-XML.
            var mediaType = resp.Content.Headers.ContentType?.MediaType?.ToLowerInvariant();
            if (mediaType != null && !mediaType.Contains("xml") && !mediaType.Contains("atom"))
            {
                var body = await SafeReadBody(resp, ct);
                TouchScheduleFail(src, $"Non-XML response ({mediaType}). Likely edge throttle.", isThrottle: true);
                return;
            }

            await using var stream = await resp.Content.ReadAsStreamAsync(ct);

            // Parse Atom feed
            var parsed = await ParseYouTubeFeed(stream, ct);

            // Keep newest items
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

            TouchScheduleOk(src);
            src.ErrorCount = 0;
            src.LastError = null;
            src.Cursor = null;

            _logger.LogInformation("YT-RSS: finished source={Name} added={Added} url={Url}", src.Name, added, feedUrl);
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

        private void TouchScheduleOk(NewsSource src)
        {
            var now = DateTimeOffset.UtcNow;
            src.LastFetchedAt = now;
            src.UpdatedAt = now;

            var intervalSeconds =
                src.FetchIntervalSeconds > 0
                    ? src.FetchIntervalSeconds
                    : Math.Max(1, src.FetchIntervalMinutes) * 60;

            // jitter avoids herding
            var jitterMax = Math.Max(0, _yt.ScheduleJitterMaxSeconds);
            intervalSeconds += (jitterMax == 0) ? 0 : Random.Shared.Next(0, jitterMax + 1);

            src.NextFetchAt = now.AddSeconds(Math.Max(10, intervalSeconds));
        }

        private void TouchScheduleFail(NewsSource src, string err, bool isThrottle)
        {
            var now = DateTimeOffset.UtcNow;
            src.LastFetchedAt = now;
            src.UpdatedAt = now;

            // Only increment ErrorCount for real failures
            src.ErrorCount = Math.Min(src.ErrorCount + 1, 50);
            src.LastError = Truncate(err, 800);

            if (isThrottle)
            {
                // short cooldown (avoid ban), not huge
                var mins = Math.Max(2, _yt.ThrottleBackoffMinutes);
                mins = Math.Min(mins, Math.Max(2, _yt.MaxBackoffMinutes));
                src.NextFetchAt = now.AddMinutes(mins);
                return;
            }

            // Non-throttle failures: small exponential backoff but clamped
            var baseSeconds =
                src.FetchIntervalSeconds > 0
                    ? src.FetchIntervalSeconds
                    : Math.Max(1, src.FetchIntervalMinutes) * 60;

            var factor = Math.Min(8, Math.Max(2, src.ErrorCount)); // 2..8
            var backoffSeconds = Math.Min(baseSeconds * factor, _yt.MaxBackoffMinutes * 60);

            src.NextFetchAt = now.AddSeconds(Math.Max(20, backoffSeconds));
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
            try
            {
                var bytes = await resp.Content.ReadAsByteArrayAsync(ct);
                if (bytes.Length == 0) return string.Empty;

                // keep it small
                var take = Math.Min(bytes.Length, 2000);
                return Encoding.UTF8.GetString(bytes, 0, take);
            }
            catch
            {
                return string.Empty;
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

        private static string? Sanitize(string? s)
        {
            if (string.IsNullOrWhiteSpace(s)) return s;
            return s.Replace("\r", "").Replace("\n", "").Trim();
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