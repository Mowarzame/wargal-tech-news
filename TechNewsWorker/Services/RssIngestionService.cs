using System.Net;
using System.ServiceModel.Syndication;
using System.Xml;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TechNewsCore.Models;
using TechNewsWorker.Data;
using TechNewsWorker.Options;

namespace TechNewsWorker.Services
{
    public sealed class RssIngestionService : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger<RssIngestionService> _logger;
        private readonly IngestionOptions _opt;
        private readonly RssOptions _rss;

        public RssIngestionService(
            IServiceScopeFactory scopeFactory,
            IHttpClientFactory httpClientFactory,
            IOptions<IngestionOptions> opt,
            IOptions<RssOptions> rss,
            ILogger<RssIngestionService> logger)
        {
            _scopeFactory = scopeFactory;
            _httpClientFactory = httpClientFactory;
            _logger = logger;
            _opt = opt.Value;
            _rss = rss.Value;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            var interval = _opt.GetRssInterval();
            _logger.LogInformation("RSS: START @ {NowUtc:o} interval={Interval}", DateTimeOffset.UtcNow, interval);

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
                        s.Type == NewsSourceType.RssWebsite &&
                        s.RssUrl != null && s.RssUrl != "" &&
                        (s.NextFetchAt == null || s.NextFetchAt <= nowUtc))
                    .OrderBy(s => s.NextFetchAt ?? safeEpochUtc)
                    .Take(_opt.MaxSourcesPerRun)
                    .Select(s => s.Id)
                    .ToListAsync(ct);

                _logger.LogInformation("RSS[{Run}]: due={Due} nowUtc={Now:o}", runId, dueIds.Count, nowUtc);
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

