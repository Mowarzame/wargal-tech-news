using TechNewsCore.Models;

namespace TechNewsApi.Dtos
{
     public class NewsSourceCreateDto
    {
        public string Name { get; set; } = string.Empty;
        public NewsSourceType Type { get; set; }

        public string? WebsiteUrl { get; set; }
        public string? RssUrl { get; set; }
        public string? YouTubeChannelId { get; set; }

        public string? IconUrl { get; set; }
        public string? Category { get; set; }
        public string? Language { get; set; }
        public string? Country { get; set; }

        public short TrustLevel { get; set; } = 0;
        public int FetchIntervalMinutes { get; set; } = 30;
        public bool IsActive { get; set; } = true;
    }
}
