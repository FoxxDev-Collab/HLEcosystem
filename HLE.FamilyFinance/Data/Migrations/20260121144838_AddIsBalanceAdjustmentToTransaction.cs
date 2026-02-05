using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HLE.FamilyFinance.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddIsBalanceAdjustmentToTransaction : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsBalanceAdjustment",
                table: "Transactions",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsBalanceAdjustment",
                table: "Transactions");
        }
    }
}
