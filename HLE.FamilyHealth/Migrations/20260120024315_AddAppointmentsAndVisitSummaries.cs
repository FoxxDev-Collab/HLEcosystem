using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace HLE.FamilyHealth.Migrations
{
    /// <inheritdoc />
    public partial class AddAppointmentsAndVisitSummaries : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Appointments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    FamilyMemberId = table.Column<int>(type: "integer", nullable: false),
                    ProviderId = table.Column<int>(type: "integer", nullable: true),
                    AppointmentDateTime = table.Column<DateTime>(type: "timestamptz", nullable: false),
                    DurationMinutes = table.Column<int>(type: "integer", nullable: true),
                    AppointmentType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Location = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    ReasonForVisit = table.Column<string>(type: "text", nullable: true),
                    PreAppointmentNotes = table.Column<string>(type: "text", nullable: true),
                    ReminderSent = table.Column<bool>(type: "boolean", nullable: false),
                    ReminderSentAt = table.Column<DateTime>(type: "timestamptz", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamptz", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamptz", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Appointments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Appointments_FamilyMembers_FamilyMemberId",
                        column: x => x.FamilyMemberId,
                        principalTable: "FamilyMembers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Appointments_Providers_ProviderId",
                        column: x => x.ProviderId,
                        principalTable: "Providers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "VisitSummaries",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    AppointmentId = table.Column<int>(type: "integer", nullable: true),
                    FamilyMemberId = table.Column<int>(type: "integer", nullable: false),
                    ProviderId = table.Column<int>(type: "integer", nullable: true),
                    VisitDate = table.Column<DateTime>(type: "timestamptz", nullable: false),
                    ChiefComplaint = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Diagnosis = table.Column<string>(type: "text", nullable: true),
                    TreatmentProvided = table.Column<string>(type: "text", nullable: true),
                    PrescriptionsWritten = table.Column<string>(type: "text", nullable: true),
                    LabTestsOrdered = table.Column<string>(type: "text", nullable: true),
                    FollowUpInstructions = table.Column<string>(type: "text", nullable: true),
                    NextVisitRecommended = table.Column<DateTime>(type: "timestamptz", nullable: true),
                    AttachedDocuments = table.Column<string>(type: "text", nullable: true),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    VisitType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamptz", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamptz", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VisitSummaries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_VisitSummaries_Appointments_AppointmentId",
                        column: x => x.AppointmentId,
                        principalTable: "Appointments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_VisitSummaries_FamilyMembers_FamilyMemberId",
                        column: x => x.FamilyMemberId,
                        principalTable: "FamilyMembers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_VisitSummaries_Providers_ProviderId",
                        column: x => x.ProviderId,
                        principalTable: "Providers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Appointments_AppointmentDateTime",
                table: "Appointments",
                column: "AppointmentDateTime");

            migrationBuilder.CreateIndex(
                name: "IX_Appointments_FamilyMemberId",
                table: "Appointments",
                column: "FamilyMemberId");

            migrationBuilder.CreateIndex(
                name: "IX_Appointments_ProviderId",
                table: "Appointments",
                column: "ProviderId");

            migrationBuilder.CreateIndex(
                name: "IX_Appointments_Status",
                table: "Appointments",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_VisitSummaries_AppointmentId",
                table: "VisitSummaries",
                column: "AppointmentId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_VisitSummaries_FamilyMemberId",
                table: "VisitSummaries",
                column: "FamilyMemberId");

            migrationBuilder.CreateIndex(
                name: "IX_VisitSummaries_ProviderId",
                table: "VisitSummaries",
                column: "ProviderId");

            migrationBuilder.CreateIndex(
                name: "IX_VisitSummaries_VisitDate",
                table: "VisitSummaries",
                column: "VisitDate");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "VisitSummaries");

            migrationBuilder.DropTable(
                name: "Appointments");
        }
    }
}
