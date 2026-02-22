using System;

namespace TechNewsWorker.Options
{
    public sealed class IngestionOptions
    {
        // Backward compatibility (existing deployments)
        public int RssTickMinutes { get; set; } = 2;
        public int YouTubeTickMinutes { get; set; } = 2;

        // New: seconds precision
        public int? RssTickSeconds { get; set; }
        public int? YouTubeTickSeconds { get; set; }

        // Scheduling / load control
        public int MaxSourcesPerRun { get; set; } = 50;
        public int MaxItemsPerSource { get; set; } = 25;

        // ✅ NEW: parallelism cap per RunOnce (prevents “skipping/starvation”)
        public int MaxParallelFetches { get; set; } = 5;

        private const int MinRssSeconds = 5;
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