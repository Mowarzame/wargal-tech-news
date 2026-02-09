using AutoMapper;
using Microsoft.EntityFrameworkCore;
using TechNewsApi.Data;
using TechNewsApi.Dtos;
using TechNewsApi.Repositories.Interfaces;
using TechNewsCore.Helpers;
using TechNewsCore.Models;

namespace TechNewsApi.Repositories
{
    public class NewsSourceRepository : INewsSourceRepository
    {
        private readonly AppDbContext _db;
        private readonly IMapper _mapper;

        public NewsSourceRepository(AppDbContext db, IMapper mapper)
        {
            _db = db;
            _mapper = mapper;
        }

        public async Task<ServiceResponse<List<NewsSourceDto>>> GetAsync(bool includeInactive = false)
        {
            var q = _db.NewsSources.AsNoTracking().AsQueryable();
            if (!includeInactive) q = q.Where(s => s.IsActive);

            var list = await q.OrderBy(s => s.Name).ToListAsync();
            return new ServiceResponse<List<NewsSourceDto>>
            {
                Success = true,
                Data = _mapper.Map<List<NewsSourceDto>>(list)
            };
        }

        public async Task<ServiceResponse<NewsSourceDto>> GetByIdAsync(Guid id)
        {
            var src = await _db.NewsSources.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
            if (src == null)
                return new ServiceResponse<NewsSourceDto> { Success = false, Message = "Source not found." };

            return new ServiceResponse<NewsSourceDto> { Success = true, Data = _mapper.Map<NewsSourceDto>(src) };
        }

        public async Task<ServiceResponse<NewsSourceDto>> CreateAsync(NewsSourceCreateDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Name))
                return new ServiceResponse<NewsSourceDto> { Success = false, Message = "Name is required." };

            if (dto.Type == NewsSourceType.RssWebsite && string.IsNullOrWhiteSpace(dto.RssUrl))
                return new ServiceResponse<NewsSourceDto> { Success = false, Message = "RssUrl is required for RSS sources." };

            if (dto.Type == NewsSourceType.YouTubeChannel && string.IsNullOrWhiteSpace(dto.YouTubeChannelId))
                return new ServiceResponse<NewsSourceDto> { Success = false, Message = "YouTubeChannelId is required for YouTube sources." };

            var entity = new NewsSource
            {
                Id = Guid.NewGuid(),
                Name = dto.Name.Trim(),
                Type = dto.Type,
                WebsiteUrl = dto.WebsiteUrl?.Trim(),
                RssUrl = dto.RssUrl?.Trim(),
                YouTubeChannelId = dto.YouTubeChannelId?.Trim(),
                IconUrl = dto.IconUrl?.Trim(),
                Category = dto.Category?.Trim(),
                Language = dto.Language?.Trim(),
                Country = dto.Country?.Trim(),
                TrustLevel = dto.TrustLevel,
                FetchIntervalMinutes = dto.FetchIntervalMinutes <= 0 ? 30 : dto.FetchIntervalMinutes,
                IsActive = dto.IsActive,
                ErrorCount = 0,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                NextFetchAt = null // due immediately
            };

            _db.NewsSources.Add(entity);

            try
            {
                await _db.SaveChangesAsync();
            }
            catch (DbUpdateException ex)
            {
                return new ServiceResponse<NewsSourceDto> { Success = false, Message = ex.InnerException?.Message ?? ex.Message };
            }

            return new ServiceResponse<NewsSourceDto>
            {
                Success = true,
                Data = _mapper.Map<NewsSourceDto>(entity)
            };
        }

        public async Task<ServiceResponse<NewsSourceDto>> UpdateAsync(Guid id, NewsSourceCreateDto dto)
        {
            var src = await _db.NewsSources.FirstOrDefaultAsync(x => x.Id == id);
            if (src == null)
                return new ServiceResponse<NewsSourceDto> { Success = false, Message = "Source not found." };

            src.Name = string.IsNullOrWhiteSpace(dto.Name) ? src.Name : dto.Name.Trim();
            src.Type = dto.Type;

            src.WebsiteUrl = dto.WebsiteUrl?.Trim();
            src.RssUrl = dto.RssUrl?.Trim();
            src.YouTubeChannelId = dto.YouTubeChannelId?.Trim();

            src.IconUrl = dto.IconUrl?.Trim();
            src.Category = dto.Category?.Trim();
            src.Language = dto.Language?.Trim();
            src.Country = dto.Country?.Trim();

            src.TrustLevel = dto.TrustLevel;
            src.FetchIntervalMinutes = dto.FetchIntervalMinutes <= 0 ? src.FetchIntervalMinutes : dto.FetchIntervalMinutes;
            src.IsActive = dto.IsActive;
            src.UpdatedAt = DateTime.UtcNow;

            await _db.SaveChangesAsync();

            return new ServiceResponse<NewsSourceDto> { Success = true, Data = _mapper.Map<NewsSourceDto>(src) };
        }

        public async Task<ServiceResponse<bool>> SetActiveAsync(Guid id, bool isActive)
        {
            var src = await _db.NewsSources.FirstOrDefaultAsync(x => x.Id == id);
            if (src == null)
                return new ServiceResponse<bool> { Success = false, Message = "Source not found." };

            src.IsActive = isActive;
            src.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            return new ServiceResponse<bool> { Success = true, Data = true };
        }

        public async Task<ServiceResponse<bool>> ForceDueAsync(Guid id)
        {
            var src = await _db.NewsSources.FirstOrDefaultAsync(x => x.Id == id);
            if (src == null)
                return new ServiceResponse<bool> { Success = false, Message = "Source not found." };

            src.NextFetchAt = null;
            src.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            return new ServiceResponse<bool> { Success = true, Data = true };
        }
    }
}
