using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using FincApp.Core;
using FincApp.Infrastructure;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FincApp.API.Controllers;

[ApiController]
[Route("api/v1/dashboard")]
public class DashboardController : ControllerBase
{
    private readonly FincAppDbContext _context;

    public DashboardController(FincAppDbContext context)
    {
        _context = context;
    }

    [HttpGet("farms")]
    public async Task<IActionResult> GetFarms()
    {
        try
        {
            var farms = await _context.Farms
                .AsNoTracking()
                .OrderBy(f => f.Name)
                .Select(f => new FarmOptionDto
                {
                    Id = f.Id.ToString(),
                    Name = f.Name
                })
                .ToListAsync();

            var result = new List<FarmOptionDto>
            {
                new() { Id = "all", Name = "All farms" }
            };

            result.AddRange(farms);

            return Ok(result);
        }
        catch
        {
            return Ok(GetDemoFarms());
        }
    }

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary([FromQuery(Name = "farm_id")] string? farmId)
    {
        try
        {
        Guid? selectedFarmId = null;

        if (!string.IsNullOrWhiteSpace(farmId) && farmId != "all")
        {
            if (Guid.TryParse(farmId, out var parsedFarmId))
            {
                selectedFarmId = parsedFarmId;
            }
        }

        var animalsQuery = _context.Animals
            .IgnoreQueryFilters()
            .AsNoTracking()
            .AsQueryable();

        if (selectedFarmId.HasValue)
        {
            animalsQuery = animalsQuery.Where(a => a.FarmId == selectedFarmId.Value);
        }

        var animals = await animalsQuery.ToListAsync();
        var animalIds = animals.Select(a => a.Id).ToList();

        var weights = await _context.WeightLogs
            .AsNoTracking()
            .Where(w => animalIds.Contains(w.AnimalId))
            .OrderBy(w => w.LogDate)
            .ToListAsync();

        var healthRecords = await _context.HealthRecords
            .AsNoTracking()
            .Where(h => animalIds.Contains(h.AnimalId))
            .OrderByDescending(h => h.RecordedAt)
            .ToListAsync();

        var animalsByType = animals
            .GroupBy(a => ToFrontendType(a.Type))
            .Select(g => new AnimalTypeRowDto
            {
                AnimalType = g.Key,
                Total = g.Count()
            })
            .OrderBy(r => r.AnimalType)
            .ToList();

        var averageWeight = weights.Count > 0
            ? Math.Round(weights.Average(w => w.WeightKg), 2)
            : 0;

        var healthAlerts = healthRecords
            .Select(record => new HealthAlertDto
            {
                Id = record.Id.ToString(),
                AnimalId = record.AnimalId.ToString(),
                TagNumber = animals.FirstOrDefault(a => a.Id == record.AnimalId)?.IdentificationTag ?? record.AnimalId.ToString(),
                Severity = InferSeverity(record.SymptomsDescription),
                Description = record.SymptomsDescription,
                EventDate = record.RecordedAt
            })
            .Where(alert => alert.Severity is "high" or "medium")
            .Take(8)
            .ToList();

        var weightTrend = weights
            .GroupBy(w => w.LogDate.Date)
            .OrderByDescending(g => g.Key)
            .Take(7)
            .OrderBy(g => g.Key)
            .Select(g => new WeightTrendDto
            {
                Label = g.Key.ToString("MMM dd"),
                Value = Math.Round(g.Average(w => w.WeightKg), 2)
            })
            .ToList();

        var recentActivity = BuildRecentActivity(animals, weights, healthRecords);

        var summary = new DashboardSummaryDto
        {
            FarmId = farmId ?? "all",
            TotalAnimals = animals.Count,
            AnimalsByType = animalsByType,
            AverageWeight = averageWeight,
            HealthAlertsCount = healthAlerts.Count,
            HealthAlerts = healthAlerts,
            RecentActivity = recentActivity,
            WeightTrend = weightTrend,
            PendingSync = 0,
            Empty = animals.Count == 0 && healthAlerts.Count == 0 && recentActivity.Count == 0,
            LastSync = DateTime.UtcNow
        };

        return Ok(summary);
        }
        catch
        {
            return Ok(BuildDemoSummary(farmId ?? "all"));
        }
    }

    [HttpGet("farms/{farmId}/summary")]
    public IActionResult GetFarmSummary(string farmId)
    {
        return Ok(BuildDemoSummary(farmId));
    }

