using TechNewsApi.Dtos;
using TechNewsCore.Helpers;

namespace TechNewsApi.Repositories.Interfaces
{
    public interface INewsSourceRepository
    {
        Task<ServiceResponse<List<NewsSourceDto>>> GetAsync(bool includeInactive = false);
        Task<ServiceResponse<NewsSourceDto>> GetByIdAsync(Guid id);
        Task<ServiceResponse<NewsSourceDto>> CreateAsync(NewsSourceCreateDto dto);
        Task<ServiceResponse<NewsSourceDto>> UpdateAsync(Guid id, NewsSourceCreateDto dto);
        Task<ServiceResponse<bool>> SetActiveAsync(Guid id, bool isActive);
        Task<ServiceResponse<bool>> ForceDueAsync(Guid id); // sets NextFetchAt = null
    }
}
