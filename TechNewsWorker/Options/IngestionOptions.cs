namespace TechNewsWorker.Options
{
    public sealed class IngestionOptions
    {
        public int RssTickMinutes { get; set; } = 2;
        public int YouTubeTickMinutes { get; set; } = 2;

        public int? RssTickSeconds { get; set; }
        public int? YouTubeTickSeconds { get; set; }

        public int MaxSourcesPerRun { get; set; } = 50;
        public int MaxItemsPerSource { get; set; } = 10;

        // Still used for RSS. YouTube service will FORCE parallel=1 for safety.
        public int MaxParallelFetches { get; set; } = 2;

        private const int MinRssSeconds = 10;
        private const int MinYouTubeSeconds = 10;

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