using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using TechNewsCore.Models;

namespace TechNewsApi.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options)
            : base(options) { }

        public DbSet<User> Users => Set<User>();
        public DbSet<Post> Posts => Set<Post>();
        public DbSet<Comment> Comments => Set<Comment>();
        public DbSet<PostLike> PostLikes => Set<PostLike>();
        public DbSet<NewsSource> NewsSources => Set<NewsSource>();
        public DbSet<FeedItem> FeedItems => Set<FeedItem>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // -----------------------------
            // Relationships
            // -----------------------------

            modelBuilder.Entity<Post>()
                .HasOne(p => p.User)
                .WithMany(u => u.Posts)
                .HasForeignKey(p => p.UserId);

            modelBuilder.Entity<Comment>()
                .HasOne(c => c.Post)
                .WithMany(p => p.Comments)
                .HasForeignKey(c => c.PostId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Comment>()
                .HasOne(c => c.User)
                .WithMany()
                .HasForeignKey(c => c.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<PostLike>()
                .HasOne(pl => pl.Post)
                .WithMany(p => p.PostLikes)
                .HasForeignKey(pl => pl.PostId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<PostLike>()
                .HasOne(pl => pl.User)
                .WithMany()
                .HasForeignKey(pl => pl.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<NewsSource>()
                .HasMany(s => s.FeedItems)
                .WithOne(i => i.Source)
                .HasForeignKey(i => i.SourceId)
                .OnDelete(DeleteBehavior.Cascade);

            // -----------------------------
            // Indexes / Constraints
            // -----------------------------

            modelBuilder.Entity<Comment>()
                .HasIndex(c => c.PostId);

            modelBuilder.Entity<Comment>()
                .HasIndex(c => c.CreatedAt);

            // ✅ Prevent duplicates: one reaction per user per post
            modelBuilder.Entity<PostLike>()
                .HasIndex(pl => new { pl.PostId, pl.UserId })
                .IsUnique();

            // ✅ Unique external items per source
            modelBuilder.Entity<FeedItem>()
                .HasIndex(i => new { i.SourceId, i.ExternalId })
                .IsUnique();

            // ✅ Avoid duplicates for RSS url / YT channel id (nullable unique)
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

            modelBuilder.Entity<FeedItem>()
                .HasIndex(i => new { i.SourceId, i.PublishedAt });

            modelBuilder.Entity<NewsSource>()
                .HasIndex(s => new { s.IsActive, s.NextFetchAt });

            // -----------------------------
            // ✅ PERMANENT TIMEZONE FIX (Postgres)
            // 1) Force timestamptz at DB level
            // 2) Ensure values are stored/read as UTC instants
            //    - Works for DateTime AND DateTimeOffset
            // -----------------------------

            // (A) Column types: timestamptz
            modelBuilder.Entity<FeedItem>(b =>
            {
                b.Property(x => x.PublishedAt).HasColumnType("timestamptz");
                b.Property(x => x.ImportedAt).HasColumnType("timestamptz");
            });

            modelBuilder.Entity<NewsSource>(b =>
            {
                b.Property(x => x.LastFetchedAt).HasColumnType("timestamptz");
                b.Property(x => x.NextFetchAt).HasColumnType("timestamptz");
                b.Property(x => x.CreatedAt).HasColumnType("timestamptz");
                b.Property(x => x.UpdatedAt).HasColumnType("timestamptz");
            });

            modelBuilder.Entity<Post>(b =>
            {
                b.Property(x => x.CreatedAt).HasColumnType("timestamptz");
                // If you also have UpdatedAt:
                // b.Property(x => x.UpdatedAt).HasColumnType("timestamptz");
            });

            modelBuilder.Entity<Comment>(b =>
            {
                b.Property(x => x.CreatedAt).HasColumnType("timestamptz");
            });

            // (B) UTC converters (safe if you mix DateTime + DateTimeOffset)
            var utcDateTimeConverter = new ValueConverter<DateTime, DateTime>(
                v => v.Kind == DateTimeKind.Utc ? v : v.ToUniversalTime(),
                v => DateTime.SpecifyKind(v, DateTimeKind.Utc)
            );

            var utcDateTimeOffsetConverter = new ValueConverter<DateTimeOffset, DateTimeOffset>(
                v => v.ToUniversalTime(),
                v => v.ToUniversalTime()
            );

            foreach (var entityType in modelBuilder.Model.GetEntityTypes())
            {
                foreach (var property in entityType.GetProperties())
                {
                    if (property.ClrType == typeof(DateTime))
                    {
                        property.SetValueConverter(utcDateTimeConverter);
                    }
                    else if (property.ClrType == typeof(DateTimeOffset))
                    {
                        property.SetValueConverter(utcDateTimeOffsetConverter);
                    }
                }
            }
        }
    }
}
