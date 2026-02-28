using System.Net;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TechNewsWorker.Data;
using TechNewsWorker.Options;
using TechNewsWorker.Services;

var builder = Host.CreateApplicationBuilder(args);

// Logging
builder.Logging.ClearProviders();
builder.Logging.AddSimpleConsole(o =>
{
    o.SingleLine = true;
    o.TimestampFormat = "HH:mm:ss ";
});
builder.Logging.SetMinimumLevel(LogLevel.Information);

Console.WriteLine($"BOOT: Worker starting @ {DateTime.UtcNow:o}");

// Options
builder.Services.Configure<IngestionOptions>(builder.Configuration.GetSection("Ingestion"));
builder.Services.Configure<YouTubeOptions>(builder.Configuration.GetSection("YouTube"));
builder.Services.Configure<RssOptions>(builder.Configuration.GetSection("Rss"));

// Database
builder.Services.AddDbContext<WorkerDbContext>(opt =>
{
    var cs = builder.Configuration.GetConnectionString("DefaultConnection");
    if (string.IsNullOrWhiteSpace(cs))
        throw new InvalidOperationException("ConnectionStrings:DefaultConnection is not configured.");

    opt.UseNpgsql(cs);
});

// Shared handler: decompression prevents “Invalid character in encoding” from gzip/br bodies
static SocketsHttpHandler CreateHandler() => new()
{
    AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate | DecompressionMethods.Brotli
};

// RSS http client
builder.Services.AddHttpClient("rss", (sp, c) =>
{
    var rss = sp.GetRequiredService<IOptions<RssOptions>>().Value;
    c.Timeout = TimeSpan.FromSeconds(Math.Max(5, rss.RequestTimeoutSeconds));
    c.DefaultRequestHeaders.UserAgent.ParseAdd(rss.UserAgent);
    c.DefaultRequestHeaders.TryAddWithoutValidation("Accept", "application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.8");
})
.ConfigurePrimaryHttpMessageHandler(CreateHandler);

// YouTube http client (separate UA + timeout)
builder.Services.AddHttpClient("youtube", (sp, c) =>
{
    var yt = sp.GetRequiredService<IOptions<YouTubeOptions>>().Value;
    c.Timeout = TimeSpan.FromSeconds(Math.Max(5, yt.RequestTimeoutSeconds));
    c.DefaultRequestHeaders.UserAgent.ParseAdd(yt.UserAgent);
    c.DefaultRequestHeaders.TryAddWithoutValidation("Accept", "application/atom+xml, application/xml;q=0.9, */*;q=0.8");
})
.ConfigurePrimaryHttpMessageHandler(CreateHandler);

// Heartbeat
builder.Services.AddHostedService<WorkerHeartbeatService>();

// Ingestion services
builder.Services.AddHostedService<RssIngestionService>();
builder.Services.AddHostedService<YouTubeIngestionService>();
builder.Services.AddHostedService<InternalPostsIngestionService>();

var host = builder.Build();

// Log actual values
using (var scope = host.Services.CreateScope())
{
    var opt = scope.ServiceProvider.GetRequiredService<IOptions<IngestionOptions>>().Value;
    var yt = scope.ServiceProvider.GetRequiredService<IOptions<YouTubeOptions>>().Value;
    var rss = scope.ServiceProvider.GetRequiredService<IOptions<RssOptions>>().Value;

    Console.WriteLine(
        $"BOOT: RSS interval={opt.GetRssInterval()} YT interval={opt.GetYouTubeInterval()} " +
        $"MaxSourcesPerRun={opt.MaxSourcesPerRun} MaxItemsPerSource={opt.MaxItemsPerSource} " +
        $"MaxParallelFetches={opt.MaxParallelFetches} " +
        $"YT.MaxSourcesPerRun={yt.MaxSourcesPerRun} YT.MinDelayMs={yt.MinDelayBetweenRequestsMs} " +
        $"RSS.TimeoutSec={rss.RequestTimeoutSeconds} YT.TimeoutSec={yt.RequestTimeoutSeconds}");
}

host.Run();

// Heartbeat service
public sealed class WorkerHeartbeatService : BackgroundService
{
    private readonly ILogger<WorkerHeartbeatService> _logger;

    public WorkerHeartbeatService(ILogger<WorkerHeartbeatService> logger)
    {
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("HEARTBEAT started @ {NowUtc:o}", DateTime.UtcNow);

        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(30));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            _logger.LogInformation("HEARTBEAT alive @ {NowUtc:o}", DateTime.UtcNow);
        }
    }
}