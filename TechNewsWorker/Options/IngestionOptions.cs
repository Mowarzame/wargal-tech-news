namespace TechNewsWorker.Options
{
    public sealed class IngestionOptions
    {
        // Backward compatibility
        public int RssTickMinutes { get; set; } = 2;
        public int YouTubeTickMinutes { get; set; } = 2;

        // New: seconds precision
        public int? RssTickSeconds { get; set; }
        public int? YouTubeTickSeconds { get; set; }

        public int MaxSourcesPerRun { get; set; } = 50;
        public int MaxItemsPerSource { get; set; } = 25;

        // ✅ Used by BOTH RSS & YouTube services for parallel execution
        public int MaxParallelFetches { get; set; } = 3;

        private const int MinRssSeconds = 10;     // RSS can be frequent but keep sane
        private const int MinYouTubeSeconds = 60; // YouTube quota protection baseline

        public TimeSpan GetRssInterval()
        {
            var seconds = RssTickSeconds ?? (RssTickMinutes * 60);
            if (seconds < MinRssSeconds) seconds = MinRssSeconds;
            return TimeSpan.FromSeconds(seconds);
        }

        public TimeSpan GetYouTubeInterval()
        {
            var seconds = YouTubeTickSeconds ?? (YouTubeTickMinutes * 60);
            if (seconds < MinYouTubeSeconds) seconds = MinYouTubeSeconds;
            return TimeSpan.FromSeconds(seconds);
        }
    }
}