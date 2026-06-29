using System;
using System.Linq;
using System.Threading.Tasks;
using FincApp.API.DTOs;
using FincApp.Core;
using FincApp.Core.Interfaces;
using FincApp.Infrastructure;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FincApp.API.Controllers;

[ApiController]
[Route("api")]
public class SyncController : ControllerBase
{
    private readonly FincAppDbContext _context;
    private readonly ITenantProvider _tenantProvider;

    public SyncController(FincAppDbContext context, ITenantProvider tenantProvider)
    {
        _context = context;
        _tenantProvider = tenantProvider;
    }

    [HttpPost("farms/{farmId}/sync")]
    [HttpPost("v1/farms/{farmId}/sync")]
    public async Task<IActionResult> BulkSync(Guid farmId, [FromBody] BulkSyncRequestDto request)
    {
        var tenantId = _tenantProvider.TenantId;
        if (tenantId == null || tenantId != farmId)
        {
            return StatusCode(403, "Access to this farm's sync is forbidden.");
        }

        // Validate that user exists
        var userExists = await _context.Users.AnyAsync(u => u.Id == request.UserId);
        if (!userExists)
        {
            return BadRequest(new { message = $"User with ID {request.UserId} does not exist." });
        }

        // Total rows to sync
        int totalRows = request.PayloadMutations.Animals.Count +
                        request.PayloadMutations.WeightLogs.Count +
                        request.PayloadMutations.HealthRecords.Count;

        using var transaction = await _context.Database.BeginTransactionAsync();

        try
        {
            // 1. Process Animals
            foreach (var animalDto in request.PayloadMutations.Animals)
            {
                // Check if already exists to avoid PK duplicate exception
                var exists = await _context.Animals.AnyAsync(a => a.Id == animalDto.Id);
                if (exists)
                {
                    continue; // Skip or could update, but requirement says "new animals"
                }

                var animal = new Animal
                {
                    Id = animalDto.Id,
                    FarmId = farmId,
                    Type = animalDto.Type,
                    IdentificationTag = animalDto.IdentificationTag,
                    BirthDate = animalDto.BirthDate,
                    Status = animalDto.Status
                };
                _context.Animals.Add(animal);
            }

            // 2. Process Weight Logs
            foreach (var weightDto in request.PayloadMutations.WeightLogs)
            {
                var weightLog = new WeightLog
                {
                    Id = weightDto.Id ?? Guid.NewGuid(),
                    AnimalId = weightDto.AnimalId,
                    WeightKg = weightDto.WeightKg,
                    LogDate = weightDto.LogDate
                };
                _context.WeightLogs.Add(weightLog);
            }

            // 3. Process Health Records
            foreach (var healthDto in request.PayloadMutations.HealthRecords)
            {
                var healthRecord = new HealthRecord
                {
                    Id = healthDto.Id ?? Guid.NewGuid(),
                    AnimalId = healthDto.AnimalId,
                    SymptomsDescription = healthDto.SymptomsDescription,
                    Diagnosis = healthDto.Diagnosis,
                    TreatmentAdministered = healthDto.TreatmentAdministered,
                    RecordedAt = healthDto.RecordedAt ?? DateTime.UtcNow
                };
                _context.HealthRecords.Add(healthRecord);
            }

            // Save all modifications
            await _context.SaveChangesAsync();

            // 4. Create Success Telemetry Log
            var telemetrySuccess = new SyncTelemetryLog
            {
                DeviceUuid = request.DeviceUuid,
                UserId = request.UserId,
                FarmId = farmId,
                Status = "success",
                RowsSynced = totalRows,
                ErrorMessage = null,
                SynchronizedAt = DateTime.UtcNow
            };
            _context.SyncTelemetryLogs.Add(telemetrySuccess);
            await _context.SaveChangesAsync();

            await transaction.CommitAsync();

            return Ok(new
            {
                status = "success",
                rows_synced = totalRows,
                message = "Synchronization completed successfully."
            });
        }
        catch (Exception ex)
        {
            // Rollback database mutations
            await transaction.RollbackAsync();

            // Clean DbContext to discard failed entities and save only the error log
            _context.ChangeTracker.Clear();

            try
            {
                var telemetryFailed = new SyncTelemetryLog
                {
                    DeviceUuid = request.DeviceUuid,
                    UserId = request.UserId,
                    FarmId = farmId,
                    Status = "failed",
                    RowsSynced = 0,
                    ErrorMessage = ex.InnerException?.Message ?? ex.Message,
                    SynchronizedAt = DateTime.UtcNow
                };
                _context.SyncTelemetryLogs.Add(telemetryFailed);
                await _context.SaveChangesAsync();
            }
            catch (Exception telemetryEx)
            {
                // In case saving telemetry also fails, log it to console/diagnostics
                Console.WriteLine($"Critical: Failed to save sync failure telemetry. Error: {telemetryEx.Message}");
            }

            return BadRequest(new
            {
                status = "failed",
                error = ex.InnerException?.Message ?? ex.Message,
                message = "Synchronization failed. All changes have been rolled back."
            });
        }
    }
}
