namespace TechNewsWorker.Options
{
    public sealed class YouTubeOptions
    {
        public int MaxResults { get; set; } = 10;

        // Gentle spacing between requests to YouTube feeds
        public int MinDelayBetweenRequestsMs { get; set; } = 500;

        // Kept for backward compatibility (not required by RSS mode)
        public int ThrottleBackoffMinutes { get; set; } = 10;
    }
}