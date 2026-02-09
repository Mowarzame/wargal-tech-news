using TechNewsCore.Helpers;
using TechNewsApi.Dtos;

namespace TechNewsApi.Repositories.Interfaces
{
    public interface IPostRepository
    {
        Task<ServiceResponse<List<PostDto>>> GetAllPostsAsync();
        Task<ServiceResponse<PostDto>> GetPostByIdAsync(Guid postId);
        Task<ServiceResponse<PostDto>> CreatePostAsync(PostCreateDto postCreateDto);     
        Task<ServiceResponse<PostDto>> CreatePostWithImageAsync(PostCreateFormDto formDto);
        Task<ServiceResponse<PostDto>> UpdatePostAsync(Guid postId, PostCreateDto postUpdateDto);
        Task<ServiceResponse<bool>> DeletePostAsync(Guid postId);
        Task<ServiceResponse<PostDto>> VerifyPostAsync(Guid postId);
        Task<ServiceResponse<List<PostDto>>> GetPendingPostsAsync();
        Task<ServiceResponse<List<PostDto>>> GetAllPostsForAdminAsync();
        Task<ServiceResponse<PostDto>> UnverifyPostAsync(Guid postId);
        Task<ServiceResponse<List<PostDto>>> GetMyPostsAsync();





    }
}
 