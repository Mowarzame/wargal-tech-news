using AutoMapper;
using AutoMapper.QueryableExtensions;
using Microsoft.EntityFrameworkCore;
using TechNewsApi.Data;
using TechNewsApi.Dtos;
using TechNewsApi.Repositories.Interfaces;
using TechNewsCore.Helpers;
using TechNewsCore.Models;

namespace TechNewsApi.Repositories
{
    public class FeedItemRepository : IFeedItemRepository
    {
        private readonly AppDbContext _db;
        private readonly IMapper _mapper;

        public FeedItemRepository(AppDbContext db, IMapper mapper)
        {
            _db = db;
            _mapper = mapper;
        }

public async Task<ServiceResponse<List<FeedItemDto>>> GetAsync(
    int page,
    int pageSize,
    FeedItemKind? kind,
    Guid? sourceId,
    string? q,
    bool diverse = false)
{
    page = page <= 0 ? 1 : page;
    pageSize = pageSize <= 0 ? 20 : Math.Min(pageSize, 50);

    IQueryable<FeedItem> baseQuery = _db.FeedItems.AsNoTracking()
        .Where(x => x.IsActive)
        .Include(x => x.Source);

    if (kind.HasValue)
        baseQuery = baseQuery.Where(x => x.Kind == kind.Value);

    if (sourceId.HasValue)
        baseQuery = baseQuery.Where(x => x.SourceId == sourceId.Value);

    if (!string.IsNullOrWhiteSpace(q))
    {
        var term = q.Trim().ToLower();
        baseQuery = baseQuery.Where(x => x.Title.ToLower().Contains(term));
    }

    // Normal feed (not diverse): standard paging
    if (!diverse)
    {
        var items = await baseQuery
            .OrderByDescending(x => x.PublishedAt)
            .ThenByDescending(x => x.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new FeedItemDto
            {
                Id = x.Id,
                SourceId = x.SourceId,
                SourceName = x.Source.Name,
                SourceIconUrl = x.Source.IconUrl,
                Kind = x.Kind,
                Title = x.Title,
                Summary = x.Summary,
                LinkUrl = x.LinkUrl,
                ImageUrl = x.ImageUrl,
                PublishedAt = x.PublishedAt,
                YouTubeVideoId = x.YouTubeVideoId,
                EmbedUrl = x.EmbedUrl
            })
            .ToListAsync();

        return new ServiceResponse<List<FeedItemDto>> { Data = items, Success = true };
    }

    // ✅ DIVERSE FEED (EF-only, reliable)
    // Pull a "recent window" then group in memory to pick 1 latest per source.
    const int windowSize = 800; // tune if needed (500-2000 usually fine)

    var recent = await baseQuery
        .OrderByDescending(x => x.PublishedAt)
        .ThenByDescending(x => x.Id)
        .Take(windowSize)
        .Select(x => new FeedItemDto
        {
            Id = x.Id,
            SourceId = x.SourceId,
            SourceName = x.Source.Name,
            SourceIconUrl = x.Source.IconUrl,
            Kind = x.Kind,
            Title = x.Title,
            Summary = x.Summary,
            LinkUrl = x.LinkUrl,
            ImageUrl = x.ImageUrl,
            PublishedAt = x.PublishedAt,
            YouTubeVideoId = x.YouTubeVideoId,
            EmbedUrl = x.EmbedUrl
        })
        .ToListAsync();

    // 1 item per source (latest because recent is already sorted desc)
    var diverseItems = recent
        .GroupBy(x => x.SourceId)
        .Select(g => g.First())
        .OrderByDescending(x => x.PublishedAt)
        .ThenByDescending(x => x.Id)
        .Skip((page - 1) * pageSize)
        .Take(pageSize)
        .ToList();

    return new ServiceResponse<List<FeedItemDto>> { Data = diverseItems, Success = true };
}


        public async Task<ServiceResponse<FeedItemDto>> GetByIdAsync(Guid id)
        {
            var item = await _db.FeedItems
                .AsNoTracking()
                .Include(x => x.Source)
                .Where(x => x.Id == id && x.IsActive)
                .Select(x => new FeedItemDto
                {
                    Id = x.Id,
                    SourceId = x.SourceId,
                    SourceName = x.Source.Name,
                    SourceIconUrl = x.Source.IconUrl,
                    Kind = x.Kind,
                    Title = x.Title,
                    Summary = x.Summary,
                    LinkUrl = x.LinkUrl,
                    ImageUrl = x.ImageUrl,
                    PublishedAt = x.PublishedAt,
                    YouTubeVideoId = x.YouTubeVideoId,
                    EmbedUrl = x.EmbedUrl
                })
                .FirstOrDefaultAsync();

            if (item == null)
                return new ServiceResponse<FeedItemDto> { Success = false, Message = "Feed item not found." };

            return new ServiceResponse<FeedItemDto> { Data = item, Success = true };
        }

        public async Task<ServiceResponse<List<NewsSourceDto>>> GetSourcesForUiAsync()
        {
            var sources = await _db.NewsSources
                .AsNoTracking()
                .Where(s => s.IsActive)
                .OrderBy(s => s.Name)
                .ToListAsync();

            return new ServiceResponse<List<NewsSourceDto>>
            {
                Data = _mapper.Map<List<NewsSourceDto>>(sources),
                Success = true
            };
        }

        private static ServiceResponse<List<FeedItemDto>> Ok(List<FeedItemDto> data)
            => new ServiceResponse<List<FeedItemDto>> { Data = data, Success = true };
    }
}
