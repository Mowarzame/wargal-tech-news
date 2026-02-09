using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TechNewsApi.Migrations
{
    /// <inheritdoc />
    public partial class AddFeedIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_NewsSources_IsActive_NextFetchAt",
                table: "NewsSources",
                columns: new[] { "IsActive", "NextFetchAt" });

            migrationBuilder.CreateIndex(
                name: "IX_FeedItems_IsActive_PublishedAt",
                table: "FeedItems",
                columns: new[] { "IsActive", "PublishedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_FeedItems_SourceId_PublishedAt",
                table: "FeedItems",
                columns: new[] { "SourceId", "PublishedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_NewsSources_IsActive_NextFetchAt",
                table: "NewsSources");

            migrationBuilder.DropIndex(
                name: "IX_FeedItems_IsActive_PublishedAt",
                table: "FeedItems");

            migrationBuilder.DropIndex(
                name: "IX_FeedItems_SourceId_PublishedAt",
                table: "FeedItems");
        }
    }
}
