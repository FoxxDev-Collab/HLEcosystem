using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HLE.FamilyFinance.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddHsaAccountType : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "HsaAnnualLimit",
                table: "Accounts",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "HsaFamilyCoverage",
                table: "Accounts",
                type: "boolean",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "HsaAnnualLimit",
                table: "Accounts");

            migrationBuilder.DropColumn(
                name: "HsaFamilyCoverage",
                table: "Accounts");
        }
    }
}
