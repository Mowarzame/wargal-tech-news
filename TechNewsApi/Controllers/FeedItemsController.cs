using Microsoft.AspNetCore.Mvc;
using TechNewsCore.Models;
using TechNewsApi.Repositories.Interfaces;

namespace TechNewsApi.Controllers
{
    [ApiController]
    [Route("api/feed-items")]
    public class FeedItemsController : ControllerBase
    {
        private readonly IFeedItemRepository _repo;
        public FeedItemsController(IFeedItemRepository repo) => _repo = repo;

[HttpGet]
public async Task<IActionResult> Get(
    [FromQuery] int page = 1,
    [FromQuery] int pageSize = 20,
    [FromQuery] FeedItemKind? kind = null,
    [FromQuery] Guid? sourceId = null,
    [FromQuery] string? q = null,
    [FromQuery] bool diverse = false)
{
    var res = await _repo.GetAsync(page, pageSize, kind, sourceId, q, diverse);
    return Ok(res);
}


        [HttpGet("{id:guid}")]
        public async Task<IActionResult> GetById(Guid id)
        {
            var res = await _repo.GetByIdAsync(id);
            return res.Success ? Ok(res) : BadRequest(res);
        }

        [HttpGet("sources")]
        public async Task<IActionResult> Sources()
        {
            var res = await _repo.GetSourcesForUiAsync();
            return Ok(res);
        }
    }
}
