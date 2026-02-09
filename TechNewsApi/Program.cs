using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using TechNewsApi.Data;
using TechNewsApi.Helpers;
using TechNewsApi.Repositories;
using TechNewsApi.Repositories.Interfaces;

var builder = WebApplication.CreateBuilder(args);

// Read JWT key from appsettings.json
var keyString = builder.Configuration["JWT:Key"]!;

var key = Encoding.ASCII.GetBytes(keyString);

builder.Services.AddControllers();
builder.Services.AddAutoMapper(typeof(MappingProfile));

// Database
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// Repositories
builder.Services.AddScoped<IPostRepository, PostRepository>();
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<ICommentRepository, CommentRepository>();
builder.Services.AddScoped<IPostLikeRepository, PostLikeRepository>();
builder.Services.AddScoped<INewsSourceRepository, NewsSourceRepository>();
builder.Services.AddScoped<IFeedItemRepository, FeedItemRepository>();

// JWT Token Generator singleton
builder.Services.AddSingleton(new JwtTokenGenerator(keyString));

// CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("WebCorsPolicy", policy =>
    {
        policy
            .AllowAnyOrigin()
            .AllowAnyMethod()
            .AllowAnyHeader();
    });
});




// Authentication
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(
           Encoding.UTF8.GetBytes(builder.Configuration["JWT:Key"]!)
),
        ValidateIssuer = false,
        ValidateAudience = false,
        RoleClaimType = ClaimTypes.Role
    };
});


builder.Services.AddEndpointsApiExplorer();
builder.Services.AddHttpContextAccessor();
builder.Services.AddHttpClient();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

app.UseCors("WebCorsPolicy");


app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapMethods("/", new[] { "GET", "HEAD" }, () =>
    Results.Ok(new { service = "TechNewsApi", status = "ok" }));


app.Run();
