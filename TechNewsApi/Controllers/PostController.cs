using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TechNewsApi.Dtos;
using TechNewsCore.Helpers;
using TechNewsApi.Repositories.Interfaces;

namespace TechNewsApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class PostsController : ControllerBase
    {
        private readonly IPostRepository _postRepository;

        public PostsController(IPostRepository postRepository)
        {
            _postRepository = postRepository;
        }

        // =========================
        // GET ALL POSTS
        // =========================
        [HttpGet]
        public async Task<IActionResult> GetAllPosts()
        {
            var result = await _postRepository.GetAllPostsAsync();

            if (!result.Success)
                return StatusCode(500, result);

            return Ok(result);
        }

        [Authorize]
[HttpGet("mine")]
public async Task<IActionResult> GetMyPosts()
{
    var result = await _postRepository.GetMyPostsAsync();
    return result.Success ? Ok(result) : BadRequest(result);
}


        [Authorize(Roles = Roles.Admin)]
[HttpGet("all")]
public async Task<IActionResult> GetAllPostsForAdmin()
{
    var result = await _postRepository.GetAllPostsForAdminAsync();
    return result.Success ? Ok(result) : BadRequest(result);
}

        // =========================
        // GET POST BY ID
        // =========================
        [HttpGet("{id:guid}")]
        public async Task<IActionResult> GetPostById(Guid id)
        {
            var result = await _postRepository.GetPostByIdAsync(id);

            if (!result.Success)
                return NotFound(result);

            return Ok(result);
        }
        [Authorize(Roles = Roles.Admin)]
[HttpPut("unverify/{id:guid}")]
public async Task<IActionResult> UnverifyPost(Guid id)
{
    var result = await _postRepository.UnverifyPostAsync(id);
    return result.Success ? Ok(result) : BadRequest(result);
}

        // =========================
        // CREATE POST
        // =========================
        [Authorize]
        [HttpPost]
        public async Task<IActionResult> CreatePost([FromBody] PostCreateDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var result = await _postRepository.CreatePostAsync(dto);

            if (!result.Success)
                return StatusCode(500, result);

            return CreatedAtAction(
                nameof(GetPostById),
                new { id = result.Data!.Id },
                result
            );
        }

        // =========================
        // UPDATE POST
        // =========================
        [Authorize]
        [HttpPut("{id:guid}")]
        public async Task<IActionResult> UpdatePost(Guid id, [FromBody] PostCreateDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var result = await _postRepository.UpdatePostAsync(id, dto);

            if (!result.Success)
                return NotFound(result);

            return Ok(result);
        }

        // =========================
        // DELETE POST
        // =========================
        [Authorize]
        [HttpDelete("{id:guid}")]
        public async Task<IActionResult> DeletePost(Guid id)
        {
            var result = await _postRepository.DeletePostAsync(id);

            if (!result.Success)
                return NotFound(result);

            return Ok(result);
        }

        [Authorize]
        [HttpPut("verify/{id:guid}")]
        public async Task<IActionResult> VerifyPost(Guid id)
        {
            var result = await _postRepository.VerifyPostAsync(id);
            return result.Success ? Ok(result) : BadRequest(result);
        }
        [Authorize]
        [HttpPost("with-image")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> CreatePostWithImage([FromForm] PostCreateFormDto dto)
        {
            var result = await _postRepository.CreatePostWithImageAsync(dto);

            if (!result.Success)
                return StatusCode(500, result);

            return CreatedAtAction(nameof(GetPostById), new { id = result.Data!.Id }, result);
        }

        [Authorize(Roles = Roles.Admin)]
        [HttpGet("pending")]
        public async Task<IActionResult> GetPendingPosts()
        {
            var result = await _postRepository.GetPendingPostsAsync();
            return result.Success ? Ok(result) : BadRequest(result);
        }


        [Authorize]
        [HttpGet("me")]
        public IActionResult Me()
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var role = User.FindFirst(ClaimTypes.Role)?.Value;
            var email = User.FindFirst(ClaimTypes.Email)?.Value;

            return Ok(new { userId, role, email });
        }


    }
}
