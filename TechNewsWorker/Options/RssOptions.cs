namespace TechNewsWorker.Options
{
    public sealed class RssOptions
    {
        public int RequestTimeoutSeconds { get; set; } = 20;
        public string UserAgent { get; set; } = "WargalTechNewsBot/1.0";
    }
}