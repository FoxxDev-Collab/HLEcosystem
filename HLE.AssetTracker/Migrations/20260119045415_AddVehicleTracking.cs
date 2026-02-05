using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace HLE.AssetTracker.Migrations
{
    /// <inheritdoc />
    public partial class AddVehicleTracking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Vehicles",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    HouseholdId = table.Column<int>(type: "integer", nullable: false),
                    AssetId = table.Column<int>(type: "integer", nullable: true),
                    VIN = table.Column<string>(type: "character varying(17)", maxLength: 17, nullable: true),
                    Make = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Model = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Year = table.Column<int>(type: "integer", nullable: true),
                    LicensePlate = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Color = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    VehicleType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    CurrentOdometer = table.Column<int>(type: "integer", nullable: false),
                    OdometerUnit = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "Miles"),
                    Notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedByUserId = table.Column<int>(type: "integer", nullable: false),
                    IsArchived = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamptz", nullable: false, defaultValueSql: "NOW()"),
                    UpdatedAt = table.Column<DateTime>(type: "timestamptz", nullable: false, defaultValueSql: "NOW()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Vehicles", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Vehicles_Assets_AssetId",
                        column: x => x.AssetId,
                        principalTable: "Assets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_Vehicles_Households_HouseholdId",
                        column: x => x.HouseholdId,
                        principalTable: "Households",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "FuelLogs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    VehicleId = table.Column<int>(type: "integer", nullable: false),
                    FillUpDate = table.Column<DateTime>(type: "timestamptz", nullable: false),
                    Odometer = table.Column<int>(type: "integer", nullable: false),
                    Quantity = table.Column<decimal>(type: "numeric(10,3)", precision: 10, scale: 3, nullable: false),
                    QuantityUnit = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "Gallons"),
                    TotalCost = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    PricePerUnit = table.Column<decimal>(type: "numeric(10,3)", precision: 10, scale: 3, nullable: false),
                    FuelType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    IsFullTank = table.Column<bool>(type: "boolean", nullable: false),
                    CalculatedMPG = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: true),
                    MilesDriven = table.Column<int>(type: "integer", nullable: true),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    LoggedByUserId = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamptz", nullable: false, defaultValueSql: "NOW()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FuelLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FuelLogs_Vehicles_VehicleId",
                        column: x => x.VehicleId,
                        principalTable: "Vehicles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "OdometerReadings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    VehicleId = table.Column<int>(type: "integer", nullable: false),
                    ReadingDate = table.Column<DateTime>(type: "timestamptz", nullable: false),
                    Odometer = table.Column<int>(type: "integer", nullable: false),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    RecordedByUserId = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamptz", nullable: false, defaultValueSql: "NOW()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OdometerReadings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OdometerReadings_Vehicles_VehicleId",
                        column: x => x.VehicleId,
                        principalTable: "Vehicles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FuelLogs_FillUpDate",
                table: "FuelLogs",
                column: "FillUpDate");

            migrationBuilder.CreateIndex(
                name: "IX_FuelLogs_VehicleId",
                table: "FuelLogs",
                column: "VehicleId");

            migrationBuilder.CreateIndex(
                name: "IX_OdometerReadings_ReadingDate",
                table: "OdometerReadings",
                column: "ReadingDate");

            migrationBuilder.CreateIndex(
                name: "IX_OdometerReadings_VehicleId",
                table: "OdometerReadings",
                column: "VehicleId");

            migrationBuilder.CreateIndex(
                name: "IX_Vehicles_AssetId",
                table: "Vehicles",
                column: "AssetId");

            migrationBuilder.CreateIndex(
                name: "IX_Vehicles_HouseholdId",
                table: "Vehicles",
                column: "HouseholdId");

            migrationBuilder.CreateIndex(
                name: "IX_Vehicles_VIN",
                table: "Vehicles",
                column: "VIN");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FuelLogs");

            migrationBuilder.DropTable(
                name: "OdometerReadings");

            migrationBuilder.DropTable(
                name: "Vehicles");
        }
    }
}
