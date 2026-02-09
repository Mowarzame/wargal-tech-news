using TechNewsCore.Helpers;
using TechNewsApi.Dtos;

namespace TechNewsApi.Repositories.Interfaces
{
    public interface IUserRepository
    {
        Task<ServiceResponse<UserDto>> GetUserByIdAsync(Guid id);
        Task<ServiceResponse<UserDto>> GetUserByEmailAsync(string email);
        Task<ServiceResponse<UserDto>> CreateUserAsync(UserLoginDto userLoginDto);
        Task<ServiceResponse<bool>> AssignRoleAsync(Guid userId, string role);

    }
}
