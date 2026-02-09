using System.Net;
using System.ServiceModel.Syndication;
using System.Text.RegularExpressions;
using System.Xml;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TechNewsCore.Models;
using TechNewsWorker.Data;
using TechNewsWorker.Options;

namespace TechNewsWorker.Services
{
    public class RssIngestionService : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger<RssIngestionService> _logger;
        private readonly IngestionOptions _opt;

        private const int ForcedIntervalMinutes = 2;

        public RssIngestionService(
            IServiceScopeFactory scopeFactory,
            IHttpClientFactory httpClientFactory,
            IOptions<IngestionOptions> opt,
            ILogger<RssIngestionService> logger)
        {
            _scopeFactory = scopeFactory;
            _httpClientFactory = httpClientFactory;
            _logger = logger;
            _opt = opt.Value;
        }

protected override async Task ExecuteAsync(CancellationToken stoppingToken)
{
    _logger.LogInformation("RSS: ExecuteAsync STARTED @ {NowUtc:o} tick={Tick}m", DateTime.UtcNow, _opt.RssTickMinutes);

    var timer = new PeriodicTimer(TimeSpan.FromMinutes(_opt.RssTickMinutes));

    // ✅ first run with guard log
    _logger.LogInformation("RSS: first RunOnce BEGIN @ {NowUtc:o}", DateTime.UtcNow);
    await RunOnce(stoppingToken);
    _logger.LogInformation("RSS: first RunOnce END   @ {NowUtc:o}", DateTime.UtcNow);

    while (await timer.WaitForNextTickAsync(stoppingToken))
    {
        _logger.LogInformation("RSS: TIMER TICK @ {NowUtc:o}", DateTime.UtcNow);

        _logger.LogInformation("RSS: RunOnce BEGIN @ {NowUtc:o}", DateTime.UtcNow);
        await RunOnce(stoppingToken);
        _logger.LogInformation("RSS: RunOnce END   @ {NowUtc:o}", DateTime.UtcNow);
    }
}


private async Task RunOnce(CancellationToken ct)
{
    _logger.LogInformation("RSS TICK @ {NowUtc:o}", DateTime.UtcNow);

    try
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<WorkerDbContext>();
        var http = _httpClientFactory.CreateClient("ingestion");

        var nowUtc = DateTime.UtcNow;
        var safeEpochUtc = DateTime.UnixEpoch;

        var sources = await db.NewsSources
            .Where(s => s.IsActive
                        && s.Type == NewsSourceType.RssWebsite
                        && s.RssUrl != null
                        && (s.NextFetchAt == null || s.NextFetchAt <= nowUtc))
            .OrderBy(s => s.NextFetchAt ?? safeEpochUtc)
            .Take(_opt.MaxSourcesPerRun)
            .ToListAsync(ct);

        if (sources.Count == 0)
        {
            _logger.LogInformation("RSS: no due sources. nowUtc={NowUtc:o}", nowUtc);
            return;
        }

        _logger.LogInformation("RSS: due sources={Count} nowUtc={NowUtc:o}", sources.Count, nowUtc);

        foreach (var src in sources)
        {
            ct.ThrowIfCancellationRequested();
            await IngestSource(db, http, src, ct);
            await db.SaveChangesAsync(ct);
        }
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "RSS: run failed.");
    }
}


