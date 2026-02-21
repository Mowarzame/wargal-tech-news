using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TechNewsApi.Migrations
{
    /// <inheritdoc />
    public partial class AddFetchIntervalSecondsToNewsSources : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
        migrationBuilder.Sql(@"
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'NewsSources'
          AND column_name = 'FetchIntervalSeconds'
    ) THEN
        ALTER TABLE ""NewsSources""
        ADD COLUMN ""FetchIntervalSeconds"" integer NOT NULL DEFAULT 60;
    END IF;
END $$;
");

migrationBuilder.Sql(@"
UPDATE ""NewsSources""
SET ""FetchIntervalSeconds"" =
    CASE
        WHEN ""FetchIntervalMinutes"" IS NOT NULL AND ""FetchIntervalMinutes"" > 0
            THEN ""FetchIntervalMinutes"" * 60
        ELSE 60
    END
WHERE ""FetchIntervalSeconds"" IS NULL OR ""FetchIntervalSeconds"" = 0;
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FetchIntervalSeconds",
                table: "NewsSources");
        }
    }
}
