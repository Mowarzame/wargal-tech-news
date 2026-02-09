using System.Net.Http.Headers;
using System.Security.Claims;
using AutoMapper;
using Microsoft.EntityFrameworkCore;
using TechNewsApi.Data;
using TechNewsApi.Dtos;
using TechNewsCore.Helpers;
using TechNewsCore.Models;
using TechNewsApi.Repositories.Interfaces;

namespace TechNewsApi.Repositories
{
    public class PostRepository : IPostRepository
    {
        private readonly AppDbContext _context;
        private readonly IMapper _mapper;

      private readonly IHttpContextAccessor _httpContextAccessor;

     private readonly IHttpClientFactory _httpClientFactory;
        private readonly IConfiguration _config;

        public PostRepository(
            AppDbContext context,
            IMapper mapper,
            IHttpContextAccessor httpContextAccessor,
            IHttpClientFactory httpClientFactory,
            IConfiguration config)
        {
            _context = context;
            _mapper = mapper;
            _httpContextAccessor = httpContextAccessor;
            _httpClientFactory = httpClientFactory;
            _config = config;
        }


            private (Guid userId, string role)? GetCurrentUser()
{
    var user = _httpContextAccessor.HttpContext?.User;

    if (user == null) return null;

    var userIdClaim = user.FindFirst(ClaimTypes.NameIdentifier);
    var roleClaim = user.FindFirst(ClaimTypes.Role);

    if (userIdClaim == null || roleClaim == null) return null;

    return (Guid.Parse(userIdClaim.Value), roleClaim.Value);
}
private async Task<string> UploadImageToSupabaseAsync(IFormFile file, Guid userId)
{
    var supabaseUrl = _config["Supabase:Url"]!;
    var serviceKey = _config["Supabase:ServiceRoleKey"]!;
    var bucket = _config["Supabase:Bucket"] ?? "posts";

    // Generate unique path
    var ext = Path.GetExtension(file.FileName);
    var objectPath = $"{userId}/{Guid.NewGuid()}{ext}";

    // Supabase Storage upload endpoint
    var uploadUrl = $"{supabaseUrl}/storage/v1/object/{bucket}/{objectPath}";

    var client = _httpClientFactory.CreateClient();
    client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", serviceKey);
    client.DefaultRequestHeaders.Add("apikey", serviceKey);

    using var stream = file.OpenReadStream();
    using var content = new StreamContent(stream);
    content.Headers.ContentType = new MediaTypeHeaderValue(file.ContentType);

    // Upsert so re-uploads don’t fail
    var request = new HttpRequestMessage(HttpMethod.Post, uploadUrl);
    request.Content = content;
    request.Headers.Add("x-upsert", "true");

    var resp = await client.SendAsync(request);
    var respBody = await resp.Content.ReadAsStringAsync();

    if (!resp.IsSuccessStatusCode)
    {
        throw new Exception($"Supabase upload failed ({(int)resp.StatusCode}): {respBody}");
    }

    // Public URL (if your bucket is public)
    var publicUrl = $"{supabaseUrl}/storage/v1/object/public/{bucket}/{objectPath}";
    return publicUrl;
}
public async Task<ServiceResponse<List<PostDto>>> GetPendingPostsAsync()
{
    var response = new ServiceResponse<List<PostDto>>();
    var current = GetCurrentUser();

    if (current == null || !string.Equals(current.Value.role, Roles.Admin, StringComparison.OrdinalIgnoreCase))
    {
        response.Success = false;
        response.Message = "Only Admin can view pending posts";
        return response;
    }

    var posts = await _context.Posts
        .Where(p => !p.IsVerified)
        .Include(p => p.User)
        .OrderByDescending(p => p.CreatedAt)
        .ToListAsync();

    response.Data = _mapper.Map<List<PostDto>>(posts);
    return response;
}


public async Task<ServiceResponse<PostDto>> CreatePostWithImageAsync(PostCreateFormDto formDto)
{
    var response = new ServiceResponse<PostDto>();

    var current = GetCurrentUser();
    if (current == null)
    {
        response.Success = false;
        response.Message = "Unauthorized";
        return response;
    }

    var role = current.Value.role?.Trim();

    if (!string.Equals(role, Roles.Admin, StringComparison.OrdinalIgnoreCase) &&
        !string.Equals(role, Roles.Editor, StringComparison.OrdinalIgnoreCase))
    {
        response.Success = false;
        response.Message = "Only Admin or Editor can create posts";
        return response;
    }

    try
    {
        string? imageUrl = null;

        if (formDto.Image != null && formDto.Image.Length > 0)
        {
            imageUrl = await UploadImageToSupabaseAsync(formDto.Image, current.Value.userId);
        }

        var dto = new PostCreateDto
        {
            Title = formDto.Title,
            Content = formDto.Content,
            VideoUrl = formDto.VideoUrl,
            ImageUrl = imageUrl
        };

        var post = _mapper.Map<Post>(dto);
        post.UserId = current.Value.userId;
        post.CreatedAt = DateTime.UtcNow;

        // ✅ Admin posts are verified immediately
        post.IsVerified = string.Equals(role, Roles.Admin, StringComparison.OrdinalIgnoreCase);

        _context.Posts.Add(post);
        await _context.SaveChangesAsync();

        var postWithUser = await _context.Posts
            .Include(p => p.User)
            .FirstAsync(p => p.Id == post.Id);

        response.Data = _mapper.Map<PostDto>(postWithUser);
        response.Message = post.IsVerified
            ? "Post created and verified (Admin)."
            : "Post created, awaiting admin verification.";

        return response;
    }
    catch (Exception ex)
    {
        response.Success = false;
        response.Message = ex.Message;
        return response;
    }
}
public async Task<ServiceResponse<PostDto>> UnverifyPostAsync(Guid postId)
{
    var response = new ServiceResponse<PostDto>();
    var current = GetCurrentUser();

    if (current == null || !string.Equals(current.Value.role, Roles.Admin, StringComparison.OrdinalIgnoreCase))
    {
        response.Success = false;
        response.Message = "Only Admin can unverify posts";
        return response;
    }

    var post = await _context.Posts.FindAsync(postId);
    if (post == null)
    {
        response.Success = false;
        response.Message = "Post not found";
        return response;
    }

    post.IsVerified = false;
    await _context.SaveChangesAsync();

    var postWithUser = await _context.Posts.Include(p => p.User)
        .FirstAsync(p => p.Id == postId);

    response.Data = _mapper.Map<PostDto>(postWithUser);
    response.Message = "Post unverified";
    return response;
}

public async Task<ServiceResponse<List<PostDto>>> GetAllPostsAsync()
{
    var response = new ServiceResponse<List<PostDto>>();
    var current = GetCurrentUser();
    var currentUserId = current?.userId; // may be null if something is off

    try
    {
        var posts = await _context.Posts
            .AsNoTracking()
            .Where(p => p.IsVerified)
            .Include(p => p.User)
            .Include(p => p.Comments)
            .Include(p => p.PostLikes)
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync();

        var dtos = _mapper.Map<List<PostDto>>(posts);

        // ✅ Enrich with likes/dislikes + my reaction
        for (int i = 0; i < posts.Count; i++)
        {
            var p = posts[i];
            var dto = dtos[i];

            dto.Likes = p.PostLikes.Count(x => x.IsLike);
            dto.Dislikes = p.PostLikes.Count(x => !x.IsLike);

            if (currentUserId.HasValue)
            {
                var mine = p.PostLikes.FirstOrDefault(x => x.UserId == currentUserId.Value);
                dto.MyReaction = mine == null ? null : (bool?)mine.IsLike;
            }
            else
            {
                dto.MyReaction = null;
            }
        }

        response.Data = dtos;
    }
    catch (Exception ex)
    {
        response.Success = false;
        response.Message = ex.Message;
    }

    return response;
}


public async Task<ServiceResponse<List<PostDto>>> GetAllPostsForAdminAsync()
{
    var response = new ServiceResponse<List<PostDto>>();
    var current = GetCurrentUser();

    if (current == null || !string.Equals(current.Value.role, Roles.Admin, StringComparison.OrdinalIgnoreCase))
    {
        response.Success = false;
        response.Message = "Only Admin can view all posts";
        return response;
    }

    var currentUserId = current.Value.userId;

    var posts = await _context.Posts
        .AsNoTracking()
        .Include(p => p.User)
        .Include(p => p.Comments)
        .Include(p => p.PostLikes)
        .OrderByDescending(p => p.CreatedAt)
        .ToListAsync();

    var dtos = _mapper.Map<List<PostDto>>(posts);

    for (int i = 0; i < posts.Count; i++)
    {
        var p = posts[i];
        var dto = dtos[i];

        dto.Likes = p.PostLikes.Count(x => x.IsLike);
        dto.Dislikes = p.PostLikes.Count(x => !x.IsLike);

        var mine = p.PostLikes.FirstOrDefault(x => x.UserId == currentUserId);
        dto.MyReaction = mine == null ? null : (bool?)mine.IsLike;
    }

    response.Data = dtos;
    return response;
}


public async Task<ServiceResponse<PostDto>> GetPostByIdAsync(Guid postId)
{
    var response = new ServiceResponse<PostDto>();
    var current = GetCurrentUser();

    var post = await _context.Posts
        .AsNoTracking()
        .Include(p => p.User)
        .Include(p => p.Comments)
        .Include(p => p.PostLikes)
        .FirstOrDefaultAsync(p => p.Id == postId);

    if (post == null)
    {
        response.Success = false;
        response.Message = "Post not found.";
        return response;
    }

    // ✅ If post is not verified, only Admin/Editor can view
    if (!post.IsVerified)
    {
        var role = current?.role?.Trim();
        var isElevated =
            string.Equals(role, Roles.Admin, StringComparison.OrdinalIgnoreCase) ||
            string.Equals(role, Roles.Editor, StringComparison.OrdinalIgnoreCase);

        if (!isElevated)
        {
            response.Success = false;
            response.Message = "Not authorized.";
            return response;
        }
    }

    var dto = _mapper.Map<PostDto>(post);

    dto.Likes = post.PostLikes.Count(x => x.IsLike);
    dto.Dislikes = post.PostLikes.Count(x => !x.IsLike);

    if (current != null)
    {
        var mine = post.PostLikes.FirstOrDefault(x => x.UserId == current.Value.userId);
        dto.MyReaction = mine == null ? null : (bool?)mine.IsLike;
    }
    else
    {
        dto.MyReaction = null;
    }

    response.Data = dto;
    return response;
}


public async Task<ServiceResponse<PostDto>> CreatePostAsync(PostCreateDto dto)
{
    var response = new ServiceResponse<PostDto>();

    var current = GetCurrentUser();
    if (current == null)
    {
        response.Success = false;
        response.Message = "Unauthorized";
        return response;
    }

    if (current.Value.role != Roles.Admin && current.Value.role != Roles.Editor)
    {
        response.Success = false;
        response.Message = "Only Admin or Editor can create posts";
        return response;
    }

    var post = _mapper.Map<Post>(dto);
    post.UserId = current.Value.userId;
    post.CreatedAt = DateTime.UtcNow;
    post.IsVerified = false;

    _context.Posts.Add(post);
    await _context.SaveChangesAsync();

    var postWithUser = await _context.Posts.Include(p => p.User)
        .FirstAsync(p => p.Id == post.Id);

    response.Data = _mapper.Map<PostDto>(postWithUser);
    response.Message = "Post created, awaiting admin verification.";
    return response;
}


public async Task<ServiceResponse<PostDto>> UpdatePostAsync(Guid postId, PostCreateDto dto)
{
    var response = new ServiceResponse<PostDto>();
    var current = GetCurrentUser();

    if (current == null)
    {
        response.Success = false;
        response.Message = "Unauthorized";
        return response;
    }

    var role = current.Value.role?.Trim();

    var post = await _context.Posts.FindAsync(postId);
    if (post == null)
    {
        response.Success = false;
        response.Message = "Post not found";
        return response;
    }

    // Admin can update any post; others can update only their own
    if (!string.Equals(role, Roles.Admin, StringComparison.OrdinalIgnoreCase) &&
        post.UserId != current.Value.userId)
    {
        response.Success = false;
        response.Message = "You cannot edit this post";
        return response;
    }

    post.Title = dto.Title;
    post.Content = dto.Content;
    post.ImageUrl = dto.ImageUrl;
    post.VideoUrl = dto.VideoUrl;

    // ✅ Admin edits remain verified; Editor/User edits require re-approval
    post.IsVerified = string.Equals(role, Roles.Admin, StringComparison.OrdinalIgnoreCase);

    await _context.SaveChangesAsync();

    var postWithUser = await _context.Posts
        .Include(p => p.User)
        .FirstAsync(p => p.Id == postId);

    response.Data = _mapper.Map<PostDto>(postWithUser);
    response.Message = post.IsVerified
        ? "Post updated and verified (Admin)."
        : "Post updated and pending verification.";

    return response;
}


public async Task<ServiceResponse<bool>> DeletePostAsync(Guid postId)
{
    var response = new ServiceResponse<bool>();
    var current = GetCurrentUser();

    if (current == null)
    {
        response.Success = false;
        response.Message = "Unauthorized";
        return response;
    }

    var post = await _context.Posts.FindAsync(postId);
    if (post == null)
    {
        response.Success = false;
        response.Message = "Post not found";
        return response;
    }

    if (current.Value.role != Roles.Admin && post.UserId != current.Value.userId)
    {
        response.Success = false;
        response.Message = "You cannot delete this post";
        return response;
    }

    _context.Posts.Remove(post);
    await _context.SaveChangesAsync();

    response.Data = true;
    response.Message = "Post deleted";
    return response;
}
public async Task<ServiceResponse<PostDto>> VerifyPostAsync(Guid postId)
{
    var response = new ServiceResponse<PostDto>();
    var current = GetCurrentUser();

    if (current == null || current.Value.role != Roles.Admin)
    {
        response.Success = false;
        response.Message = "Only Admin can verify posts";
        return response;
    }

    var post = await _context.Posts.FindAsync(postId);
    if (post == null)
    {
        response.Success = false;
        response.Message = "Post not found";
        return response;
    }

    post.IsVerified = true;
    await _context.SaveChangesAsync();

    response.Data = _mapper.Map<PostDto>(post);
    response.Message = "Post verified";
    return response;
}
public async Task<ServiceResponse<List<PostDto>>> GetMyPostsAsync()
{
    var response = new ServiceResponse<List<PostDto>>();
    var current = GetCurrentUser();

    if (current == null)
    {
        response.Success = false;
        response.Message = "Unauthorized";
        return response;
    }

    var userId = current.Value.userId;

    var posts = await _context.Posts
        .AsNoTracking()
        .Where(p => p.UserId == userId)
        .Include(p => p.User)
        .Include(p => p.Comments)
        .Include(p => p.PostLikes)
        .OrderByDescending(p => p.CreatedAt)
        .ToListAsync();

    var dtos = _mapper.Map<List<PostDto>>(posts);

    // enrich reactions
    for (int i = 0; i < posts.Count; i++)
    {
        var p = posts[i];
        var dto = dtos[i];

        dto.Likes = p.PostLikes.Count(x => x.IsLike);
        dto.Dislikes = p.PostLikes.Count(x => !x.IsLike);

        var mine = p.PostLikes.FirstOrDefault(x => x.UserId == userId);
        dto.MyReaction = mine == null ? null : (bool?)mine.IsLike;
    }

    response.Data = dtos;
    return response;
}


    }
}
