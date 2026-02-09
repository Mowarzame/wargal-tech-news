namespace TechNewsApi.Dtos
{
    public class PostDto
    {
        public Guid Id { get; set; }
        public string Title { get; set; } = null!;
        public string? Content { get; set; }
        public string? ImageUrl { get; set; }
        public string? VideoUrl { get; set; }
        public UserDto User { get; set; } = null!;
        public DateTime CreatedAt { get; set; }
        public bool IsVerified { get; set; }
        public int Likes { get; set; }
        public int Dislikes { get; set; }
        public bool? MyReaction { get; set; } // true/false/null
        public int CommentsCount { get; set; }



    }

    public class PostCreateDto
    {
        public string Title { get; set; } = null!;
        public string? Content { get; set; }
        public string? ImageUrl { get; set; }
        public string? VideoUrl { get; set; }
        public Guid UserId { get; set; }
    }
}
