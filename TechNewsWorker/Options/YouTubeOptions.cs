namespace TechNewsWorker.Options
{
    public sealed class YouTubeOptions
    {
        // How many sources we pick per run (queue size)
        public int MaxSourcesPerRun { get; set; } = 25;

        // Friendly pacing between YouTube requests (global across the worker instance)
        public int MinDelayBetweenRequestsMs { get; set; } = 2000;

        // Random jitter added to scheduling (seconds)
        public int ScheduleJitterMaxSeconds { get; set; } = 10;

        // When YouTube throttles (429/503/502), cooldown this many minutes for that source
        public int ThrottleBackoffMinutes { get; set; } = 5;

        // If a source keeps failing repeatedly, clamp backoff so we still retry “soon”
        public int MaxBackoffMinutes { get; set; } = 10;

        // Timeout per YouTube request
        public int RequestTimeoutSeconds { get; set; } = 20;

        // User-Agent to avoid “generic bot” fingerprint
        public string UserAgent { get; set; } =
            "Mozilla/5.0 (compatible; WargalNewsWorker/1.0; +https://wargalnews.com)";
    }
}