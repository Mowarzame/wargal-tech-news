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
    public class YouTubeIngestionService : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger<YouTubeIngestionService> _logger;
        private readonly IngestionOptions _opt;
        private readonly YouTubeOptions _yt;

        private const int ForcedIntervalMinutes = 2;

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
    _logger.LogInformation("YT: ExecuteAsync STARTED @ {NowUtc:o} tick={Tick}m", DateTime.UtcNow, _opt.YouTubeTickMinutes);

    if (string.IsNullOrWhiteSpace(_yt.ApiKey))
    {
        _logger.LogError("YT: API key missing (YouTube:ApiKey).");
        return;
    }
var timer = new PeriodicTimer(TimeSpan.FromSeconds(
    Math.Max(5, _opt.YouTubeTickMinutes * 60)
));

    _logger.LogInformation("YT: first RunOnce BEGIN @ {NowUtc:o}", DateTime.UtcNow);
    await RunOnce(stoppingToken);
    _logger.LogInformation("YT: first RunOnce END   @ {NowUtc:o}", DateTime.UtcNow);

    while (await timer.WaitForNextTickAsync(stoppingToken))
    {
        _logger.LogInformation("YT: TIMER TICK @ {NowUtc:o}", DateTime.UtcNow);

        _logger.LogInformation("YT: RunOnce BEGIN @ {NowUtc:o}", DateTime.UtcNow);
        await RunOnce(stoppingToken);
        _logger.LogInformation("YT: RunOnce END   @ {NowUtc:o}", DateTime.UtcNow);
    }
}



