using TechNewsApi.Dtos;
using TechNewsCore.Helpers;

namespace TechNewsApi.Repositories.Interfaces
{
    public interface IPostLikeRepository
    {
        Task<ServiceResponse<PostLikeSummaryDto>> GetSummaryAsync(Guid postId);
        Task<ServiceResponse<PostLikeSummaryDto>> ReactAsync(Guid postId, bool? isLike);
        Task<ServiceResponse<List<PostReactionUserDto>>> GetReactionsAsync(Guid postId);

    }
}
