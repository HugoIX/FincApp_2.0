using System;
using System.Threading;
using System.Threading.Tasks;
using FincApp.Core;
using FincApp.Core.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace FincApp.Infrastructure;

public class FincAppDbContext : DbContext
{
    private readonly ITenantProvider _tenantProvider;

    public FincAppDbContext(DbContextOptions<FincAppDbContext> options, ITenantProvider tenantProvider)
        : base(options)
    {
        _tenantProvider = tenantProvider;
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<Farm> Farms => Set<Farm>();
    public DbSet<FarmAssignment> FarmAssignments => Set<FarmAssignment>();
    public DbSet<ProductionModule> ProductionModules => Set<ProductionModule>();
    public DbSet<Animal> Animals => Set<Animal>();
    public DbSet<WeightLog> WeightLogs => Set<WeightLog>();
    public DbSet<HealthRecord> HealthRecords => Set<HealthRecord>();
    public DbSet<SyncTelemetryLog> SyncTelemetryLogs => Set<SyncTelemetryLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.HasPostgresEnum<UserRole>("user_role");
        modelBuilder.HasPostgresEnum<ProductionType>("production_type");

        modelBuilder.Entity<User>(entity =>
        {
            entity.ToTable("users");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.Email).HasColumnName("email").HasMaxLength(255).IsRequired();
            entity.HasIndex(e => e.Email).IsUnique();
            entity.Property(e => e.PasswordHash).HasColumnName("password_hash").HasMaxLength(255).IsRequired();
            entity.Property(e => e.Role).HasColumnName("role").HasColumnType("user_role").HasDefaultValue(UserRole.Worker).IsRequired();
            entity.Property(e => e.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("CURRENT_TIMESTAMP").IsRequired();
        });

        modelBuilder.Entity<Farm>(entity =>
        {
            entity.ToTable("farms");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.OwnerId).HasColumnName("owner_id").IsRequired();
            entity.Property(e => e.Name).HasColumnName("name").HasMaxLength(100).IsRequired();
            entity.Property(e => e.Location).HasColumnName("location").HasMaxLength(255);
            entity.Property(e => e.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("CURRENT_TIMESTAMP").IsRequired();

            entity.HasOne(e => e.Owner)
                .WithMany(u => u.OwnedFarms)
                .HasForeignKey(e => e.OwnerId)
                .HasConstraintName("fk_farm_owner")
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(e => e.OwnerId).HasDatabaseName("idx_farms_owner");
        });

        modelBuilder.Entity<FarmAssignment>(entity =>
        {
            entity.ToTable("farm_assignments");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.UserId).HasColumnName("user_id").IsRequired();
            entity.Property(e => e.FarmId).HasColumnName("farm_id").IsRequired();
            entity.Property(e => e.AssignedAt).HasColumnName("assigned_at").HasDefaultValueSql("CURRENT_TIMESTAMP").IsRequired();

            entity.HasOne(e => e.User)
                .WithMany(u => u.Assignments)
                .HasForeignKey(e => e.UserId)
                .HasConstraintName("fk_assignment_user")
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Farm)
                .WithMany(f => f.Assignments)
                .HasForeignKey(e => e.FarmId)
                .HasConstraintName("fk_assignment_farm")
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(e => new { e.UserId, e.FarmId }).IsUnique().HasDatabaseName("uq_user_farm_assignment");
        });

        modelBuilder.Entity<ProductionModule>(entity =>
        {
            entity.ToTable("production_modules");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.FarmId).HasColumnName("farm_id").IsRequired();
            entity.Property(e => e.Type).HasColumnName("type").HasColumnType("production_type").IsRequired();
            entity.Property(e => e.IsActive).HasColumnName("is_active").HasDefaultValue(true).IsRequired();
            entity.Property(e => e.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("CURRENT_TIMESTAMP").IsRequired();

            entity.HasOne(e => e.Farm)
                .WithMany(f => f.ProductionModules)
                .HasForeignKey(e => e.FarmId)
                .HasConstraintName("fk_module_farm")
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(e => new { e.FarmId, e.Type }).IsUnique().HasDatabaseName("uq_farm_module_type");
            entity.HasIndex(e => new { e.FarmId, e.Type }).HasDatabaseName("idx_modules_farm_type");

            entity.HasQueryFilter(e => _tenantProvider.TenantId != null && e.FarmId == _tenantProvider.TenantId.Value);
        });

        modelBuilder.Entity<Animal>(entity =>
        {
            entity.ToTable("animals");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.FarmId).HasColumnName("farm_id").IsRequired();
            entity.Property(e => e.Type).HasColumnName("type").HasColumnType("production_type").IsRequired();
            entity.Property(e => e.IdentificationTag).HasColumnName("identification_tag").HasMaxLength(50).IsRequired();
            entity.Property(e => e.BirthDate).HasColumnName("birth_date");
            entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(50).HasDefaultValue("healthy").IsRequired();
            entity.Property(e => e.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("CURRENT_TIMESTAMP").IsRequired();

            entity.HasOne(e => e.Farm)
                .WithMany()
                .HasForeignKey(e => e.FarmId)
                .HasConstraintName("fk_animal_farm")
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(e => new { e.FarmId, e.IdentificationTag }).IsUnique().HasDatabaseName("uq_farm_animal_tag");
            entity.HasIndex(e => e.FarmId).HasDatabaseName("idx_animals_farm");

            entity.HasQueryFilter(e => _tenantProvider.TenantId != null && e.FarmId == _tenantProvider.TenantId.Value);
        });

        modelBuilder.Entity<WeightLog>(entity =>
        {
            entity.ToTable("weight_logs");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.AnimalId).HasColumnName("animal_id").IsRequired();
            entity.Property(e => e.WeightKg).HasColumnName("weight_kg").HasColumnType("numeric(6,2)").IsRequired();
            entity.Property(e => e.LogDate).HasColumnName("log_date").HasDefaultValueSql("CURRENT_TIMESTAMP").IsRequired();

            entity.HasOne(e => e.Animal)
                .WithMany(a => a.WeightLogs)
                .HasForeignKey(e => e.AnimalId)
                .HasConstraintName("fk_weight_animal")
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(e => e.AnimalId).HasDatabaseName("idx_weight_animal");
        });

        modelBuilder.Entity<HealthRecord>(entity =>
        {
            entity.ToTable("health_records");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.AnimalId).HasColumnName("animal_id").IsRequired();
            entity.Property(e => e.SymptomsDescription).HasColumnName("symptoms_description").IsRequired();
            entity.Property(e => e.Diagnosis).HasColumnName("diagnosis").HasMaxLength(150);
            entity.Property(e => e.TreatmentAdministered).HasColumnName("treatment_administered").HasMaxLength(255);
            entity.Property(e => e.RecordedAt).HasColumnName("recorded_at").HasDefaultValueSql("CURRENT_TIMESTAMP").IsRequired();

            entity.HasOne(e => e.Animal)
                .WithMany(a => a.HealthRecords)
                .HasForeignKey(e => e.AnimalId)
                .HasConstraintName("fk_health_animal")
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(e => e.AnimalId).HasDatabaseName("idx_health_animal");
        });

        modelBuilder.Entity<SyncTelemetryLog>(entity =>
        {
            entity.ToTable("sync_telemetry_logs");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.DeviceUuid).HasColumnName("device_uuid").HasMaxLength(100).IsRequired();
            entity.Property(e => e.UserId).HasColumnName("user_id").IsRequired();
            entity.Property(e => e.FarmId).HasColumnName("farm_id").IsRequired();
            entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(30).IsRequired();
            entity.Property(e => e.RowsSynced).HasColumnName("rows_synced").HasDefaultValue(0).IsRequired();
            entity.Property(e => e.ErrorMessage).HasColumnName("error_message");
            entity.Property(e => e.SynchronizedAt).HasColumnName("synchronized_at").HasDefaultValueSql("CURRENT_TIMESTAMP").IsRequired();

            entity.HasOne(e => e.User)
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .HasConstraintName("fk_sync_user")
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.Farm)
                .WithMany()
                .HasForeignKey(e => e.FarmId)
                .HasConstraintName("fk_sync_farm")
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(e => e.FarmId).HasDatabaseName("idx_sync_telemetry_farm");
        });
    }

    public override int SaveChanges()
    {
        ApplyTenantId();
        return base.SaveChanges();
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        ApplyTenantId();
        return base.SaveChangesAsync(cancellationToken);
    }

    private void ApplyTenantId()
    {
        var tenantId = _tenantProvider.TenantId;
        if (tenantId == null) return;

        foreach (var entry in ChangeTracker.Entries())
        {
            if (entry.State == EntityState.Added)
            {
                if (entry.Entity is ProductionModule module && module.FarmId == Guid.Empty)
                {
                    module.FarmId = tenantId.Value;
                }
                else if (entry.Entity is FarmAssignment assignment && assignment.FarmId == Guid.Empty)
                {
                    assignment.FarmId = tenantId.Value;
                }
                else if (entry.Entity is Animal animal && animal.FarmId == Guid.Empty)
                {
                    animal.FarmId = tenantId.Value;
                }
                else if (entry.Entity is SyncTelemetryLog log && log.FarmId == Guid.Empty)
                {
                    log.FarmId = tenantId.Value;
                }
            }
        }
    }
}
