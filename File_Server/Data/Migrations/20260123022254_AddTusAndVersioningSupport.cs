using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace HLE.FileServer.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddTusAndVersioningSupport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_FileEntries_UserId",
                table: "FileEntries");

            migrationBuilder.AddColumn<string>(
                name: "ContentHash",
                table: "FileEntries",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CurrentVersion",
                table: "FileEntries",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedDate",
                table: "FileEntries",
                type: "timestamptz",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsDeleted",
                table: "FileEntries",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastModified",
                table: "FileEntries",
                type: "timestamptz",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<int>(
                name: "OriginalParentFolderId",
                table: "FileEntries",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "VersioningEnabled",
                table: "FileEntries",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "FileVersions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    FileEntryId = table.Column<int>(type: "integer", nullable: false),
                    VersionNumber = table.Column<int>(type: "integer", nullable: false),
                    StoragePath = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    FileSize = table.Column<long>(type: "bigint", nullable: false),
                    ContentHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamptz", nullable: false),
                    CreatedByUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: true),
                    Note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FileVersions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FileVersions_FileEntries_FileEntryId",
                        column: x => x.FileEntryId,
                        principalTable: "FileEntries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_FileVersions_Users_CreatedByUserId",
                        column: x => x.CreatedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "TusUploads",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UploadId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    FileName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    TotalSize = table.Column<long>(type: "bigint", nullable: false),
                    UploadedBytes = table.Column<long>(type: "bigint", nullable: false),
                    TempFilePath = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    TargetFolderId = table.Column<int>(type: "integer", nullable: true),
                    ContentType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamptz", nullable: false),
                    LastActivity = table.Column<DateTime>(type: "timestamptz", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamptz", nullable: false),
                    IsComplete = table.Column<bool>(type: "boolean", nullable: false),
                    UserId = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TusUploads", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TusUploads_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FileEntries_UserId_IsDeleted",
                table: "FileEntries",
                columns: new[] { "UserId", "IsDeleted" });

            migrationBuilder.CreateIndex(
                name: "IX_FileVersions_CreatedByUserId",
                table: "FileVersions",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_FileVersions_FileEntryId_VersionNumber",
                table: "FileVersions",
                columns: new[] { "FileEntryId", "VersionNumber" });

            migrationBuilder.CreateIndex(
                name: "IX_TusUploads_ExpiresAt",
                table: "TusUploads",
                column: "ExpiresAt");

            migrationBuilder.CreateIndex(
                name: "IX_TusUploads_UploadId",
                table: "TusUploads",
                column: "UploadId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TusUploads_UserId",
                table: "TusUploads",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FileVersions");

            migrationBuilder.DropTable(
                name: "TusUploads");

            migrationBuilder.DropIndex(
                name: "IX_FileEntries_UserId_IsDeleted",
                table: "FileEntries");

            migrationBuilder.DropColumn(
                name: "ContentHash",
                table: "FileEntries");

            migrationBuilder.DropColumn(
                name: "CurrentVersion",
                table: "FileEntries");

            migrationBuilder.DropColumn(
                name: "DeletedDate",
                table: "FileEntries");

            migrationBuilder.DropColumn(
                name: "IsDeleted",
                table: "FileEntries");

            migrationBuilder.DropColumn(
                name: "LastModified",
                table: "FileEntries");

            migrationBuilder.DropColumn(
                name: "OriginalParentFolderId",
                table: "FileEntries");

            migrationBuilder.DropColumn(
                name: "VersioningEnabled",
                table: "FileEntries");

            migrationBuilder.CreateIndex(
                name: "IX_FileEntries_UserId",
                table: "FileEntries",
                column: "UserId");
        }
    }
}
