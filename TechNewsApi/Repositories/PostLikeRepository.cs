using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using TechNewsApi.Data;
using TechNewsApi.Dtos;
using TechNewsCore.Helpers;
using TechNewsCore.Models;
using TechNewsApi.Repositories.Interfaces;

namespace TechNewsApi.Repositories
{
    public class PostLikeRepository : IPostLikeRepository
    {
        private readonly AppDbContext _db;
        private readonly IHttpContextAccessor _http;

        public PostLikeRepository(AppDbContext db, IHttpContextAccessor http)
        {
            _db = db;
            _http = http;
        }

        private Guid GetCurrentUserId()
        {
            var id = _http.HttpContext?.User?.FindFirstValue(ClaimTypes.NameIdentifier);
            return Guid.TryParse(id, out var guid) ? guid : Guid.Empty;
        }

        public async Task<ServiceResponse<PostLikeSummaryDto>> GetSummaryAsync(Guid postId)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return new ServiceResponse<PostLikeSummaryDto> { Success = false, Message = "Unauthorized." };

            // Ensure post exists (optional but good)
            var exists = await _db.Posts.AsNoTracking().AnyAsync(p => p.Id == postId);
            if (!exists)
                return new ServiceResponse<PostLikeSummaryDto> { Success = false, Message = "Post not found." };

            var likes = await _db.PostLikes.AsNoTracking()
                .CountAsync(x => x.PostId == postId && x.IsLike);

            var dislikes = await _db.PostLikes.AsNoTracking()
                .CountAsync(x => x.PostId == postId && !x.IsLike);

            var my = await _db.PostLikes.AsNoTracking()
                .Where(x => x.PostId == postId && x.UserId == userId)
                .Select(x => (bool?)x.IsLike)
                .FirstOrDefaultAsync();

            return new ServiceResponse<PostLikeSummaryDto>
            {
                Success = true,
                Data = new PostLikeSummaryDto { Likes = likes, Dislikes = dislikes, MyReaction = my }
            };
        }

        public async Task<ServiceResponse<PostLikeSummaryDto>> ReactAsync(Guid postId, bool? isLike)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return new ServiceResponse<PostLikeSummaryDto> { Success = false, Message = "Unauthorized." };

            var post = await _db.Posts.FirstOrDefaultAsync(p => p.Id == postId);
            if (post == null)
                return new ServiceResponse<PostLikeSummaryDto> { Success = false, Message = "Post not found." };

            // Optional: only allow reactions on verified posts (recommended)
            if (!post.IsVerified)
                return new ServiceResponse<PostLikeSummaryDto> { Success = false, Message = "Cannot react to unverified posts." };

            var existing = await _db.PostLikes
                .FirstOrDefaultAsync(x => x.PostId == postId && x.UserId == userId);

            if (isLike == null)
            {
                // Undo reaction
                if (existing != null)
                {
                    _db.PostLikes.Remove(existing);
                    await _db.SaveChangesAsync();
                }
            }
            else
            {
                if (existing == null)
                {
                    _db.PostLikes.Add(new PostLike
                    {
                        PostId = postId,
                        UserId = userId,
                        IsLike = isLike.Value
                    });
                    await _db.SaveChangesAsync();
                }
                else
                {
                    // Switch like<->dislike if changed
                    if (existing.IsLike != isLike.Value)
                    {
                        existing.IsLike = isLike.Value;
                        await _db.SaveChangesAsync();
                    }
                }
            }

            // Return updated summary (single response for UI refresh)
            return await GetSummaryAsync(postId);
        }

        public async Task<ServiceResponse<List<PostReactionUserDto>>> GetReactionsAsync(Guid postId)
{
    var userId = GetCurrentUserId();
    if (userId == Guid.Empty)
        return new ServiceResponse<List<PostReactionUserDto>> { Success = false, Message = "Unauthorized." };

    var exists = await _db.Posts.AsNoTracking().AnyAsync(p => p.Id == postId);
    if (!exists)
        return new ServiceResponse<List<PostReactionUserDto>> { Success = false, Message = "Post not found." };

    var items = await _db.PostLikes.AsNoTracking()
        .Where(x => x.PostId == postId)
        .Include(x => x.User)
        .OrderByDescending(x => x.CreatedAt)
        .Select(x => new PostReactionUserDto
        {
            UserId = x.UserId,
            UserName = x.User.Name,
            UserPhotoUrl = x.User.ProfilePictureUrl,
            IsLike = x.IsLike,
            CreatedAt = x.CreatedAt
        })
        .ToListAsync();

    return new ServiceResponse<List<PostReactionUserDto>> { Success = true, Data = items };
}

    }
}
