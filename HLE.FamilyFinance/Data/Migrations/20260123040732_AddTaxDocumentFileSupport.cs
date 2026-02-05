using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HLE.FamilyFinance.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddTaxDocumentFileSupport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ContentHash",
                table: "TaxDocuments",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "FileSize",
                table: "TaxDocuments",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "StoragePath",
                table: "TaxDocuments",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "UploadedAt",
                table: "TaxDocuments",
                type: "timestamptz",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UploadedFileName",
                table: "TaxDocuments",
                type: "character varying(255)",
                maxLength: 255,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ContentHash",
                table: "TaxDocuments");

            migrationBuilder.DropColumn(
                name: "FileSize",
                table: "TaxDocuments");

            migrationBuilder.DropColumn(
                name: "StoragePath",
                table: "TaxDocuments");

            migrationBuilder.DropColumn(
                name: "UploadedAt",
                table: "TaxDocuments");

            migrationBuilder.DropColumn(
                name: "UploadedFileName",
                table: "TaxDocuments");
        }
    }
}
