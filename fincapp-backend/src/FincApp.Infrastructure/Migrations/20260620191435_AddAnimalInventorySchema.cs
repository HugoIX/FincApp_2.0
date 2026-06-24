using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FincApp.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAnimalInventorySchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "animals",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    farm_id = table.Column<Guid>(type: "uuid", nullable: false),
                    type = table.Column<int>(type: "production_type", nullable: false),
                    identification_tag = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    birth_date = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false, defaultValue: "healthy"),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_animals", x => x.id);
                    table.ForeignKey(
                        name: "fk_animal_farm",
                        column: x => x.farm_id,
                        principalTable: "farms",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "health_records",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    animal_id = table.Column<Guid>(type: "uuid", nullable: false),
                    symptoms_description = table.Column<string>(type: "text", nullable: false),
                    diagnosis = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    treatment_administered = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    recorded_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_health_records", x => x.id);
                    table.ForeignKey(
                        name: "fk_health_animal",
                        column: x => x.animal_id,
                        principalTable: "animals",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "weight_logs",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    animal_id = table.Column<Guid>(type: "uuid", nullable: false),
                    weight_kg = table.Column<decimal>(type: "numeric(6,2)", nullable: false),
                    log_date = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_weight_logs", x => x.id);
                    table.ForeignKey(
                        name: "fk_weight_animal",
                        column: x => x.animal_id,
                        principalTable: "animals",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "idx_animals_farm",
                table: "animals",
                column: "farm_id");

            migrationBuilder.CreateIndex(
                name: "uq_farm_animal_tag",
                table: "animals",
                columns: new[] { "farm_id", "identification_tag" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_health_animal",
                table: "health_records",
                column: "animal_id");

            migrationBuilder.CreateIndex(
                name: "idx_weight_animal",
                table: "weight_logs",
                column: "animal_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "health_records");

            migrationBuilder.DropTable(
                name: "weight_logs");

            migrationBuilder.DropTable(
                name: "animals");
        }
    }
}
