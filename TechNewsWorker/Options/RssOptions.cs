namespace TechNewsWorker.Options
{
    public sealed class RssOptions
    {
        public int RequestTimeoutSeconds { get; set; } = 20;

        public string UserAgent { get; set; } =
            "Mozilla/5.0 (compatible; WargalNewsBot/1.0; +https://www.wargalnews.com)";

        public int MaxRetriesPerRequest { get; set; } = 1;

        public int DelayBetweenRequestsMs { get; set; } = 250;
    }
}