private async Task IngestSource(WorkerDbContext db, HttpClient http, NewsSource src, CancellationToken ct)
{
    var rssUrl = src.RssUrl;
    if (string.IsNullOrWhiteSpace(rssUrl))
    {
        TouchSchedule(src, ok: true);
        _logger.LogWarning("RSS: skipped missing RssUrl source={Name}", src.Name);
        return;
    }

    // ✅ Prevent the “304 but DB empty” trap after truncating FeedItems
    var hasAnyItems = await db.FeedItems.AsNoTracking()
        .AnyAsync(x => x.SourceId == src.Id, ct);

    _logger.LogInformation("RSS: fetching source={Name} url={Url} hasAnyItems={Has}",
        src.Name, rssUrl, hasAnyItems);

    try
    {
        using var req = new HttpRequestMessage(HttpMethod.Get, rssUrl);

        // ✅ Only use conditional headers if we already have data for this source
        if (hasAnyItems)
        {
            if (!string.IsNullOrWhiteSpace(src.LastEtag))
                req.Headers.TryAddWithoutValidation("If-None-Match", src.LastEtag);

            if (!string.IsNullOrWhiteSpace(src.LastModified))
                req.Headers.TryAddWithoutValidation("If-Modified-Since", src.LastModified);
        }

        using var resp = await http.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, ct);

        if (resp.StatusCode == HttpStatusCode.NotModified)
        {
            _logger.LogInformation("RSS: 304 not modified source={Name}", src.Name);

            if (!hasAnyItems)
            {
                // DB is empty but cache says unchanged -> clear cache + force full fetch next tick
                src.LastEtag = null;
                src.LastModified = null;
                _logger.LogWarning("RSS: 304 but DB empty; cleared cache tokens source={Name}", src.Name);
            }

            TouchSchedule(src, ok: true);
            src.ErrorCount = 0;
            src.LastError = null;
            return;
        }

        resp.EnsureSuccessStatusCode();

        // Update cache tokens
        src.LastEtag = resp.Headers.ETag?.Tag;
        if (resp.Content.Headers.LastModified.HasValue)
            src.LastModified = resp.Content.Headers.LastModified.Value.ToString("R");

        await using var stream = await resp.Content.ReadAsStreamAsync(ct);
        using var reader = XmlReader.Create(stream, new XmlReaderSettings { Async = true });

        var feed = SyndicationFeed.Load(reader);
        if (feed == null)
        {
            TouchSchedule(src, ok: true);
            src.ErrorCount = 0;
            src.LastError = null;
            _logger.LogWarning("RSS: unreadable feed source={Name}", src.Name);
            return;
        }

        DateTime GetPublishedUtc(SyndicationItem i)
        {
            var p = i.PublishDate.UtcDateTime;
            if (p != DateTime.MinValue) return DateTime.SpecifyKind(p, DateTimeKind.Utc);

            var u = i.LastUpdatedTime.UtcDateTime;
            if (u != DateTime.MinValue) return DateTime.SpecifyKind(u, DateTimeKind.Utc);

            return DateTime.UtcNow;
        }

        var rawItems = feed.Items
            .OrderByDescending(GetPublishedUtc)
            .Take(_opt.MaxItemsPerSource)
            .ToList();

        var candidates = new List<(string ExternalId, string Title, string Link, DateTime Published, string? Summary, string? Image, string? Author)>();

        foreach (var it in rawItems)
        {
            ct.ThrowIfCancellationRequested();

            var linkUrl = it.Links.FirstOrDefault()?.Uri?.ToString()?.Trim();
            if (string.IsNullOrWhiteSpace(linkUrl))
                continue;

            var externalIdRaw = !string.IsNullOrWhiteSpace(it.Id) ? it.Id.Trim() : linkUrl;
            var titleRaw = it.Title?.Text?.Trim();

            if (string.IsNullOrWhiteSpace(externalIdRaw) || string.IsNullOrWhiteSpace(titleRaw))
                continue;

            var externalId = Truncate(externalIdRaw, 300)!;
            var title = Truncate(titleRaw, 500)!;
            var link = Truncate(linkUrl, 1200)!;

            var published = GetPublishedUtc(it);

            var summary = CleanText(it.Summary?.Text);
            summary = string.IsNullOrWhiteSpace(summary) ? null : Truncate(summary, 2000);

            var imageUrl = TryExtractImageUrl(it);
            imageUrl = string.IsNullOrWhiteSpace(imageUrl) ? null : Truncate(imageUrl, 1200);

            var author = it.Authors.FirstOrDefault()?.Name?.Trim();
            author = string.IsNullOrWhiteSpace(author) ? null : Truncate(author, 200);

            candidates.Add((externalId, title, link, published, summary, imageUrl, author));
        }

        if (candidates.Count == 0)
        {
            TouchSchedule(src, ok: true);
            src.ErrorCount = 0;
            src.LastError = null;
            _logger.LogInformation("RSS: candidates=0 source={Name}", src.Name);
            return;
        }

        var ids = candidates.Select(x => x.ExternalId).Distinct().ToList();

        var existing = await db.FeedItems.AsNoTracking()
            .Where(x => x.SourceId == src.Id && ids.Contains(x.ExternalId))
            .Select(x => x.ExternalId)
            .ToListAsync(ct);

        var existingSet = existing.Count == 0 ? new HashSet<string>() : new HashSet<string>(existing);

        var added = 0;
        foreach (var c in candidates)
        {
            if (existingSet.Contains(c.ExternalId))
                continue;

            db.FeedItems.Add(new FeedItem
            {
                Id = Guid.NewGuid(),
                SourceId = src.Id,
                ExternalId = c.ExternalId,
                Kind = FeedItemKind.Article,
                Title = c.Title,
                Summary = c.Summary,
                LinkUrl = c.Link,
                ImageUrl = c.Image,
                PublishedAt = c.Published,
                ImportedAt = DateTime.UtcNow,
                Author = c.Author,
                IsActive = true,
            });

            added++;
        }

        TouchSchedule(src, ok: true);
        src.ErrorCount = 0;
        src.LastError = null;

        _logger.LogInformation("RSS: inserted source={Name} added={Added} candidates={Cand} existing={Exist}",
            src.Name, added, candidates.Count, existingSet.Count);
    }
    catch (Exception ex)
    {
        TouchSchedule(src, ok: false);
        src.ErrorCount += 1;
        src.LastError = Truncate(ex.Message, 800);
        _logger.LogWarning(ex, "RSS: source failed source={Name}", src.Name);
    }
}

