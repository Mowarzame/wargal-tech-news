namespace TechNewsWorker.Options
{
    public sealed class YouTubeOptions
    {
        public int MaxResults { get; set; } = 10;

        // Gentle spacing between YouTube RSS requests
        public int MinDelayBetweenRequestsMs { get; set; } = 1500;

        // Consecutive requests per cycle should remain low
        public int MaxChannelsPerRun { get; set; } = 10;

        // 404 / unavailable / transient backoff handled in service using this as a base
        public int ThrottleBackoffMinutes { get; set; } = 15;

        // Safety switch: use RSS only, never Data API
        public bool UseRssOnly { get; set; } = true;
    }
}