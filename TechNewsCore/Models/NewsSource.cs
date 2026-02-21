using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

namespace TechNewsCore.Models
{
    public enum NewsSourceType : short
    {
        RssWebsite = 1,
        YouTubeChannel = 2,
        InternalPosts = 3
    }

    [Index(nameof(Type))]
    [Index(nameof(IsActive))]
    public class NewsSource
    {
        [Key]
        public Guid Id { get; set; }

        [Required, MaxLength(200)]
        public string Name { get; set; } = string.Empty;

        [Required]
        public NewsSourceType Type { get; set; }

        [MaxLength(500)]
        public string? WebsiteUrl { get; set; }

        [MaxLength(800)]
        public string? RssUrl { get; set; }

        [MaxLength(100)]
        public string? YouTubeChannelId { get; set; }

        [MaxLength(100)]
        public string? YouTubeUploadsPlaylistId { get; set; }

        [MaxLength(800)]
        public string? IconUrl { get; set; }

        [MaxLength(100)]
        public string? Category { get; set; }

        [MaxLength(10)]
        public string? Language { get; set; }

        [MaxLength(10)]
        public string? Country { get; set; }

        public short TrustLevel { get; set; } = 0;
        public bool IsActive { get; set; } = true;

        // ✅ NEW (preferred): per-source interval in seconds
        public int FetchIntervalSeconds { get; set; } = 60;

        // ✅ Legacy (keep for now, do not remove yet)
        public int FetchIntervalMinutes { get; set; } = 30;

        public string? LastEtag { get; set; }
        public string? LastModified { get; set; }

        public string? Cursor { get; set; }

        public int ErrorCount { get; set; } = 0;
        public string? LastError { get; set; }

        public DateTimeOffset? LastFetchedAt { get; set; }
        public DateTimeOffset? NextFetchAt { get; set; }
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
        public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

        public ICollection<FeedItem> FeedItems { get; set; } = new List<FeedItem>();
    }
}