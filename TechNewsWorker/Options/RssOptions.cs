namespace TechNewsWorker.Options
{
    public sealed class RssOptions
    {
        public int RequestTimeoutSeconds { get; set; } = 20;

        public string UserAgent { get; set; } =
            "Mozilla/5.0 (compatible; WargalNewsWorker/1.0; +https://wargalnews.com)";
    }
}