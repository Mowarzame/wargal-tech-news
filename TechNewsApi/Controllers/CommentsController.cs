using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TechNewsApi.Dtos;
using TechNewsApi.Repositories.Interfaces;

namespace TechNewsApi.Controllers
{
    [ApiController]
    [Route("api")]
    [Authorize]
    public class CommentsController : ControllerBase
    {
        private readonly ICommentRepository _comments;

        public CommentsController(ICommentRepository comments)
        {
            _comments = comments;
        }

        [HttpGet("posts/{postId:guid}/comments")]
        public async Task<IActionResult> GetByPostId(Guid postId)
        {
            var res = await _comments.GetByPostIdAsync(postId);
            return res.Success ? Ok(res) : BadRequest(res);
        }

        [HttpPost("posts/{postId:guid}/comments")]
        public async Task<IActionResult> Create(Guid postId, [FromBody] CommentCreateDto dto)
        {
            var res = await _comments.CreateAsync(postId, dto);
            return res.Success ? Ok(res) : BadRequest(res);
        }

        [HttpDelete("comments/{commentId:guid}")]
        public async Task<IActionResult> Delete(Guid commentId)
        {
            var res = await _comments.DeleteAsync(commentId);
            return res.Success ? Ok(res) : BadRequest(res);
        }
    }
}
