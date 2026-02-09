using Microsoft.AspNetCore.Http;

namespace TechNewsApi.Dtos
{
    public class PostCreateFormDto
    {
        public string Title { get; set; } = default!;
        public string Content { get; set; } = default!;
        public string? VideoUrl { get; set; }

        // Field name must match Flutter Multipart key: "Image"
        public IFormFile? Image { get; set; }
    }
}
