using System;
using System.Linq;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using FincApp.Core;
using FincApp.Infrastructure;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FincApp.API.Controllers;

[ApiController]
[Route("api")]
public class AnimalCompatibilityController : ControllerBase
{
    private readonly FincAppDbContext _context;

    public AnimalCompatibilityController(FincAppDbContext context)
    {
        _context = context;
    }

    [HttpGet("animals")]
    public async Task<IActionResult> GetAnimals()
    {
        try
        {
            var animals = await _context.Animals
                .IgnoreQueryFilters()
                .AsNoTracking()
                .OrderByDescending(a => a.CreatedAt)
                .Select(a => new AnimalLookupDto
                {
                    Id = a.Id.ToString(),
                    FarmId = a.FarmId.ToString(),
                    IdentificationTag = a.IdentificationTag,
                    TagNumber = a.IdentificationTag,
                    AnimalType = ToFrontendType(a.Type),
                    Breed = ToFrontendType(a.Type),
                    Status = a.Status
                })
                .ToListAsync();

            return Ok(animals);
        }
        catch
        {
            return Ok(GetDemoAnimals());
        }
    }

    [HttpGet("animals/by-tag/{tag}")]
    public async Task<IActionResult> GetAnimalByTag(string tag, [FromQuery(Name = "farm_id")] string? farmId)
    {
        var normalizedTag = NormalizeTag(tag);

        try
        {
            var query = _context.Animals
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(a => a.IdentificationTag.ToUpper() == normalizedTag);

            if (!string.IsNullOrWhiteSpace(farmId) && Guid.TryParse(farmId, out var parsedFarmId))
            {
                query = query.Where(a => a.FarmId == parsedFarmId);
            }

            var animal = await query
                .Select(a => new AnimalLookupDto
                {
                    Id = a.Id.ToString(),
                    FarmId = a.FarmId.ToString(),
                    IdentificationTag = a.IdentificationTag,
                    TagNumber = a.IdentificationTag,
                    AnimalType = ToFrontendType(a.Type),
                    Breed = ToFrontendType(a.Type),
                    Status = a.Status
                })
                .FirstOrDefaultAsync();

            return Ok(new
            {
                exists = animal != null,
                animal
            });
        }
        catch
        {
            var animal = GetDemoAnimals()
                .FirstOrDefault(a => NormalizeTag(a.IdentificationTag) == normalizedTag || NormalizeTag(a.TagNumber) == normalizedTag);

            return Ok(new
            {
                exists = animal != null,
                animal
            });
        }
    }

    private static string NormalizeTag(string? tag)
    {
        return (tag ?? "").Trim().ToUpperInvariant();
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

    private static AnimalLookupDto[] GetDemoAnimals()
    {
        return new[]
        {
            new AnimalLookupDto
            {
                Id = "demo-302",
                FarmId = "demo-farm",
                IdentificationTag = "302",
                TagNumber = "302",
                AnimalType = "cattle",
                Breed = "Brahman",
                Status = "healthy"
            },
            new AnimalLookupDto
            {
                Id = "demo-045",
                FarmId = "demo-farm",
                IdentificationTag = "045",
                TagNumber = "045",
                AnimalType = "cattle",
                Breed = "Cattle",
                Status = "healthy"
            }
        };
    }
}

public class AnimalLookupDto
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("farm_id")]
    public string FarmId { get; set; } = string.Empty;

    [JsonPropertyName("identification_tag")]
    public string IdentificationTag { get; set; } = string.Empty;

    [JsonPropertyName("tag_number")]
    public string TagNumber { get; set; } = string.Empty;

    [JsonPropertyName("animal_type")]
    public string AnimalType { get; set; } = string.Empty;

    [JsonPropertyName("breed")]
    public string Breed { get; set; } = string.Empty;

    [JsonPropertyName("status")]
    public string Status { get; set; } = "healthy";
}
