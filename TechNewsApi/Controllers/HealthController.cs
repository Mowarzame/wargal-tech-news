using Microsoft.AspNetCore.Mvc;

namespace TechNewsApi.Controllers;

[ApiController]
[Route("health")]
public class HealthController : ControllerBase
{
    [HttpGet]
    public IActionResult Get()
        => Ok(new { status = "ok", service = "TechNewsApi", time = DateTime.UtcNow });
}
