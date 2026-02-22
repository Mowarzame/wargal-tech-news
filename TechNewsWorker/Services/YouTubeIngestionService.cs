using System.Globalization;
using System.Net;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TechNewsCore.Models;
using TechNewsWorker.Data;
using TechNewsWorker.Options;

namespace TechNewsWorker.Services
{
    public sealed class YouTubeIngestionService : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger<YouTubeIngestionService> _logger;
        private readonly IngestionOptions _opt;
        private readonly YouTubeOptions _yt;

        // ✅ QUOTA SAFE: only 1 page per run per source
        private const int MaxPageFetchesPerSource = 1;
        private const int MaxYouTubeMaxResults = 50;

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
                "YT: START @ {NowUtc:o} interval={Interval} maxPerRun={MaxPerRun} maxParallel={MaxPar}",
                DateTimeOffset.UtcNow, interval, _opt.MaxSourcesPerRun, Math.Max(1, _opt.MaxParallelFetches));

            if (string.IsNullOrWhiteSpace(_yt.ApiKey))
            {
                _logger.LogError("YT: API key missing (YouTube:ApiKey).");
                return;
            }

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

                _logger.LogInformation("YT[{Run}]: due={Due} nowUtc={Now:o}", runId, dueIds.Count, nowUtc);

                if (dueIds.Count == 0) return;

                var maxParallel = Math.Max(1, _opt.MaxParallelFetches);
                using var gate = new SemaphoreSlim(maxParallel);

                var tasks = dueIds.Select(async id =>
                {
                    await gate.WaitAsync(ct);
                    try { await ProcessOne(runId, id, ct); }
                    finally { gate.Release(); }
                }).ToList();

                await Task.WhenAll(tasks);

                _logger.LogInformation("YT[{Run}]: COMPLETE due={Due} maxParallel={MaxPar}", runId, dueIds.Count, maxParallel);
            }
            catch (OperationCanceledException)
            {
                _logger.LogWarning("YT: cancelled");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "YT: RunOnce failed");
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
                _logger.LogInformation("YT[{Run}]: done source={Name} gapSec={Gap} next={Next:o} err={Err} lastErr={LastErr}",
                    runId, src.Name, gapSec, src.NextFetchAt, src.ErrorCount, src.LastError);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "YT[{Run}]: source failed source={Name}", runId, src.Name);
            }
        }

        private async Task IngestSource(WorkerDbContext db, HttpClient http, NewsSource src, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(src.YouTubeChannelId))
            {
                TouchScheduleOk(src);
                return;
            }

            // Resolve uploads playlist id if missing
            if (string.IsNullOrWhiteSpace(src.YouTubeUploadsPlaylistId))
            {
                var uploads = await ResolveUploadsPlaylistId(http, src.YouTubeChannelId!, ct);
                if (string.IsNullOrWhiteSpace(uploads))
                {
                    TouchScheduleFail(src, "Unable to resolve uploads playlist id.");
                    return;
                }

                src.YouTubeUploadsPlaylistId = uploads.Trim();
                src.UpdatedAt = DateTimeOffset.UtcNow;
            }

            var maxResults = Math.Min(Math.Max(1, _yt.MaxResults), MaxYouTubeMaxResults);

            string? pageToken = null;
            var pagesFetched = 0;
            var totalAdded = 0;

            while (pagesFetched < MaxPageFetchesPerSource)
            {
                ct.ThrowIfCancellationRequested();

                var url =
                    "https://www.googleapis.com/youtube/v3/playlistItems" +
                    "?part=snippet,contentDetails" +
                    $"&playlistId={Uri.EscapeDataString(src.YouTubeUploadsPlaylistId!)}" +
                    $"&maxResults={maxResults}" +
                    $"&key={Uri.EscapeDataString(_yt.ApiKey)}";

                if (!string.IsNullOrWhiteSpace(pageToken))
                    url += $"&pageToken={Uri.EscapeDataString(pageToken)}";

                using var resp = await http.GetAsync(url, ct);

                // ✅ Special handling: quota exceeded => cooldown (don’t snowball ErrorCount)
                if (resp.StatusCode == HttpStatusCode.Forbidden)
                {
                    var body = await resp.Content.ReadAsStringAsync(ct);
                    if (body.Contains("quotaExceeded", StringComparison.OrdinalIgnoreCase))
                    {
                        TouchQuotaCooldown(src, "YouTube quota exceeded.");
                        _logger.LogWarning("YT: quotaExceeded source={Name} cooldownMin={Min}", src.Name, _yt.QuotaCooldownMinutes);
                        return;
                    }
                }

                if (!resp.IsSuccessStatusCode)
                {
                    var body = await resp.Content.ReadAsStringAsync(ct);
                    TouchScheduleFail(src, $"HTTP {(int)resp.StatusCode} {resp.ReasonPhrase}: {Truncate(body, 500)}");
                    return;
                }

                await using var stream = await resp.Content.ReadAsStreamAsync(ct);
                using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);

                var root = doc.RootElement;

                if (!root.TryGetProperty("items", out var itemsEl) || itemsEl.ValueKind != JsonValueKind.Array)
                    break;

                pagesFetched++;

                var candidates = new List<(string VideoId, string ExternalId, string Title, JsonElement Snippet)>();

                foreach (var it in itemsEl.EnumerateArray())
                {
                    if (!it.TryGetProperty("contentDetails", out var cd) || cd.ValueKind != JsonValueKind.Object)
                        continue;

                    var videoId = cd.TryGetProperty("videoId", out var vidEl) && vidEl.ValueKind == JsonValueKind.String
                        ? vidEl.GetString()
                        : null;

                    if (string.IsNullOrWhiteSpace(videoId))
                        continue;

                    if (!it.TryGetProperty("snippet", out var snippet) || snippet.ValueKind != JsonValueKind.Object)
                        continue;

                    var title = snippet.TryGetProperty("title", out var titleEl) ? titleEl.GetString()?.Trim() : null;
                    if (string.IsNullOrWhiteSpace(title))
                        continue;

                    if (string.Equals(title, "Private video", StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(title, "Deleted video", StringComparison.OrdinalIgnoreCase))
                        continue;

                    candidates.Add((videoId!, videoId!, title!, snippet));
                }

                if (candidates.Count == 0)
                    break;

                // batch-check existing ExternalIds
                var extIds = candidates.Select(c => c.ExternalId).Distinct().ToList();

                var existing = await db.FeedItems.AsNoTracking()
                    .Where(x => x.SourceId == src.Id && extIds.Contains(x.ExternalId))
                    .Select(x => x.ExternalId)
                    .ToListAsync(ct);

                var existingSet = existing.Count == 0 ? new HashSet<string>() : new HashSet<string>(existing);

                foreach (var c in candidates)
                {
                    if (existingSet.Contains(c.ExternalId)) continue;

                    var snippet = c.Snippet;

                    var desc = snippet.TryGetProperty("description", out var descEl) ? descEl.GetString() : null;
                    var publishedAtRaw = snippet.TryGetProperty("publishedAt", out var pubEl) ? pubEl.GetString() : null;
                    var channelTitle = snippet.TryGetProperty("channelTitle", out var ctEl) ? ctEl.GetString() : null;

                    var published = ParseYouTubeDate(publishedAtRaw) ?? DateTime.UtcNow;
                    var thumbsUrl = TryGetBestThumbnailUrl(snippet);

                    db.FeedItems.Add(new FeedItem
                    {
                        Id = Guid.NewGuid(),
                        SourceId = src.Id,
                        ExternalId = c.ExternalId,
                        Kind = FeedItemKind.Video,
                        Title = Truncate(c.Title, 500),
                        Summary = Truncate(CleanText(desc), 2000),
                        LinkUrl = Truncate($"https://www.youtube.com/watch?v={c.VideoId}", 1200),
                        ImageUrl = Truncate(thumbsUrl, 1200),
                        PublishedAt = published,
                        ImportedAt = DateTime.UtcNow,
                        Author = Truncate(channelTitle, 200),
                        YouTubeVideoId = Truncate(c.VideoId, 50),
                        EmbedUrl = Truncate($"https://www.youtube.com/embed/{c.VideoId}", 200),
                        IsActive = true,
                    });

                    totalAdded++;
                }

                // we only do one page; stop
                pageToken = null;
            }

            TouchScheduleOk(src);
            src.ErrorCount = 0;
            src.LastError = null;
            src.Cursor = null;

            _logger.LogInformation("YT: finished source={Name} added={Added}", src.Name, totalAdded);
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

            src.NextFetchAt = now.AddSeconds(intervalSeconds);
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

            // modest backoff
            var backoffSeconds = Math.Min(intervalSeconds * Math.Max(2, src.ErrorCount), 60 * 30); // max 30 min
            src.NextFetchAt = now.AddSeconds(backoffSeconds);
        }

        private void TouchQuotaCooldown(NewsSource src, string err)
        {
            var now = DateTimeOffset.UtcNow;
            src.LastFetchedAt = now;
            src.UpdatedAt = now;

            // don't snowball error count on quota
            src.LastError = err;

            src.NextFetchAt = now.AddMinutes(Math.Max(10, _yt.QuotaCooldownMinutes));
        }

        private static DateTime? ParseYouTubeDate(string? s)
        {
            if (string.IsNullOrWhiteSpace(s)) return null;

            if (DateTimeOffset.TryParse(
                    s,
                    CultureInfo.InvariantCulture,
                    DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal,
                    out var dto))
            {
                return dto.UtcDateTime;
            }

            return null;
        }

        private static string? TryGetBestThumbnailUrl(JsonElement snippet)
        {
            if (!snippet.TryGetProperty("thumbnails", out var thumbs) || thumbs.ValueKind != JsonValueKind.Object)
                return null;

            static string? Get(JsonElement thumbsObj, string name)
            {
                if (!thumbsObj.TryGetProperty(name, out var t) || t.ValueKind != JsonValueKind.Object)
                    return null;

                if (!t.TryGetProperty("url", out var u) || u.ValueKind != JsonValueKind.String)
                    return null;

                var url = u.GetString();
                return string.IsNullOrWhiteSpace(url) ? null : url.Trim();
            }

            return Get(thumbs, "high") ?? Get(thumbs, "medium") ?? Get(thumbs, "default");
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

        private async Task<string?> ResolveUploadsPlaylistId(HttpClient http, string channelId, CancellationToken ct)
        {
            var url =
                "https://www.googleapis.com/youtube/v3/channels" +
                "?part=contentDetails" +
                $"&id={Uri.EscapeDataString(channelId)}" +
                $"&key={Uri.EscapeDataString(_yt.ApiKey)}";

            using var resp = await http.GetAsync(url, ct);

            if (!resp.IsSuccessStatusCode)
            {
                var body = await resp.Content.ReadAsStringAsync(ct);
                throw new Exception($"YouTube channels.list failed HTTP {(int)resp.StatusCode} {resp.ReasonPhrase} :: {body}");
            }

            await using var stream = await resp.Content.ReadAsStreamAsync(ct);
            using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);

            var root = doc.RootElement;

            if (!root.TryGetProperty("items", out var items) || items.ValueKind != JsonValueKind.Array)
                return null;

            var first = items.EnumerateArray().FirstOrDefault();
            if (first.ValueKind == JsonValueKind.Undefined)
                return null;

            var uploads = first
                .GetProperty("contentDetails")
                .GetProperty("relatedPlaylists")
                .GetProperty("uploads")
                .GetString();

            return string.IsNullOrWhiteSpace(uploads) ? null : uploads.Trim();
        }
    }
}