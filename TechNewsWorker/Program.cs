using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TechNewsWorker.Data;
using TechNewsWorker.Options;
using TechNewsWorker.Services;

var builder = Host.CreateApplicationBuilder(args);

// ✅ Always show logs in terminal
builder.Logging.ClearProviders();
builder.Logging.AddSimpleConsole(o =>
{
    o.SingleLine = true;
    o.TimestampFormat = "HH:mm:ss ";
});
builder.Logging.SetMinimumLevel(LogLevel.Information);

// ✅ PROOF Program.cs is running
Console.WriteLine($"BOOT: Worker starting @ {DateTime.UtcNow:o}");

// Options
builder.Services.Configure<IngestionOptions>(builder.Configuration.GetSection("Ingestion"));
builder.Services.Configure<YouTubeOptions>(builder.Configuration.GetSection("YouTube"));

// DbContext
builder.Services.AddDbContext<WorkerDbContext>(opt =>
{
    var cs = builder.Configuration.GetConnectionString("DefaultConnection");
    opt.UseNpgsql(cs);
});

// HttpClient
builder.Services.AddHttpClient("ingestion", c =>
{
    c.Timeout = TimeSpan.FromSeconds(20);
    c.DefaultRequestHeaders.UserAgent.ParseAdd("SomTechNewsWorker/1.0");
});

// ✅ Add a heartbeat service that prints every 30 seconds (proves process is alive)
builder.Services.AddHostedService<WorkerHeartbeatService>();

// Your ingestion services
builder.Services.AddHostedService<RssIngestionService>();
builder.Services.AddHostedService<YouTubeIngestionService>();
builder.Services.AddHostedService<InternalPostsIngestionService>();


var host = builder.Build();

// ✅ PROOF options values at runtime (catches appsettings overrides)
using (var scope = host.Services.CreateScope())
{
    var opt = scope.ServiceProvider.GetRequiredService<IOptions<IngestionOptions>>().Value;
    Console.WriteLine($"BOOT: IngestionOptions => RSS={opt.RssTickMinutes}m, YT={opt.YouTubeTickMinutes}m, MaxSources={opt.MaxSourcesPerRun}, MaxItems={opt.MaxItemsPerSource}");
}

host.Run();


// ------------------------------
// ✅ Heartbeat hosted service
// ------------------------------
public sealed class WorkerHeartbeatService : BackgroundService
{
    private readonly ILogger<WorkerHeartbeatService> _logger;
    public WorkerHeartbeatService(ILogger<WorkerHeartbeatService> logger) => _logger = logger;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("HEARTBEAT: started @ {NowUtc:o}", DateTime.UtcNow);

        var timer = new PeriodicTimer(TimeSpan.FromSeconds(30));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            _logger.LogInformation("HEARTBEAT: alive @ {NowUtc:o}", DateTime.UtcNow);
        }
    }
}
