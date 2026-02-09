using TechNewsCore.Helpers;

namespace TechNewsApi.Dtos
{
    public class UserDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = null!;
        public string Email { get; set; } = null!;
        public string? ProfilePictureUrl { get; set; }
        public string   Role { get; set; } = Roles.User;

    }

    public class UserLoginDto
    {
        public string Name { get; set; } = null!;
        public string Email { get; set; } = null!;
        public string? ProfilePictureUrl { get; set; }
    }
}
