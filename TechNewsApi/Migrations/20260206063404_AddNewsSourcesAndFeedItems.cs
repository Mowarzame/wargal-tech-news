using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TechNewsApi.Migrations
{
    /// <inheritdoc />
    public partial class AddNewsSourcesAndFeedItems : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "NewsSources",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Type = table.Column<short>(type: "smallint", nullable: false),
                    WebsiteUrl = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    RssUrl = table.Column<string>(type: "character varying(800)", maxLength: 800, nullable: true),
                    YouTubeChannelId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    YouTubeUploadsPlaylistId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    IconUrl = table.Column<string>(type: "character varying(800)", maxLength: 800, nullable: true),
                    Category = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Language = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    Country = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    TrustLevel = table.Column<short>(type: "smallint", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    LastFetchedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    NextFetchAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    FetchIntervalMinutes = table.Column<int>(type: "integer", nullable: false),
                    LastEtag = table.Column<string>(type: "text", nullable: true),
                    LastModified = table.Column<string>(type: "text", nullable: true),
                    Cursor = table.Column<string>(type: "text", nullable: true),
                    ErrorCount = table.Column<int>(type: "integer", nullable: false),
                    LastError = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NewsSources", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "FeedItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SourceId = table.Column<Guid>(type: "uuid", nullable: false),
                    ExternalId = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Kind = table.Column<short>(type: "smallint", nullable: false),
                    Title = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Summary = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    LinkUrl = table.Column<string>(type: "character varying(1200)", maxLength: 1200, nullable: false),
                    ImageUrl = table.Column<string>(type: "character varying(1200)", maxLength: 1200, nullable: true),
                    PublishedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ImportedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Author = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    YouTubeVideoId = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    EmbedUrl = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FeedItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FeedItems_NewsSources_SourceId",
                        column: x => x.SourceId,
                        principalTable: "NewsSources",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FeedItems_PublishedAt",
                table: "FeedItems",
                column: "PublishedAt");

            migrationBuilder.CreateIndex(
                name: "IX_FeedItems_SourceId",
                table: "FeedItems",
                column: "SourceId");

            migrationBuilder.CreateIndex(
                name: "IX_FeedItems_SourceId_ExternalId",
                table: "FeedItems",
                columns: new[] { "SourceId", "ExternalId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_NewsSources_IsActive",
                table: "NewsSources",
                column: "IsActive");

            migrationBuilder.CreateIndex(
                name: "IX_NewsSources_RssUrl",
                table: "NewsSources",
                column: "RssUrl",
                unique: true,
                filter: "\"RssUrl\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_NewsSources_Type",
                table: "NewsSources",
                column: "Type");

            migrationBuilder.CreateIndex(
                name: "IX_NewsSources_YouTubeChannelId",
                table: "NewsSources",
                column: "YouTubeChannelId",
                unique: true,
                filter: "\"YouTubeChannelId\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FeedItems");

            migrationBuilder.DropTable(
                name: "NewsSources");
        }
    }
}
