using TechNewsApi.Dtos;
using TechNewsCore.Helpers;
using TechNewsCore.Models;

namespace TechNewsApi.Repositories.Interfaces
{
    public interface IFeedItemRepository
    {
Task<ServiceResponse<List<FeedItemDto>>> GetAsync(
    int page,
    int pageSize,
    FeedItemKind? kind,
    Guid? sourceId,
    string? q,
    bool diverse);


        Task<ServiceResponse<FeedItemDto>> GetByIdAsync(Guid id);

        Task<ServiceResponse<List<NewsSourceDto>>> GetSourcesForUiAsync();
    }
}
