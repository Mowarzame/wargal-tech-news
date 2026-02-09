namespace TechNewsApi.Dtos
{
    // IsLike:
    // true  => like
    // false => dislike
    // null  => remove reaction (undo)
    public class PostReactionDto
    {
        public bool? IsLike { get; set; }
    }

    public class PostLikeSummaryDto
    {
        public int Likes { get; set; }
        public int Dislikes { get; set; }
        public bool? MyReaction { get; set; } // true=like, false=dislike, null=none
    }

        public class PostReactionUserDto
    {
        public Guid UserId { get; set; }
        public string UserName { get; set; } = string.Empty;
        public string? UserPhotoUrl { get; set; }
        public bool IsLike { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