                _logger.LogInformation("RSS[{Run}]: COMPLETE due={Due} maxParallel={MaxPar}", runId, dueIds.Count, maxParallel);
            }
            catch (OperationCanceledException)
            {
                _logger.LogWarning("RSS: cancelled");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "RSS: RunOnce failed");
            }
        }

        private async Task ProcessOne(string runId, Guid sourceId, CancellationToken ct)
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<WorkerDbContext>();
            var http = _httpClientFactory.CreateClient("ingestion");

            // apply RSS options
            http.Timeout = TimeSpan.FromSeconds(Math.Max(5, _rss.RequestTimeoutSeconds));
            if (!string.IsNullOrWhiteSpace(_rss.UserAgent))
            {
                http.DefaultRequestHeaders.UserAgent.Clear();
                http.DefaultRequestHeaders.UserAgent.ParseAdd(_rss.UserAgent);
            }

            var src = await db.NewsSources.FirstAsync(x => x.Id == sourceId, ct);

            try
            {
                var added = await IngestSource(db, http, src, ct);
                await db.SaveChangesAsync(ct);

                var gapSec = (src.NextFetchAt!.Value - src.LastFetchedAt!.Value).TotalSeconds;
                _logger.LogInformation("RSS[{Run}]: done source={Name} added={Added} gapSec={Gap} next={Next:o} err={Err} lastErr={LastErr}",
                    runId, src.Name, added, gapSec, src.NextFetchAt, src.ErrorCount, src.LastError);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "RSS[{Run}]: source failed source={Name}", runId, src.Name);
            }
        }

        private async Task<int> IngestSource(WorkerDbContext db, HttpClient http, NewsSource src, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(src.RssUrl))
            {
                TouchOk(src);
                return 0;
            }

            try
            {
                using var req = new HttpRequestMessage(HttpMethod.Get, src.RssUrl);

                if (!string.IsNullOrWhiteSpace(src.LastEtag))
                    req.Headers.TryAddWithoutValidation("If-None-Match", src.LastEtag);

                if (!string.IsNullOrWhiteSpace(src.LastModified))
                    req.Headers.TryAddWithoutValidation("If-Modified-Since", src.LastModified);

                using var resp = await http.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, ct);

                if (resp.StatusCode == HttpStatusCode.NotModified)
                {
                    TouchOk(src);
                    src.ErrorCount = 0;
                    src.LastError = null;
                    return 0;
                }

                if (!resp.IsSuccessStatusCode)
                {
                    var body = await resp.Content.ReadAsStringAsync(ct);
                    TouchFail(src, $"HTTP {(int)resp.StatusCode} {resp.ReasonPhrase}: {Truncate(body, 300)}");
                    return 0;
                }

                // store caching headers
                if (resp.Headers.ETag != null)
                    src.LastEtag = resp.Headers.ETag.ToString();

                if (resp.Content.Headers.LastModified.HasValue)
                    src.LastModified = resp.Content.Headers.LastModified.Value.ToString("R");

                await using var stream = await resp.Content.ReadAsStreamAsync(ct);
                using var xmlReader = XmlReader.Create(stream, new XmlReaderSettings { DtdProcessing = DtdProcessing.Ignore });

                var feed = SyndicationFeed.Load(xmlReader);
                if (feed == null)
                {
                    TouchOk(src);
                    return 0;
                }

                // parse newest first, take MaxItemsPerSource
                var items = feed.Items
                    .OrderByDescending(i => i.PublishDate.UtcDateTime == default ? i.LastUpdatedTime.UtcDateTime : i.PublishDate.UtcDateTime)
                    .Take(Math.Max(1, _opt.MaxItemsPerSource))
                    .ToList();

                if (items.Count == 0)
                {
                    TouchOk(src);
                    return 0;
                }

                // build candidate external ids (prefer GUID, else LinkUrl, else hash)
                var candidates = new List<(string ExternalId, string Title, string? Link, DateTime Published, string? Summary, string? Author)>();

                foreach (var it in items)
                {
                    var link = it.Links.FirstOrDefault()?.Uri?.ToString();
                    var guid = it.Id;

                    var externalId = !string.IsNullOrWhiteSpace(guid)
                        ? guid.Trim()
                        : (!string.IsNullOrWhiteSpace(link) ? link.Trim() : $"{src.Id}:{it.Title?.Text}:{it.PublishDate.UtcDateTime:o}");

                    var title = it.Title?.Text?.Trim();
                    if (string.IsNullOrWhiteSpace(title)) continue;

                    var summary = it.Summary?.Text;
                    var author = it.Authors.FirstOrDefault()?.Name;

                    var pub = it.PublishDate.UtcDateTime != default
                        ? it.PublishDate.UtcDateTime
                        : (it.LastUpdatedTime.UtcDateTime != default ? it.LastUpdatedTime.UtcDateTime : DateTime.UtcNow);

                    candidates.Add((Truncate(externalId, 300)!, title, link, pub, summary, author));
                }

                var extIds = candidates.Select(c => c.ExternalId).Distinct().ToList();

                var existing = await db.FeedItems.AsNoTracking()
                    .Where(x => x.SourceId == src.Id && extIds.Contains(x.ExternalId))
                    .Select(x => x.ExternalId)
                    .ToListAsync(ct);

                var existingSet = existing.Count == 0 ? new HashSet<string>() : new HashSet<string>(existing);

                var added = 0;

                foreach (var c in candidates)
                {
                    if (existingSet.Contains(c.ExternalId)) continue;

                    db.FeedItems.Add(new FeedItem
                    {
                        Id = Guid.NewGuid(),
                        SourceId = src.Id,
                        ExternalId = c.ExternalId,
                        Kind = FeedItemKind.Article,
                        Title = Truncate(c.Title, 500),
                        Summary = Truncate(CleanText(c.Summary), 2000),
                        LinkUrl = Truncate(c.Link, 1200),
                        ImageUrl = null, // If you later parse og:image, do it in API or separate job
                        PublishedAt = c.Published,
                        ImportedAt = DateTime.UtcNow,
                        Author = Truncate(c.Author, 200),
                        IsActive = true,
                    });

                    added++;
                }

                TouchOk(src);
                src.ErrorCount = 0;
                src.LastError = null;

                return added;
            }
            catch (Exception ex)
            {
                TouchFail(src, ex.Message);
                return 0;
            }
        }

        private void TouchOk(NewsSource src)
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

        private void TouchFail(NewsSource src, string err)
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

            var backoffSeconds = Math.Min(intervalSeconds * Math.Max(2, src.ErrorCount), 60 * 15); // max 15 min
            src.NextFetchAt = now.AddSeconds(backoffSeconds);
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
    }
}