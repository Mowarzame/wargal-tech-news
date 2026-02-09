using AutoMapper;
using TechNewsApi.Dtos;
using TechNewsCore.Models;

namespace TechNewsApi.Helpers
{
    public class MappingProfile : Profile
    {
        public MappingProfile()
        {
            // Users
            CreateMap<User, UserDto>();
            CreateMap<UserLoginDto, User>();

            // Posts
            CreateMap<Post, PostDto>();
            CreateMap<PostCreateDto, Post>();

            // Comments
   CreateMap<Comment, CommentDto>()
    .ForMember(d => d.UserName, opt => opt.MapFrom(s => s.User != null ? s.User.Name : ""))
    .ForMember(d => d.UserPhotoUrl, opt => opt.MapFrom(s => s.User != null ? s.User.ProfilePictureUrl : null));

CreateMap<CommentCreateDto, Comment>()
    .ForMember(d => d.Id, opt => opt.Ignore())
    .ForMember(d => d.UserId, opt => opt.Ignore())
    .ForMember(d => d.PostId, opt => opt.Ignore())
    .ForMember(d => d.CreatedAt, opt => opt.Ignore())
    .ForMember(d => d.IsDeleted, opt => opt.Ignore());

            // PostLikes
            CreateMap<PostLike, PostLikeDto>();
CreateMap<NewsSource, NewsSourceDto>()
    .ForMember(d => d.LastFetchedAt,
        o => o.MapFrom(s => s.LastFetchedAt.HasValue ? s.LastFetchedAt.Value.UtcDateTime : (DateTime?)null))
    .ForMember(d => d.NextFetchAt,
        o => o.MapFrom(s => s.NextFetchAt.HasValue ? s.NextFetchAt.Value.UtcDateTime : (DateTime?)null));

CreateMap<NewsSourceCreateDto, NewsSource>();

CreateMap<FeedItem, FeedItemDto>()
    .ForMember(d => d.SourceName, opt => opt.MapFrom(s => s.Source.Name))
    .ForMember(d => d.SourceIconUrl, opt => opt.MapFrom(s => s.Source.IconUrl));

        }
    }
}
