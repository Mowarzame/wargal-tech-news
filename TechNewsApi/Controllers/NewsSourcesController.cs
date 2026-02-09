using Microsoft.AspNetCore.Mvc;
using TechNewsApi.Dtos;
using TechNewsApi.Repositories.Interfaces;

namespace TechNewsApi.Controllers
{
    [ApiController]
    [Route("api/news-sources")]
    public class NewsSourcesController : ControllerBase
    {
        private readonly INewsSourceRepository _repo;
        public NewsSourcesController(INewsSourceRepository repo) => _repo = repo;

        [HttpGet]
        public async Task<IActionResult> Get([FromQuery] bool includeInactive = false)
            => Ok(await _repo.GetAsync(includeInactive));

        [HttpGet("{id:guid}")]
        public async Task<IActionResult> GetById(Guid id)
            => Ok(await _repo.GetByIdAsync(id));

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] NewsSourceCreateDto dto)
        {
            var res = await _repo.CreateAsync(dto);
            return res.Success ? Ok(res) : BadRequest(res);
        }

        [HttpPut("{id:guid}")]
        public async Task<IActionResult> Update(Guid id, [FromBody] NewsSourceCreateDto dto)
        {
            var res = await _repo.UpdateAsync(id, dto);
            return res.Success ? Ok(res) : BadRequest(res);
        }

        [HttpPatch("{id:guid}/active")]
        public async Task<IActionResult> SetActive(Guid id, [FromQuery] bool isActive)
        {
            var res = await _repo.SetActiveAsync(id, isActive);
            return res.Success ? Ok(res) : BadRequest(res);
        }

        [HttpPatch("{id:guid}/force-due")]
        public async Task<IActionResult> ForceDue(Guid id)
        {
            var res = await _repo.ForceDueAsync(id);
            return res.Success ? Ok(res) : BadRequest(res);
        }
    }
}
