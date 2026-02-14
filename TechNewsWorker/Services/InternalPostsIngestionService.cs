using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TechNewsCore.Models;
using TechNewsWorker.Data;
using TechNewsWorker.Options;

namespace TechNewsWorker.Services;

public class InternalPostsIngestionService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<InternalPostsIngestionService> _logger;
    private readonly IngestionOptions _opt;

    public InternalPostsIngestionService(
        IServiceScopeFactory scopeFactory,
        IOptions<IngestionOptions> opt,
        ILogger<InternalPostsIngestionService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
        _opt = opt.Value;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("InternalPosts ingestion started");

        var timer = new PeriodicTimer(TimeSpan.FromMinutes(_opt.RssTickMinutes));

        await RunOnce(stoppingToken);

        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            await RunOnce(stoppingToken);
        }
    }

    private async Task RunOnce(CancellationToken ct)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<WorkerDbContext>();

            var now = DateTime.UtcNow;

            var sources = await db.NewsSources
                .Where(s =>
                    s.IsActive &&
                    s.Type == NewsSourceType.InternalPosts &&
                    (s.NextFetchAt == null || s.NextFetchAt <= now))
                .ToListAsync(ct);

            foreach (var src in sources)
            {
                await IngestSource(db, src, ct);
                await db.SaveChangesAsync(ct);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "InternalPosts ingestion failed");
        }
    }

    private async Task IngestSource(
        WorkerDbContext db,
        NewsSource source,
        CancellationToken ct)
    {
var posts = await db.Posts
    .AsNoTracking()
    .Where(p => p.IsVerified)
    .OrderByDescending(p => p.CreatedAt)
    .Take(_opt.MaxItemsPerSource)
    .ToListAsync(ct);


        var existingIds = await db.FeedItems
            .AsNoTracking()
            .Where(f => f.SourceId == source.Id)
            .Select(f => f.ExternalId)
            .ToListAsync(ct);

        var existingSet = new HashSet<string>(existingIds);

        var added = 0;

        foreach (var post in posts)
        {
            var externalId = $"post-{post.Id}";

            if (existingSet.Contains(externalId))
                continue;

            db.FeedItems.Add(new FeedItem
            {
                Id = Guid.NewGuid(),
                SourceId = source.Id,
                ExternalId = externalId,
                Kind = FeedItemKind.Article,

                Title = post.Title,
                Summary = post.Content,

                LinkUrl = $"https://wargalnews.com/community/{post.Id}",

                ImageUrl = post.ImageUrl,

                PublishedAt = post.CreatedAt,
                ImportedAt = DateTime.UtcNow,

                Author = post.User?.Name,

                IsActive = true
            });

            added++;
        }

        source.LastFetchedAt = DateTime.UtcNow;
        source.NextFetchAt = DateTime.UtcNow.AddMinutes(2);

        _logger.LogInformation(
            "InternalPosts: source={Source} added={Added}",
            source.Name,
            added);
    }
}
