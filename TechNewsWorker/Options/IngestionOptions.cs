namespace TechNewsWorker.Options
{
    public class IngestionOptions
    {
    public int RssTickMinutes { get; set; } = 2;
    public int YouTubeTickMinutes { get; set; } = 2; // ✅
        public int MaxSourcesPerRun { get; set; } = 20;
        public int MaxItemsPerSource { get; set; } = 25;
    }
}
