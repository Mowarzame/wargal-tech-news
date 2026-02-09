using System.ComponentModel.DataAnnotations;

namespace TechNewsApi.Dtos
{
    public class CommentDto
    {
        public Guid Id { get; set; }
        public Guid PostId { get; set; }

        public Guid UserId { get; set; }
        public string UserName { get; set; } = string.Empty;
        public string? UserPhotoUrl { get; set; }

        public string Content { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
    }

     public class CommentCreateDto
    {
        [Required]
        [MaxLength(1000)]
        public string Content { get; set; } = string.Empty;
    }
}
