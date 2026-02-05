using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace HLE.FamilyHealth.Migrations
{
    /// <inheritdoc />
    public partial class AddWorkoutTracking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Workouts",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    FamilyMemberId = table.Column<int>(type: "integer", nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    StartTime = table.Column<DateTime>(type: "timestamptz", nullable: false),
                    EndTime = table.Column<DateTime>(type: "timestamptz", nullable: true),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamptz", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamptz", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Workouts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Workouts_FamilyMembers_FamilyMemberId",
                        column: x => x.FamilyMemberId,
                        principalTable: "FamilyMembers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "WorkoutExercises",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    WorkoutId = table.Column<int>(type: "integer", nullable: false),
                    ExerciseName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    OrderIndex = table.Column<int>(type: "integer", nullable: false),
                    SupersetGroupId = table.Column<int>(type: "integer", nullable: true),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkoutExercises", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WorkoutExercises_Workouts_WorkoutId",
                        column: x => x.WorkoutId,
                        principalTable: "Workouts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ExerciseSets",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    WorkoutExerciseId = table.Column<int>(type: "integer", nullable: false),
                    SetIndex = table.Column<int>(type: "integer", nullable: false),
                    SetType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false, defaultValue: "normal"),
                    WeightLbs = table.Column<decimal>(type: "numeric(8,2)", precision: 8, scale: 2, nullable: true),
                    Reps = table.Column<int>(type: "integer", nullable: true),
                    DistanceMiles = table.Column<decimal>(type: "numeric(8,3)", precision: 8, scale: 3, nullable: true),
                    DurationSeconds = table.Column<int>(type: "integer", nullable: true),
                    Rpe = table.Column<decimal>(type: "numeric(3,1)", precision: 3, scale: 1, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExerciseSets", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ExerciseSets_WorkoutExercises_WorkoutExerciseId",
                        column: x => x.WorkoutExerciseId,
                        principalTable: "WorkoutExercises",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ExerciseSets_WorkoutExerciseId",
                table: "ExerciseSets",
                column: "WorkoutExerciseId");

            migrationBuilder.CreateIndex(
                name: "IX_ExerciseSets_WorkoutExerciseId_SetIndex",
                table: "ExerciseSets",
                columns: new[] { "WorkoutExerciseId", "SetIndex" });

            migrationBuilder.CreateIndex(
                name: "IX_WorkoutExercises_ExerciseName",
                table: "WorkoutExercises",
                column: "ExerciseName");

            migrationBuilder.CreateIndex(
                name: "IX_WorkoutExercises_WorkoutId",
                table: "WorkoutExercises",
                column: "WorkoutId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkoutExercises_WorkoutId_OrderIndex",
                table: "WorkoutExercises",
                columns: new[] { "WorkoutId", "OrderIndex" });

            migrationBuilder.CreateIndex(
                name: "IX_Workouts_FamilyMemberId",
                table: "Workouts",
                column: "FamilyMemberId");

            migrationBuilder.CreateIndex(
                name: "IX_Workouts_FamilyMemberId_StartTime",
                table: "Workouts",
                columns: new[] { "FamilyMemberId", "StartTime" });

            migrationBuilder.CreateIndex(
                name: "IX_Workouts_StartTime",
                table: "Workouts",
                column: "StartTime");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ExerciseSets");

            migrationBuilder.DropTable(
                name: "WorkoutExercises");

            migrationBuilder.DropTable(
                name: "Workouts");
        }
    }
}
