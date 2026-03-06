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

        // RSS can use small parallelism. Keep YouTube effectively serial in service.
        public int MaxParallelFetches { get; set; } = 2;

        // Per-category scheduling
        public int NewsFetchIntervalSeconds { get; set; } = 30;
        public int DefaultFetchIntervalSeconds { get; set; } = 60;
        public int YouTubeFetchIntervalSeconds { get; set; } = 120;

        // Backoff for failing sources
        public int ErrorBackoffMinutes { get; set; } = 10;
        public int NotFoundBackoffHours { get; set; } = 12;

        private const int MinRssSeconds = 10;
        private const int MinYouTubeSeconds = 10;
        private const int MinSourceIntervalSeconds = 10;

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

        public TimeSpan GetNewsFetchInterval()
        {
            var seconds = NewsFetchIntervalSeconds;
            if (seconds < MinSourceIntervalSeconds) seconds = MinSourceIntervalSeconds;
            return TimeSpan.FromSeconds(seconds);
        }

        public TimeSpan GetDefaultFetchInterval()
        {
            var seconds = DefaultFetchIntervalSeconds;
            if (seconds < MinSourceIntervalSeconds) seconds = MinSourceIntervalSeconds;
            return TimeSpan.FromSeconds(seconds);
        }

        public TimeSpan GetYouTubeSourceFetchInterval()
        {
            var seconds = YouTubeFetchIntervalSeconds;
            if (seconds < MinSourceIntervalSeconds) seconds = MinSourceIntervalSeconds;
            return TimeSpan.FromSeconds(seconds);
        }

        public TimeSpan GetErrorBackoff()
        {
            var minutes = ErrorBackoffMinutes <= 0 ? 10 : ErrorBackoffMinutes;
            return TimeSpan.FromMinutes(minutes);
        }

        public TimeSpan GetNotFoundBackoff()
        {
            var hours = NotFoundBackoffHours <= 0 ? 12 : NotFoundBackoffHours;
            return TimeSpan.FromHours(hours);
        }
    }
}