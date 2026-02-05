using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace HLE.FamilyHealth.Migrations
{
    /// <inheritdoc />
    public partial class AddHealthCostTracking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "BilledAmount",
                table: "VisitSummaries",
                type: "numeric(10,2)",
                precision: 10,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "InsurancePaid",
                table: "VisitSummaries",
                type: "numeric(10,2)",
                precision: 10,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "OutOfPocketCost",
                table: "VisitSummaries",
                type: "numeric(10,2)",
                precision: 10,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "PaidFromHsa",
                table: "VisitSummaries",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "Copay",
                table: "Medications",
                type: "numeric(10,2)",
                precision: 10,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "CostPerRefill",
                table: "Medications",
                type: "numeric(10,2)",
                precision: 10,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "PaidFromHsa",
                table: "Medications",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "HouseholdId",
                table: "FamilyMembers",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "MedicalExpenses",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    FamilyMemberId = table.Column<int>(type: "integer", nullable: false),
                    Description = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Category = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Amount = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    ExpenseDate = table.Column<DateOnly>(type: "date", nullable: false),
                    PaidFromHsa = table.Column<bool>(type: "boolean", nullable: false),
                    InsuranceReimbursement = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: true),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    ReceiptPath = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamptz", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamptz", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MedicalExpenses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MedicalExpenses_FamilyMembers_FamilyMemberId",
                        column: x => x.FamilyMemberId,
                        principalTable: "FamilyMembers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FamilyMembers_HouseholdId",
                table: "FamilyMembers",
                column: "HouseholdId");

            migrationBuilder.CreateIndex(
                name: "IX_MedicalExpenses_Category",
                table: "MedicalExpenses",
                column: "Category");

            migrationBuilder.CreateIndex(
                name: "IX_MedicalExpenses_ExpenseDate",
                table: "MedicalExpenses",
                column: "ExpenseDate");

            migrationBuilder.CreateIndex(
                name: "IX_MedicalExpenses_FamilyMemberId",
                table: "MedicalExpenses",
                column: "FamilyMemberId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "MedicalExpenses");

            migrationBuilder.DropIndex(
                name: "IX_FamilyMembers_HouseholdId",
                table: "FamilyMembers");

            migrationBuilder.DropColumn(
                name: "BilledAmount",
                table: "VisitSummaries");

            migrationBuilder.DropColumn(
                name: "InsurancePaid",
                table: "VisitSummaries");

            migrationBuilder.DropColumn(
                name: "OutOfPocketCost",
                table: "VisitSummaries");

            migrationBuilder.DropColumn(
                name: "PaidFromHsa",
                table: "VisitSummaries");

            migrationBuilder.DropColumn(
                name: "Copay",
                table: "Medications");

            migrationBuilder.DropColumn(
                name: "CostPerRefill",
                table: "Medications");

            migrationBuilder.DropColumn(
                name: "PaidFromHsa",
                table: "Medications");

            migrationBuilder.DropColumn(
                name: "HouseholdId",
                table: "FamilyMembers");
        }
    }
}