private void TouchSchedule(NewsSource src, bool ok)
{
    var now = DateTime.UtcNow;
    src.LastFetchedAt = now;
    src.UpdatedAt = now;

    // ✅ FORCE 2 minutes always
    const int interval = 2;

    if (!ok)
    {
        var backoff = Math.Min(interval * Math.Max(2, src.ErrorCount + 1), 6 * 60);
        src.NextFetchAt = now.AddMinutes(backoff);
    }
    else
    {
        src.NextFetchAt = now.AddMinutes(interval);
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

        private static string? TryExtractImageUrl(SyndicationItem it)
        {
            var enclosure = it.Links.FirstOrDefault(l =>
                string.Equals(l.RelationshipType, "enclosure", StringComparison.OrdinalIgnoreCase));
            if (enclosure?.Uri != null) return enclosure.Uri.ToString();

            foreach (var ext in it.ElementExtensions)
            {
                try
                {
                    if (ext.OuterName.Equals("thumbnail", StringComparison.OrdinalIgnoreCase) ||
                        ext.OuterName.Equals("content", StringComparison.OrdinalIgnoreCase))
                    {
                        var x = ext.GetObject<System.Xml.Linq.XElement>();
                        var urlAttr = x.Attribute("url")?.Value;
                        if (!string.IsNullOrWhiteSpace(urlAttr)) return urlAttr;
                    }
                }
                catch { /* ignore */ }
            }

            var raw = it.Summary?.Text ?? string.Empty;
            var m = Regex.Match(raw, "src\\s*=\\s*\"(?<u>https?://[^\"]+)\"", RegexOptions.IgnoreCase);
            return m.Success ? m.Groups["u"].Value : null;
        }

        private static string CleanText(string? html)
        {
            if (string.IsNullOrWhiteSpace(html)) return string.Empty;
            var noTags = Regex.Replace(html, "<.*?>", " ");
            return Regex.Replace(noTags, "\\s+", " ").Trim();
        }

        private static string? Truncate(string? s, int max)
        {
            if (string.IsNullOrEmpty(s)) return s;
            return s.Length <= max ? s : s.Substring(0, max);
        }
    }
}
