namespace TechNewsWorker.Options
{
    public sealed class YouTubeOptions
    {
 

        // Still used as a generic limit for how many items we take per run (applies to RSS too)
        public int MaxResults { get; set; } = 10;

        // When YouTube starts throttling (HTTP 429 / 503), wait this long before retrying that source
        public int ThrottleBackoffMinutes { get; set; } = 10;

        // Gentle spacing between requests to YouTube feeds (rate-limit friendly)
        public int MinDelayBetweenRequestsMs { get; set; } = 500;
    }
}