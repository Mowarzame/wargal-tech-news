using Microsoft.EntityFrameworkCore;
using TechNewsCore.Models;

namespace TechNewsWorker.Data
{
    public class WorkerDbContext : DbContext
    {
        public WorkerDbContext(DbContextOptions<WorkerDbContext> options)
            : base(options)
        {
        }

        public DbSet<NewsSource> NewsSources => Set<NewsSource>();
        public DbSet<FeedItem> FeedItems => Set<FeedItem>();

        // Read-only access is fine if these are needed by worker services
        public DbSet<Post> Posts => Set<Post>();
        public DbSet<User> Users => Set<User>(); // Or AppUser if that is your actual model

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<NewsSource>()
                .HasMany(s => s.FeedItems)
                .WithOne(i => i.Source)
                .HasForeignKey(i => i.SourceId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<FeedItem>()
                .HasIndex(i => new { i.SourceId, i.ExternalId })
                .IsUnique();

            modelBuilder.Entity<NewsSource>()
                .HasIndex(s => s.RssUrl)
                .IsUnique()
                .HasFilter("\"RssUrl\" IS NOT NULL");

            modelBuilder.Entity<NewsSource>()
                .HasIndex(s => s.YouTubeChannelId)
                .IsUnique()
                .HasFilter("\"YouTubeChannelId\" IS NOT NULL");

            modelBuilder.Entity<FeedItem>()
                .HasIndex(i => new { i.IsActive, i.PublishedAt });

            modelBuilder.Entity<NewsSource>()
                .HasIndex(s => new { s.IsActive, s.NextFetchAt });

            // Useful when prioritizing by category + due time
            modelBuilder.Entity<NewsSource>()
                .HasIndex(s => new { s.IsActive, s.Category, s.NextFetchAt });
        }
    }
}