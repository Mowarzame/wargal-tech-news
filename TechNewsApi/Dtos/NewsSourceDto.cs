using TechNewsCore.Models;

namespace TechNewsApi.Dtos
{
     public class NewsSourceDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public NewsSourceType Type { get; set; }

        public string? WebsiteUrl { get; set; }
        public string? RssUrl { get; set; }
        public string? YouTubeChannelId { get; set; }
        public string? YouTubeUploadsPlaylistId { get; set; }

        public string? IconUrl { get; set; }
        public string? Category { get; set; }
        public string? Language { get; set; }
        public string? Country { get; set; }

        public short TrustLevel { get; set; }
        public bool IsActive { get; set; }

        public DateTime? LastFetchedAt { get; set; }
        public DateTime? NextFetchAt { get; set; }
        public int FetchIntervalMinutes { get; set; }
        public int ErrorCount { get; set; }
        public string? LastError { get; set; }
    }


    
}