private async Task RunOnce(CancellationToken ct)
{


     _logger.LogInformation("YT TICK @ {NowUtc:o}", DateTime.UtcNow);
    var runId = Guid.NewGuid().ToString("N")[..8];
var nowUtc = DateTimeOffset.UtcNow;

    try
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<WorkerDbContext>();
        var http = _httpClientFactory.CreateClient("ingestion");

        _logger.LogInformation("YT[{Run}]: tick nowUtc={Now:o}", runId, nowUtc);

        var activeCount = await db.NewsSources.AsNoTracking()
            .CountAsync(s => s.IsActive && s.Type == NewsSourceType.YouTubeChannel && s.YouTubeChannelId != null, ct);

        var safeEpochUtc = DateTimeOffset.UnixEpoch;

        var due = await db.NewsSources
            .AsNoTracking()
            .Where(s => s.IsActive
                        && s.Type == NewsSourceType.YouTubeChannel
                        && s.YouTubeChannelId != null
                        && (s.NextFetchAt == null || s.NextFetchAt <= nowUtc))
            .OrderBy(s => s.NextFetchAt ?? safeEpochUtc)
            .Take(_opt.MaxSourcesPerRun)
            .Select(s => new { s.Id, s.Name, s.YouTubeChannelId, s.YouTubeUploadsPlaylistId, s.NextFetchAt })
            .ToListAsync(ct);

        _logger.LogInformation(
            "YT[{Run}]: active={Active} due={Due} maxPerRun={Max}",
            runId, activeCount, due.Count, _opt.MaxSourcesPerRun);

        if (due.Count == 0)
            return;

        foreach (var s in due)
        {
            ct.ThrowIfCancellationRequested();

            var src = await db.NewsSources.FirstAsync(x => x.Id == s.Id, ct);

            _logger.LogInformation(
                "YT[{Run}]: start source={Name} id={Id} nextFetchAt={Next:o} channel={Channel} uploads={Uploads}",
                runId, src.Name, src.Id, src.NextFetchAt, src.YouTubeChannelId, src.YouTubeUploadsPlaylistId);

            await IngestSource(db, http, src, ct);

            await db.SaveChangesAsync(ct);

            var gap = (src.NextFetchAt!.Value - src.LastFetchedAt!.Value).TotalMinutes;
            _logger.LogInformation(
                "YT[{Run}]: done  source={Name} lastFetchedAt={Last:o} nextFetchAt={Next:o} gapMin={Gap} err={Err} lastErr={LastErr}",
                runId, src.Name, src.LastFetchedAt, src.NextFetchAt, gap, src.ErrorCount, src.LastError);
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
        // Resolve uploads playlist id if missing
        if (string.IsNullOrWhiteSpace(src.YouTubeUploadsPlaylistId))
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
            src.UpdatedAt = DateTime.UtcNow;

            _logger.LogInformation("YT: resolved uploads playlist source={Name} uploads={Uploads}",
                src.Name, src.YouTubeUploadsPlaylistId);
        }

        var url =
            "https://www.googleapis.com/youtube/v3/playlistItems" +
            "?part=snippet,contentDetails" +
            $"&playlistId={Uri.EscapeDataString(src.YouTubeUploadsPlaylistId!)}" +
            $"&maxResults={Math.Min(_opt.MaxItemsPerSource, 50)}" +
            $"&key={Uri.EscapeDataString(_yt.ApiKey)}";

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

        if (!doc.RootElement.TryGetProperty("items", out var itemsEl) || itemsEl.ValueKind != JsonValueKind.Array)
        {
            TouchSchedule(src, ok: true);
            src.ErrorCount = 0;
            src.LastError = null;
            src.Cursor = null;
            _logger.LogInformation("YT: no items array source={Name}", src.Name);
            return;
        }

        var itemsCount = itemsEl.GetArrayLength();
        _logger.LogInformation("YT: items returned={Count} source={Name}", itemsCount, src.Name);

        var candidates = new List<(string VideoId, string ExternalId, string Title, JsonElement Snippet)>();

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

            candidates.Add((videoId!, Truncate(videoId!, 300)!, title!, snippet));
        }

        if (candidates.Count == 0)
        {
            TouchSchedule(src, ok: true);
            src.ErrorCount = 0;
            src.LastError = null;
            src.Cursor = null;
            _logger.LogInformation("YT: candidates=0 source={Name}", src.Name);
            return;
        }

        var extIds = candidates.Select(c => c.ExternalId).Distinct().ToList();

        var existing = await db.FeedItems.AsNoTracking()
            .Where(x => x.SourceId == src.Id && extIds.Contains(x.ExternalId))
            .Select(x => x.ExternalId)
            .ToListAsync(ct);

        var existingSet = existing.Count == 0 ? new HashSet<string>() : new HashSet<string>(existing);

        var willInsert = candidates.Count(c => !existingSet.Contains(c.ExternalId));
        _logger.LogInformation("YT: source={Name} candidates={Cand} existing={Exist} willInsert={Will}",
            src.Name, candidates.Count, existingSet.Count, willInsert);

        var added = 0;

        foreach (var c in candidates)
        {
            if (existingSet.Contains(c.ExternalId))
                continue;

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

            added++;
        }

        TouchSchedule(src, ok: true);
        src.ErrorCount = 0;
        src.LastError = null;
        src.Cursor = null;

        _logger.LogInformation("YT: inserted source={Name} added={Added}", src.Name, added);
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

    // Use seconds from DB, fallback to minutes if needed
    var intervalSeconds =
        src.FetchIntervalSeconds > 0
            ? src.FetchIntervalSeconds
            : Math.Max(1, src.FetchIntervalMinutes) * 60;

    if (!ok)
    {
        var backoffSeconds = Math.Min(
            intervalSeconds * Math.Max(2, src.ErrorCount + 1),
            12 * 60 * 60
        );

        src.NextFetchAt = now.AddSeconds(backoffSeconds);
    }
    else
    {
        src.NextFetchAt = now.AddSeconds(intervalSeconds);
    }
}

        private void LogSchedule(string tag, NewsSource src)
        {
            var gap = (src.NextFetchAt.HasValue && src.LastFetchedAt.HasValue)
                ? (src.NextFetchAt.Value - src.LastFetchedAt.Value).TotalMinutes
                : (double?)null;

            _logger.LogInformation(
                "{Tag}: schedule source={Name} last={Last:o} next={Next:o} gapMin={Gap} errCount={Err} lastErr={LastErr}",
                tag, src.Name, src.LastFetchedAt, src.NextFetchAt, gap, src.ErrorCount, src.LastError);
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

            string? Get(string name)
            {
                if (!thumbs.TryGetProperty(name, out var t) || t.ValueKind != JsonValueKind.Object)
                    return null;

                if (!t.TryGetProperty("url", out var u) || u.ValueKind != JsonValueKind.String)
                    return null;

                var url = u.GetString();
                return string.IsNullOrWhiteSpace(url) ? null : url.Trim();
            }

            return Get("maxres") ?? Get("standard") ?? Get("high") ?? Get("medium") ?? Get("default");
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
        private async Task ThrowWithBody(HttpResponseMessage resp, string context, CancellationToken ct)
        {
            var body = await resp.Content.ReadAsStringAsync(ct);
            throw new Exception($"{context}: HTTP {(int)resp.StatusCode} {resp.ReasonPhrase} :: {body}");
        }

        
    }
}