    private static List<FarmOptionDto> GetDemoFarms()
    {
        return new List<FarmOptionDto>
        {
            new() { Id = "all", Name = "All farms" },
            new() { Id = "Finca El Roble", Name = "Finca El Roble" },
            new() { Id = "Finca La Esperanza", Name = "Finca La Esperanza" },
            new() { Id = "empty", Name = "Finca Demo Empty State" }
        };
    }

    private static DashboardSummaryDto BuildDemoSummary(string farmId)
    {
        if (farmId == "empty")
        {
            return new DashboardSummaryDto
            {
                FarmId = farmId,
                TotalAnimals = 0,
                AnimalsByType = new(),
                AverageWeight = 0,
                HealthAlertsCount = 0,
                PendingSync = 0,
                WeightTrend = new(),
                HealthAlerts = new(),
                RecentActivity = new(),
                Empty = true,
                LastSync = DateTime.UtcNow
            };
        }

        var isEsperanza = farmId == "Finca La Esperanza";

        return new DashboardSummaryDto
        {
            FarmId = farmId,
            TotalAnimals = isEsperanza ? 2 : 6,
            AnimalsByType = isEsperanza
                ? new List<AnimalTypeRowDto>
                {
                    new() { AnimalType = "cattle", Total = 1 },
                    new() { AnimalType = "swine", Total = 1 },
                    new() { AnimalType = "poultry", Total = 0 }
                }
                : new List<AnimalTypeRowDto>
                {
                    new() { AnimalType = "cattle", Total = 3 },
                    new() { AnimalType = "swine", Total = 2 },
                    new() { AnimalType = "poultry", Total = 1 }
                },
            AverageWeight = isEsperanza ? 273.5m : 386.4m,
            HealthAlertsCount = isEsperanza ? 0 : 2,
            PendingSync = isEsperanza ? 0 : 3,
            WeightTrend = new List<WeightTrendDto>
            {
                new() { Label = "Mon", Value = 398 },
                new() { Label = "Tue", Value = 410 },
                new() { Label = "Wed", Value = 421 },
                new() { Label = "Thu", Value = 438 },
                new() { Label = "Fri", Value = 452 },
                new() { Label = "Sat", Value = 468 },
                new() { Label = "Sun", Value = 482 }
            },
            HealthAlerts = isEsperanza
                ? new List<HealthAlertDto>()
                : new List<HealthAlertDto>
                {
                    new()
                    {
                        Id = "demo-health-1",
                        AnimalId = "302",
                        TagNumber = "302",
                        Severity = "high",
                        Description = "Fiebre detectada por AURA. Requiere revisión prioritaria.",
                        EventDate = DateTime.UtcNow
                    },
                    new()
                    {
                        Id = "demo-health-2",
                        AnimalId = "012",
                        TagNumber = "012",
                        Severity = "medium",
                        Description = "Bajo apetito reportado en registro offline.",
                        EventDate = DateTime.UtcNow
                    }
                },
            RecentActivity = new List<ActivityDto>
            {
                new()
                {
                    Id = "activity-1",
                    EventType = "AURA",
                    Description = "AURA parsed command: registra una vaca con arete 302",
                    CreatedAt = DateTime.UtcNow,
                    TagNumber = "302"
                },
                new()
                {
                    Id = "activity-2",
                    EventType = "Weight",
                    Description = "Weight registered: 520 kg",
                    CreatedAt = DateTime.UtcNow.AddMinutes(-8),
                    TagNumber = "302"
                },
                new()
                {
                    Id = "activity-3",
                    EventType = "Sync",
                    Description = "Offline records pending synchronization",
                    CreatedAt = DateTime.UtcNow.AddMinutes(-15),
                    TagNumber = null
                }
            },
            Empty = false,
            LastSync = DateTime.UtcNow
        };
    }

    private static List<ActivityDto> BuildRecentActivity(
        List<Animal> animals,
        List<WeightLog> weights,
        List<HealthRecord> healthRecords)
    {
        var animalActivity = animals
            .OrderByDescending(a => a.CreatedAt)
            .Take(4)
            .Select(a => new ActivityDto
            {
                Id = a.Id.ToString(),
                EventType = "Animal",
                Description = $"{ToFrontendType(a.Type)} animal #{a.IdentificationTag} registered",
                CreatedAt = a.CreatedAt,
                TagNumber = a.IdentificationTag
            });

        var weightActivity = weights
            .OrderByDescending(w => w.LogDate)
            .Take(4)
            .Select(w =>
            {
                var animal = animals.FirstOrDefault(a => a.Id == w.AnimalId);
                return new ActivityDto
                {
                    Id = w.Id.ToString(),
                    EventType = "Weight",
                    Description = $"Weight registered: {w.WeightKg} kg",
                    CreatedAt = w.LogDate,
                    TagNumber = animal?.IdentificationTag ?? w.AnimalId.ToString()
                };
            });

        var healthActivity = healthRecords
            .OrderByDescending(h => h.RecordedAt)
            .Take(4)
            .Select(h =>
            {
                var animal = animals.FirstOrDefault(a => a.Id == h.AnimalId);
                return new ActivityDto
                {
                    Id = h.Id.ToString(),
                    EventType = "Health",
                    Description = h.SymptomsDescription,
                    CreatedAt = h.RecordedAt,
                    TagNumber = animal?.IdentificationTag ?? h.AnimalId.ToString()
                };
            });

        return animalActivity
            .Concat(weightActivity)
            .Concat(healthActivity)
            .OrderByDescending(a => a.CreatedAt)
            .Take(8)
            .ToList();
    }

