namespace TechNewsApi.Dtos
{
    public class PostLikeDto
    {
        public Guid Id { get; set; }
        public Guid UserId { get; set; }
        public bool IsLike { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
