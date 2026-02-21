using System.Globalization;
using System.Net;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TechNewsCore.Models;
using TechNewsWorker.Data;
using TechNewsWorker.Options;

namespace TechNewsWorker.Services;

public sealed class YouTubeIngestionService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<YouTubeIngestionService> _logger;
    private readonly IngestionOptions _opt;
    private readonly YouTubeOptions _yt;

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
        var tick = _opt.GetYouTubeTickInterval();

        _logger.LogInformation("YT: ExecuteAsync STARTED @ {NowUtc:o} tick={Tick}", DateTimeOffset.UtcNow, tick);

        if (string.IsNullOrWhiteSpace(_yt.ApiKey))
        {
            _logger.LogError("YT: API key missing (YouTube:ApiKey).");
            return;
        }

        // First run immediately
        _logger.LogInformation("YT: RunOnce BEGIN @ {NowUtc:o}", DateTimeOffset.UtcNow);
        await RunOnce(stoppingToken);
        _logger.LogInformation("YT: RunOnce END   @ {NowUtc:o}", DateTimeOffset.UtcNow);

        var timer = new PeriodicTimer(tick);

        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            _logger.LogInformation("YT: TIMER TICK @ {NowUtc:o}", DateTimeOffset.UtcNow);

            _logger.LogInformation("YT: RunOnce BEGIN @ {NowUtc:o}", DateTimeOffset.UtcNow);
            await RunOnce(stoppingToken);
            _logger.LogInformation("YT: RunOnce END   @ {NowUtc:o}", DateTimeOffset.UtcNow);
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
            var http = _httpClientFactory.CreateClient("ingestion");

            _logger.LogInformation("YT[{Run}]: tick nowUtc={Now:o}", runId, nowUtc);

            var activeCount = await db.NewsSources.AsNoTracking()
                .CountAsync(s => s.IsActive &&
                                 s.Type == NewsSourceType.YouTubeChannel &&
                                 s.YouTubeChannelId != null, ct);

            var safeEpochUtc = DateTimeOffset.UnixEpoch;

            // Pull due sources (NextFetchAt <= now)
            var due = await db.NewsSources
                .AsNoTracking()
                .Where(s => s.IsActive
                            && s.Type == NewsSourceType.YouTubeChannel
                            && s.YouTubeChannelId != null
                            && (s.NextFetchAt == null || s.NextFetchAt <= nowUtc))
                .OrderBy(s => s.NextFetchAt ?? safeEpochUtc)
                .Take(Math.Max(1, _opt.MaxSourcesPerRun))
                .Select(s => new { s.Id, s.Name, s.NextFetchAt })
                .ToListAsync(ct);

            _logger.LogInformation(
                "YT[{Run}]: active={Active} due={Due} maxPerRun={Max}",
                runId, activeCount, due.Count, _opt.MaxSourcesPerRun);

            if (due.Count == 0)
                return;

            foreach (var s in due)
            {
                ct.ThrowIfCancellationRequested();

                // Track entities for updates
                var src = await db.NewsSources.FirstAsync(x => x.Id == s.Id, ct);

                _logger.LogInformation(
                    "YT[{Run}]: start source={Name} id={Id} nextFetchAt={Next:o} channel={Channel} uploads={Uploads}",
                    runId, src.Name, src.Id, src.NextFetchAt, src.YouTubeChannelId, src.YouTubeUploadsPlaylistId);

                await IngestSource(db, http, src, ct);
                await db.SaveChangesAsync(ct);

                var gapSec = (src.NextFetchAt!.Value - src.LastFetchedAt!.Value).TotalSeconds;

                _logger.LogInformation(
                    "YT[{Run}]: done  source={Name} lastFetchedAt={Last:o} nextFetchAt={Next:o} gapSec={Gap} err={Err} lastErr={LastErr}",
                    runId, src.Name, src.LastFetchedAt, src.NextFetchAt, gapSec, src.ErrorCount, src.LastError);
            }
        }
        catch (OperationCanceledException)
        {
            _logger.LogWarning("YT[{Run}]: cancelled.", runId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "YT[{Run}]: run failed.", runId);
        }
    }

    private async Task IngestSource(WorkerDbContext db, HttpClient http, NewsSource src, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(src.YouTubeChannelId))
        {
            TouchSchedule(src, ok: true);
            _logger.LogWarning("YT: skipped missing channelId source={Name}", src.Name);
            return;
        }

        try
        {
            // If uploads playlist is missing OR looks wrong (some people accidentally saved channelId as uploads)
            // uploads playlist must start with "UU"
            if (string.IsNullOrWhiteSpace(src.YouTubeUploadsPlaylistId) ||
                src.YouTubeUploadsPlaylistId.StartsWith("UC", StringComparison.OrdinalIgnoreCase))
            {
                var uploads = await ResolveUploadsPlaylistId(http, src.YouTubeChannelId!, ct);

                if (string.IsNullOrWhiteSpace(uploads))
                {
                    TouchSchedule(src, ok: false);
                    src.ErrorCount += 1;
                    src.LastError = "Unable to resolve uploads playlist id.";
                    _logger.LogWarning("YT: cannot resolve uploads playlist source={Name} channel={Channel}",
                        src.Name, src.YouTubeChannelId);
                    return;
                }

                src.YouTubeUploadsPlaylistId = uploads.Trim();
                src.UpdatedAt = DateTimeOffset.UtcNow;

                _logger.LogInformation("YT: resolved uploads playlist source={Name} uploads={Uploads}",
                    src.Name, src.YouTubeUploadsPlaylistId);
            }

            var maxResults = Math.Min(Math.Max(1, _opt.MaxItemsPerSource), MaxYouTubeMaxResults);
            var maxPages = Math.Clamp(_opt.MaxYouTubePagesPerSource, 1, 10);
            var knownStop = Math.Clamp(_opt.KnownStopThreshold, 5, 100);

            string? pageToken = null;
            var pagesFetched = 0;
            var totalCandidates = 0;
            var totalAdded = 0;

            while (pagesFetched < maxPages)
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

                if (!resp.IsSuccessStatusCode)
                {
                    var body = await resp.Content.ReadAsStringAsync(ct);

                    TouchSchedule(src, ok: false);
                    src.ErrorCount += 1;
                    src.LastError = Truncate($"HTTP {(int)resp.StatusCode} {resp.ReasonPhrase}: {body}", 800);

                    _logger.LogWarning("YT: API failed source={Name} status={Status} body={Body}",
                        src.Name, (int)resp.StatusCode, body);

                    return;
                }

                await using var stream = await resp.Content.ReadAsStreamAsync(ct);
                using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);

                var root = doc.RootElement;

                if (!root.TryGetProperty("items", out var itemsEl) || itemsEl.ValueKind != JsonValueKind.Array)
                {
                    TouchSchedule(src, ok: true);
                    src.ErrorCount = 0;
                    src.LastError = null;
                    src.Cursor = null;
                    _logger.LogInformation("YT: no items array source={Name}", src.Name);
                    return;
                }

                var itemsCount = itemsEl.GetArrayLength();
                pagesFetched++;

                _logger.LogInformation(
                    "YT: page={Page} itemsReturned={Count} source={Name} token={Token}",
                    pagesFetched, itemsCount, src.Name, pageToken ?? "(first)");

                if (itemsCount == 0)
                    break;

                // Build candidates
                var candidates = new List<(string VideoId, string ExternalId, string Title, JsonElement Snippet)>(itemsCount);

                foreach (var it in itemsEl.EnumerateArray())
                {
                    ct.ThrowIfCancellationRequested();

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
                {
                    pageToken = root.TryGetProperty("nextPageToken", out var next0) && next0.ValueKind == JsonValueKind.String
                        ? next0.GetString()
                        : null;

                    if (string.IsNullOrWhiteSpace(pageToken))
                        break;

                    continue;
                }

                totalCandidates += candidates.Count;

                // Batch check existing IDs
                var extIds = candidates.Select(c => c.ExternalId).Distinct().ToList();

                var existing = await db.FeedItems.AsNoTracking()
                    .Where(x => x.SourceId == src.Id && extIds.Contains(x.ExternalId))
                    .Select(x => x.ExternalId)
                    .ToListAsync(ct);

                var existingSet = existing.Count == 0
                    ? new HashSet<string>()
                    : new HashSet<string>(existing);

                var willInsert = candidates.Count(c => !existingSet.Contains(c.ExternalId));

                _logger.LogInformation(
                    "YT: source={Name} page={Page} candidates={Cand} existing={Exist} willInsert={Will}",
                    src.Name, pagesFetched, candidates.Count, existingSet.Count, willInsert);

                var addedThisPage = 0;
                var consecutiveKnown = 0;
                var stopAfterThisPage = false;

                foreach (var c in candidates)
                {
                    if (existingSet.Contains(c.ExternalId))
                    {
                        consecutiveKnown++;

                        // Only stop after MANY consecutive known IDs (prevents missing items when ordering is weird)
                        if (addedThisPage > 0 && consecutiveKnown >= knownStop)
                        {
                            _logger.LogInformation(
                                "YT: early-stop (>= {N} consecutive known) source={Name} page={Page}",
                                knownStop, src.Name, pagesFetched);

                            stopAfterThisPage = true;
                            break;
                        }

                        continue;
                    }

                    consecutiveKnown = 0;

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
                        ExternalId = Truncate(c.ExternalId, 300),
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

                    addedThisPage++;
                    totalAdded++;
                }

                _logger.LogInformation("YT: source={Name} page={Page} added={Added}", src.Name, pagesFetched, addedThisPage);

                if (stopAfterThisPage)
                    break;

                // Next page token
                pageToken = root.TryGetProperty("nextPageToken", out var next) && next.ValueKind == JsonValueKind.String
                    ? next.GetString()
                    : null;

                if (string.IsNullOrWhiteSpace(pageToken))
                    break;

                // If we inserted nothing and everything looks known, stop (fast)
                if (totalAdded == 0 && existingSet.Count > 0 && willInsert == 0)
                {
                    _logger.LogInformation("YT: source={Name} stop paging (no new items on first page).", src.Name);
                    break;
                }
            }

            TouchSchedule(src, ok: true);
            src.ErrorCount = 0;
            src.LastError = null;
            src.Cursor = null;

            _logger.LogInformation(
                "YT: finished source={Name} pagesFetched={Pages} totalCandidates={Cand} totalAdded={Added}",
                src.Name, pagesFetched, totalCandidates, totalAdded);
        }
        catch (Exception ex)
        {
            TouchSchedule(src, ok: false);
            src.ErrorCount += 1;
            src.LastError = Truncate(ex.Message, 800);
            _logger.LogWarning(ex, "YT: source failed source={Name}", src.Name);
        }
    }

    private void TouchSchedule(NewsSource src, bool ok)
    {
        var now = DateTimeOffset.UtcNow;
        src.LastFetchedAt = now;
        src.UpdatedAt = now;

        // DB is the source of truth
        // FetchIntervalSeconds must exist (your migration already added it)
        var intervalSeconds =
            src.FetchIntervalSeconds > 0
                ? src.FetchIntervalSeconds
                : Math.Max(30, src.FetchIntervalMinutes * 60); // fallback ONLY if old data still uses minutes

        if (!ok)
        {
            // backoff (capped)
            var backoffSeconds = Math.Min(
                intervalSeconds * Math.Max(2, src.ErrorCount + 1),
                12 * 60 * 60);

            src.NextFetchAt = now.AddSeconds(backoffSeconds);
        }
        else
        {
            src.NextFetchAt = now.AddSeconds(intervalSeconds);
        }
    }

    private static DateTime? ParseYouTubeDate(string? s)
    {
        if (string.IsNullOrWhiteSpace(s)) return null;

        if (DateTimeOffset.TryParse(
                s,
                CultureInfo.InvariantCulture,
                DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal,
                out var dto))
            return dto.UtcDateTime;

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

        return Get(thumbs, "maxres")
            ?? Get(thumbs, "standard")
            ?? Get(thumbs, "high")
            ?? Get(thumbs, "medium")
            ?? Get(thumbs, "default");
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
        return s.Length <= max ? s : s[..max];
    }

    private async Task<string?> ResolveUploadsPlaylistId(HttpClient http, string channelId, CancellationToken ct)
    {
        var url =
            "https://www.googleapis.com/youtube/v3/channels" +
            "?part=contentDetails" +
            $"&id={Uri.EscapeDataString(channelId)}" +
            $"&key={Uri.EscapeDataString(_yt.ApiKey)}";

        using var resp = await http.GetAsync(url, ct);

        if (resp.StatusCode == (HttpStatusCode)429)
            throw new Exception("YouTube rate limited (429) while resolving uploads playlist.");

        if (!resp.IsSuccessStatusCode)
            await ThrowWithBody(resp, "YouTube channels.list failed", ct);

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

    private static async Task ThrowWithBody(HttpResponseMessage resp, string context, CancellationToken ct)
    {
        var body = await resp.Content.ReadAsStringAsync(ct);
        throw new Exception($"{context}: HTTP {(int)resp.StatusCode} {resp.ReasonPhrase} :: {body}");
    }
}