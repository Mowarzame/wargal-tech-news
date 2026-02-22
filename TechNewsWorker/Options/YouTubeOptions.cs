namespace TechNewsWorker.Options
{
    public sealed class YouTubeOptions
    {
        public string ApiKey { get; set; } = string.Empty;

        // ✅ Limit results to reduce quota usage
        public int MaxResults { get; set; } = 10;

        // ✅ When quota is exceeded, pause YouTube ingestion for this long
        public int QuotaCooldownMinutes { get; set; } = 360; // 6 hours
    }
}