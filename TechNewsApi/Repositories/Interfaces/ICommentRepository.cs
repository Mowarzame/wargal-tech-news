using TechNewsApi.Dtos;
using TechNewsCore.Helpers;


namespace TechNewsApi.Repositories.Interfaces
{
    public interface ICommentRepository
    {
        Task<ServiceResponse<List<CommentDto>>> GetByPostIdAsync(Guid postId);
        Task<ServiceResponse<CommentDto>> CreateAsync(Guid postId, CommentCreateDto dto);

        // Owner or Admin can delete
        Task<ServiceResponse<bool>> DeleteAsync(Guid commentId);
    }
}
