using AutoMapper;
using Microsoft.EntityFrameworkCore;
using TechNewsApi.Data;
using TechNewsApi.Dtos;
using TechNewsCore.Helpers;
using TechNewsCore.Models;
using TechNewsApi.Repositories.Interfaces;

namespace TechNewsApi.Repositories
{
    public class UserRepository : IUserRepository
    {
        private readonly AppDbContext _context;
        private readonly IMapper _mapper;

        public UserRepository(AppDbContext context, IMapper mapper)
        {
            _context = context;
            _mapper = mapper;
        }

        public async Task<ServiceResponse<UserDto>> GetUserByIdAsync(Guid id)
        {
            var response = new ServiceResponse<UserDto>();
            var user = await _context.Users.FindAsync(id);

            if (user == null)
            {
                response.Success = false;
                response.Message = "User not found.";
                return response;
            }

            response.Data = _mapper.Map<UserDto>(user);
            return response;
        }

        public async Task<ServiceResponse<UserDto>> GetUserByEmailAsync(string email)
        {
            var response = new ServiceResponse<UserDto>();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == email.ToLower());

            if (user == null)
            {
                response.Success = false;
                response.Message = "User not found.";
                return response;
            }

            response.Data = _mapper.Map<UserDto>(user);
            return response;
        }

        public async Task<ServiceResponse<UserDto>> CreateUserAsync(UserLoginDto userLoginDto)
        {
            var response = new ServiceResponse<UserDto>();

            try
            {
                // Check if user already exists
                var existingUser = await _context.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == userLoginDto.Email.ToLower());
                if (existingUser != null)
                {
                    response.Data = _mapper.Map<UserDto>(existingUser);
                    response.Message = "User already exists.";
                    return response;
                }

                var user = _mapper.Map<User>(userLoginDto);
                user.Id = Guid.NewGuid();
                user.CreatedAt = DateTime.UtcNow;

                _context.Users.Add(user);
                await _context.SaveChangesAsync();

                response.Data = _mapper.Map<UserDto>(user);
                response.Message = "User created successfully.";
            }
            catch (Exception ex)
            {
                response.Success = false;
                response.Message = ex.Message;
            }

            return response;
        }

        public async Task<ServiceResponse<bool>> AssignRoleAsync(Guid userId, string role)
{
    var response = new ServiceResponse<bool>();

    if (role != Roles.Admin && role != Roles.Editor && role != Roles.User)
    {
        response.Success = false;
        response.Message = "Invalid role";
        return response;
    }

    var user = await _context.Users.FindAsync(userId);
    if (user == null)
    {
        response.Success = false;
        response.Message = "User not found";
        return response;
    }

    user.Role = role;
    await _context.SaveChangesAsync();

    response.Data = true;
    response.Message = "Role updated successfully";
    return response;
}

    }
}
