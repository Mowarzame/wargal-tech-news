using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TechNewsApi.Dtos;
using TechNewsApi.Repositories.Interfaces;

namespace TechNewsApi.Controllers
{
    [ApiController]
    [Route("api/posts/{postId:guid}/reactions")]
    [Authorize]
    public class PostLikesController : ControllerBase
    {
        private readonly IPostLikeRepository _repo;

        public PostLikesController(IPostLikeRepository repo)
        {
            _repo = repo;
        }

        // GET /api/posts/{postId}/reactions
        [HttpGet]
        public async Task<IActionResult> GetSummary(Guid postId)
        {
            var res = await _repo.GetSummaryAsync(postId);
            return res.Success ? Ok(res) : BadRequest(res);
        }

        // PUT /api/posts/{postId}/reactions
        // Body: { "isLike": true | false | null }
        [HttpPut]
        public async Task<IActionResult> React(Guid postId, [FromBody] PostReactionDto dto)
        {
            var res = await _repo.ReactAsync(postId, dto.IsLike);
            return res.Success ? Ok(res) : BadRequest(res);
        }

        // GET /api/posts/{postId}/reactions/users
        [HttpGet("users")]
        public async Task<IActionResult> GetUsers(Guid postId)
        {
            var res = await _repo.GetReactionsAsync(postId);
            return res.Success ? Ok(res) : BadRequest(res);
        }

    }
}
