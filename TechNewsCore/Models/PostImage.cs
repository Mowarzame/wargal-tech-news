using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace TechNewsCore.Models
{
    [Index(nameof(PostId), nameof(SortOrder))]
    public class PostImage
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public Guid Id { get; set; }

        [Required]
        public Guid PostId { get; set; }

        public Post Post { get; set; } = null!;

        [Required]
        public string ImageUrl { get; set; } = null!;

        public int SortOrder { get; set; }
    }
}