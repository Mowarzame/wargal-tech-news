using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

namespace TechNewsCore.Models
{
    public enum FeedItemKind : short
    {
        Article = 1,
        Video = 2
    }

    [Index(nameof(PublishedAt))]
    [Index(nameof(SourceId))]
// FeedItem.cs
public class FeedItem
{
    public Guid Id { get; set; }

    public Guid SourceId { get; set; }
    public NewsSource Source { get; set; } = null!;

    public string ExternalId { get; set; } = string.Empty;
    public FeedItemKind Kind { get; set; }

    public string Title { get; set; } = string.Empty;
    public string? Summary { get; set; }

    public string LinkUrl { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }

    // ✅ CHANGE THIS
    public DateTimeOffset PublishedAt { get; set; }

    // ✅ CHANGE THIS
    public DateTimeOffset ImportedAt { get; set; } = DateTimeOffset.UtcNow;

    public string? Author { get; set; }

    public string? YouTubeVideoId { get; set; }
    public string? EmbedUrl { get; set; }

    public bool IsActive { get; set; } = true;
}

}