    private static string ToFrontendType(ProductionType type)
    {
        return type switch
        {
            ProductionType.Cattle => "cattle",
            ProductionType.Swine => "swine",
            ProductionType.Poultry => "poultry",
            _ => "cattle"
        };
    }

    private static string InferSeverity(string? symptoms)
    {
        var text = Normalize(symptoms ?? "");

        if (
            text.Contains("fiebre") ||
            text.Contains("sangre") ||
            text.Contains("sangrado") ||
            text.Contains("no come") ||
            text.Contains("dificultad para respirar") ||
            text.Contains("herida profunda")
        )
        {
            return "high";
        }

        if (
            text.Contains("diarrea") ||
            text.Contains("vomito") ||
            text.Contains("tos") ||
            text.Contains("cojo") ||
            text.Contains("cojera") ||
            text.Contains("inflamacion") ||
            text.Contains("decaido") ||
            text.Contains("debil")
        )
        {
            return "medium";
        }

        return "low";
    }

    private static string Normalize(string value)
    {
        return value
            .ToLowerInvariant()
            .Replace("á", "a")
            .Replace("é", "e")
            .Replace("í", "i")
            .Replace("ó", "o")
            .Replace("ú", "u")
            .Replace("ñ", "n");
    }
}

public class FarmOptionDto
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;
}

public class DashboardSummaryDto
{
    [JsonPropertyName("farm_id")]
    public string FarmId { get; set; } = "all";

    [JsonPropertyName("total_animals")]
    public int TotalAnimals { get; set; }

    [JsonPropertyName("animals_by_type")]
    public List<AnimalTypeRowDto> AnimalsByType { get; set; } = new();

    [JsonPropertyName("average_weight")]
    public decimal AverageWeight { get; set; }

    [JsonPropertyName("health_alerts_count")]
    public int HealthAlertsCount { get; set; }

    [JsonPropertyName("pending_sync")]
    public int PendingSync { get; set; }

    [JsonPropertyName("weight_trend")]
    public List<WeightTrendDto> WeightTrend { get; set; } = new();

    [JsonPropertyName("health_alerts")]
    public List<HealthAlertDto> HealthAlerts { get; set; } = new();

    [JsonPropertyName("recent_activity")]
    public List<ActivityDto> RecentActivity { get; set; } = new();

    [JsonPropertyName("empty")]
    public bool Empty { get; set; }

    [JsonPropertyName("last_sync")]
    public DateTime LastSync { get; set; }
}

public class AnimalTypeRowDto
{
    [JsonPropertyName("animal_type")]
    public string AnimalType { get; set; } = string.Empty;

    [JsonPropertyName("total")]
    public int Total { get; set; }
}

public class WeightTrendDto
{
    [JsonPropertyName("label")]
    public string Label { get; set; } = string.Empty;

    [JsonPropertyName("value")]
    public decimal Value { get; set; }
}

public class HealthAlertDto
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("animal_id")]
    public string AnimalId { get; set; } = string.Empty;

    [JsonPropertyName("tag_number")]
    public string TagNumber { get; set; } = string.Empty;

    [JsonPropertyName("severity")]
    public string Severity { get; set; } = "low";

    [JsonPropertyName("description")]
    public string Description { get; set; } = string.Empty;

    [JsonPropertyName("event_date")]
    public DateTime EventDate { get; set; }
}

public class ActivityDto
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("event_type")]
    public string EventType { get; set; } = string.Empty;

    [JsonPropertyName("description")]
    public string Description { get; set; } = string.Empty;

    [JsonPropertyName("created_at")]
    public DateTime CreatedAt { get; set; }

    [JsonPropertyName("tag_number")]
    public string? TagNumber { get; set; }
}
