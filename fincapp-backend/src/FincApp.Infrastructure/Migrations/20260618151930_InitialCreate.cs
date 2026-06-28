using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FincApp.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
                        CREATE TYPE user_role AS ENUM ('admin', 'worker');
                    END IF;
                END
                $$;
            """);

            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'production_type') THEN
                        CREATE TYPE production_type AS ENUM ('cattle', 'swine', 'poultry');
                    END IF;
                END
                $$;
            """);

            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:Enum:production_type.production_type", "cattle,swine,poultry")
                .Annotation("Npgsql:Enum:user_role.user_role", "admin,worker");

            migrationBuilder.CreateTable(
                name: "users",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    email = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    password_hash = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    role = table.Column<string>(type: "user_role", nullable: false, defaultValueSql: "'worker'::user_role"),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_users", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "farms",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    owner_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    location = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_farms", x => x.id);
                    table.ForeignKey(
                        name: "fk_farm_owner",
                        column: x => x.owner_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "farm_assignments",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    farm_id = table.Column<Guid>(type: "uuid", nullable: false),
                    assigned_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_farm_assignments", x => x.id);
                    table.ForeignKey(
                        name: "fk_assignment_farm",
                        column: x => x.farm_id,
                        principalTable: "farms",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_assignment_user",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "production_modules",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    farm_id = table.Column<Guid>(type: "uuid", nullable: false),
                    type = table.Column<int>(type: "production_type", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_production_modules", x => x.id);
                    table.ForeignKey(
                        name: "fk_module_farm",
                        column: x => x.farm_id,
                        principalTable: "farms",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_farm_assignments_farm_id",
                table: "farm_assignments",
                column: "farm_id");

            migrationBuilder.CreateIndex(
                name: "uq_user_farm_assignment",
                table: "farm_assignments",
                columns: new[] { "user_id", "farm_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_farms_owner",
                table: "farms",
                column: "owner_id");

            migrationBuilder.CreateIndex(
                name: "idx_modules_farm_type",
                table: "production_modules",
                columns: new[] { "farm_id", "type" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_users_email",
                table: "users",
                column: "email",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "farm_assignments");

            migrationBuilder.DropTable(
                name: "production_modules");

            migrationBuilder.DropTable(
                name: "farms");

            migrationBuilder.DropTable(
                name: "users");

            migrationBuilder.Sql("DROP TYPE IF EXISTS production_type;");
            migrationBuilder.Sql("DROP TYPE IF EXISTS user_role;");
        }
    }
}
