using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TechNewsApi.Dtos;
using TechNewsCore.Models;
using TechNewsApi.Helpers;
using TechNewsApi.Repositories.Interfaces;
using TechNewsCore.Helpers;
using System.Security.Claims;
namespace TechNewsApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class UsersController : ControllerBase
    {
        private readonly IUserRepository _userRepository;
        private readonly JwtTokenGenerator _jwt;

        public UsersController(IUserRepository userRepository, JwtTokenGenerator jwt)
        {
            _userRepository = userRepository;
            _jwt = jwt;
        }

        // =========================
        // GET USER BY ID
        // =========================
        [Authorize]
        [HttpGet("{id:guid}")]
        public async Task<IActionResult> GetUserById(Guid id)
        {
            var result = await _userRepository.GetUserByIdAsync(id);

            if (!result.Success)
                return NotFound(result);

            return Ok(result);
        }

        [Authorize(Roles = Roles.Admin)]
        [HttpPut("assign-role/{userId}")]
        public async Task<IActionResult> AssignRole(Guid userId, [FromQuery] string role)
        {
            var result = await _userRepository.AssignRoleAsync(userId, role);
            return result.Success ? Ok(result) : BadRequest(result);
        }


        // =========================
        // LOGIN / CREATE USER
        // =========================
        [HttpPost("login-google")]
        public async Task<IActionResult> LoginGoogle([FromBody] UserLoginDto loginDto)
        {
            var result = await _userRepository.CreateUserAsync(loginDto);

            if (!result.Success)
                return BadRequest(result);

            // Generate JWT token
            var token = _jwt.GenerateToken(new TechNewsCore.Models.User
            {
                Id = result.Data!.Id,
                Email = result.Data.Email,
                Name = result.Data.Name,
                Role = result.Data.Role,
                
            });

            return Ok(new
            {
                token,
                user = result.Data
            });
        }


             // ✅ NEW: GET CURRENT USER (ME)
        [Authorize]
        [HttpGet("me")]
        public async Task<IActionResult> Me()
        {
            // You likely store the user id in the JWT as ClaimTypes.NameIdentifier or "id"
            var idStr =
                User.FindFirstValue(ClaimTypes.NameIdentifier) ??
                User.FindFirstValue("id") ??
                User.FindFirstValue("sub");

            if (string.IsNullOrWhiteSpace(idStr) || !Guid.TryParse(idStr, out var userId))
                return Unauthorized(new ServiceResponse<string>
                {
                    Success = false,
                    Message = "Invalid token user id."
                });

            var result = await _userRepository.GetUserByIdAsync(userId);
            return result.Success ? Ok(result) : NotFound(result);
        }

    }
}
