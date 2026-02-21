using System;

namespace TechNewsWorker.Options
{
    public sealed class IngestionOptions
    {
        // Backward compatibility (Render already has these)
        public int RssTickMinutes { get; set; } = 2;
        public int YouTubeTickMinutes { get; set; } = 2;

        // New: seconds precision (Render will use these)
        public int? RssTickSeconds { get; set; }
        public int? YouTubeTickSeconds { get; set; }

        public int MaxSourcesPerRun { get; set; } = 20;
        public int MaxItemsPerSource { get; set; } = 25;

        private const int MinRssSeconds = 5;
        private const int MinYouTubeSeconds = 10;

        public TimeSpan GetRssInterval()
        {
            var seconds = RssTickSeconds ?? (RssTickMinutes * 60);
            if (seconds < MinRssSeconds)
                seconds = MinRssSeconds;

            return TimeSpan.FromSeconds(seconds);
        }

        public TimeSpan GetYouTubeInterval()
        {
            var seconds = YouTubeTickSeconds ?? (YouTubeTickMinutes * 60);
            if (seconds < MinYouTubeSeconds)
                seconds = MinYouTubeSeconds;

            return TimeSpan.FromSeconds(seconds);
        }
    }
}