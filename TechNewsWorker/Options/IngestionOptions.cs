namespace TechNewsWorker.Options;

public sealed class IngestionOptions
{
    // IMPORTANT:
    // TickSeconds = how often the worker "checks for due sources".
    // The real per-source schedule is stored in DB: FetchIntervalSeconds -> NextFetchAt.

    // Keep ticks small so 30-second schedules are actually respected.
    public int RssTickSeconds { get; set; } = 5;
    public int YouTubeTickSeconds { get; set; } = 5;

    // Limits
    public int MaxSourcesPerRun { get; set; } = 50;
    public int MaxItemsPerSource { get; set; } = 50;

    // Paging safety caps
    public int MaxYouTubePagesPerSource { get; set; } = 5;

    // Fix for "missing items":
    // Only stop paging when we see many consecutive known items (not just one).
    public int KnownStopThreshold { get; set; } = 25;

    public TimeSpan GetRssTickInterval()
    {
        var sec = Math.Clamp(RssTickSeconds, 2, 60);
        return TimeSpan.FromSeconds(sec);
    }

    public TimeSpan GetYouTubeTickInterval()
    {
        var sec = Math.Clamp(YouTubeTickSeconds, 2, 60);
        return TimeSpan.FromSeconds(sec);
    }
}