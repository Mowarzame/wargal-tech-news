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
builder.Services.Configure<IngestionOptions>(
    builder.Configuration.GetSection("Ingestion"));

builder.Services.Configure<YouTubeOptions>(
    builder.Configuration.GetSection("YouTube"));

builder.Services.Configure<RssOptions>(
    builder.Configuration.GetSection("Rss"));

// Database
builder.Services.AddDbContext<WorkerDbContext>(opt =>
{
    var cs = builder.Configuration.GetConnectionString("DefaultConnection");
    if (string.IsNullOrWhiteSpace(cs))
        throw new InvalidOperationException("ConnectionStrings:DefaultConnection is not configured.");

    opt.UseNpgsql(cs);
});

// Http client (CRITICAL: enable automatic decompression to avoid "invalid character" on gzip/brotli)
builder.Services.AddHttpClient("ingestion", c =>
{
    // Can be overridden by RssOptions.RequestTimeoutSeconds in the service if needed
    c.Timeout = TimeSpan.FromSeconds(30);
    c.DefaultRequestHeaders.UserAgent.ParseAdd("WargalNewsWorker/1.0");
})
.ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler
{
    AutomaticDecompression =
        DecompressionMethods.GZip |
        DecompressionMethods.Deflate |
        DecompressionMethods.Brotli
});

// Heartbeat
builder.Services.AddHostedService<WorkerHeartbeatService>();

// Ingestion services
builder.Services.AddHostedService<RssIngestionService>();
builder.Services.AddHostedService<YouTubeIngestionService>();
builder.Services.AddHostedService<InternalPostsIngestionService>();

var host = builder.Build();

// Log actual interval values
using (var scope = host.Services.CreateScope())
{
    var opt = scope.ServiceProvider.GetRequiredService<IOptions<IngestionOptions>>().Value;
    var yt  = scope.ServiceProvider.GetRequiredService<IOptions<YouTubeOptions>>().Value;
    var rss = scope.ServiceProvider.GetRequiredService<IOptions<RssOptions>>().Value;

    Console.WriteLine(
        $"BOOT: RSS interval={opt.GetRssInterval()} YT interval={opt.GetYouTubeInterval()} " +
        $"MaxSourcesPerRun={opt.MaxSourcesPerRun} MaxItemsPerSource={opt.MaxItemsPerSource} " +
        $"MaxParallelFetches={opt.MaxParallelFetches} YT.MaxResults={yt.MaxResults} " +
        $"RSS.TimeoutSec={rss.RequestTimeoutSeconds}");
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