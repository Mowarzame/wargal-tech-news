using AutoMapper;
using AutoMapper.QueryableExtensions;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using TechNewsApi.Data;
using TechNewsApi.Dtos;
using TechNewsCore.Helpers;
using TechNewsCore.Models;
using TechNewsApi.Repositories.Interfaces;

namespace TechNewsApi.Repositories
{
    public class CommentRepository : ICommentRepository
    {
        private readonly AppDbContext _db;
        private readonly IMapper _mapper;
        private readonly IHttpContextAccessor _http;

        public CommentRepository(AppDbContext db, IMapper mapper, IHttpContextAccessor http)
        {
            _db = db;
            _mapper = mapper;
            _http = http;
        }

        private Guid GetCurrentUserId()
        {
            var id = _http.HttpContext?.User?.FindFirstValue(ClaimTypes.NameIdentifier);
            return Guid.TryParse(id, out var guid) ? guid : Guid.Empty;
        }

        private bool IsAdmin()
        {
            return _http.HttpContext?.User?.IsInRole(Roles.Admin) ?? false;
        }

        public async Task<ServiceResponse<List<CommentDto>>> GetByPostIdAsync(Guid postId)
        {
            // Only show comments for verified posts to normal users (optional but recommended)
            var post = await _db.Posts.AsNoTracking()
                .Where(p => p.Id == postId)
                .Select(p => new { p.Id, p.IsVerified })
                .FirstOrDefaultAsync();

            if (post == null)
                return new ServiceResponse<List<CommentDto>> { Success = false, Message = "Post not found." };

            // If post not verified, only Admin/Editor can view comments (align with your rules)
            if (!post.IsVerified)
            {
                var isElevated = IsAdmin() || (_http.HttpContext?.User?.IsInRole(Roles.Editor) ?? false);
                if (!isElevated)
                    return new ServiceResponse<List<CommentDto>> { Success = false, Message = "Not authorized." };
            }

            var items = await _db.Comments.AsNoTracking()
                .Where(c => c.PostId == postId && !c.IsDeleted)
                .OrderByDescending(c => c.CreatedAt)
                .Include(c => c.User)
                .ProjectTo<CommentDto>(_mapper.ConfigurationProvider)
                .ToListAsync();

            return new ServiceResponse<List<CommentDto>> { Data = items, Success = true };
        }

        public async Task<ServiceResponse<CommentDto>> CreateAsync(Guid postId, CommentCreateDto dto)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return new ServiceResponse<CommentDto> { Success = false, Message = "Unauthorized." };

            var post = await _db.Posts.FirstOrDefaultAsync(p => p.Id == postId);
            if (post == null)
                return new ServiceResponse<CommentDto> { Success = false, Message = "Post not found." };

            // Users should only comment on verified posts (recommended)
            if (!post.IsVerified)
                return new ServiceResponse<CommentDto> { Success = false, Message = "Cannot comment on unverified posts." };

            var entity = _mapper.Map<Comment>(dto);
            entity.PostId = postId;
            entity.UserId = userId;

            _db.Comments.Add(entity);
            await _db.SaveChangesAsync();

            // Load user for dto mapping
            await _db.Entry(entity).Reference(c => c.User).LoadAsync();
            var outDto = _mapper.Map<CommentDto>(entity);

            return new ServiceResponse<CommentDto> { Data = outDto, Success = true, Message = "Comment added." };
        }

        public async Task<ServiceResponse<bool>> DeleteAsync(Guid commentId)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return new ServiceResponse<bool> { Success = false, Message = "Unauthorized." };

            var comment = await _db.Comments.FirstOrDefaultAsync(c => c.Id == commentId);
            if (comment == null || comment.IsDeleted)
                return new ServiceResponse<bool> { Success = false, Message = "Comment not found." };

            var canDelete = IsAdmin() || comment.UserId == userId;
            if (!canDelete)
                return new ServiceResponse<bool> { Success = false, Message = "Not authorized." };

            // Soft delete
            comment.IsDeleted = true;
            await _db.SaveChangesAsync();

            return new ServiceResponse<bool> { Data = true, Success = true, Message = "Comment deleted." };
        }
    }
}
