using TechNewsCore.Models;

namespace TechNewsApi.Dtos
{
    public class FeedItemDto
    {
        public Guid Id { get; set; }
        public Guid SourceId { get; set; }
        public string SourceName { get; set; } = string.Empty;
        public string? SourceIconUrl { get; set; }

        public FeedItemKind Kind { get; set; }
        public string Title { get; set; } = string.Empty;
        public string? Summary { get; set; }

        public string LinkUrl { get; set; } = string.Empty;
        public string? ImageUrl { get; set; }

          // ✅ CHANGE THIS
    public DateTimeOffset PublishedAt { get; set; }

        public string? YouTubeVideoId { get; set; }
        public string? EmbedUrl { get; set; }
    }
}
