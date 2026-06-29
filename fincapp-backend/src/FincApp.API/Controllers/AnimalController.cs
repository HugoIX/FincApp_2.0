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
public class AnimalController : ControllerBase
{
    private readonly FincAppDbContext _context;
    private readonly ITenantProvider _tenantProvider;

    public AnimalController(FincAppDbContext context, ITenantProvider tenantProvider)
    {
        _context = context;
        _tenantProvider = tenantProvider;
    }

    [HttpGet("farms/{farmId}/animals")]
    public async Task<IActionResult> GetAnimals(Guid farmId)
    {
        var tenantId = _tenantProvider.TenantId;
        if (tenantId == null || tenantId != farmId)
        {
            return StatusCode(403, "Access to this farm's animals is forbidden.");
        }

        var animals = await _context.Animals
            .Where(a => a.FarmId == farmId)
            .ToListAsync();

        return Ok(animals);
    }

    [HttpGet("animals/{id}")]
    public async Task<IActionResult> GetAnimal(Guid id)
    {
        var animal = await _context.Animals.FirstOrDefaultAsync(a => a.Id == id);
        
        if (animal == null)
        {
            var rawAnimal = await _context.Animals.IgnoreQueryFilters().FirstOrDefaultAsync(a => a.Id == id);
            if (rawAnimal == null) return NotFound();
            
            if (rawAnimal.FarmId != _tenantProvider.TenantId)
            {
                return StatusCode(403, "Access to this animal is forbidden.");
            }

            return Ok(rawAnimal);
        }

        return Ok(animal);
    }

    [HttpPost("animals")]
    public async Task<IActionResult> CreateAnimal([FromBody] CreateAnimalDto dto)
    {
        var tenantId = _tenantProvider.TenantId;
        if (tenantId == null)
        {
            return Unauthorized("X-Farm-Id header is required.");
        }

        var animal = new Animal
        {
            Type = dto.Type,
            IdentificationTag = dto.IdentificationTag,
            BirthDate = dto.BirthDate,
            Status = dto.Status
        };

        _context.Animals.Add(animal);
        await _context.SaveChangesAsync();

        return Created($"/api/animals/{animal.Id}", animal);
    }

    [HttpPost("animals/{id}/weights")]
    public async Task<IActionResult> AddWeightLog(Guid id, [FromBody] CreateWeightLogDto dto)
    {
        var animal = await _context.Animals.FirstOrDefaultAsync(a => a.Id == id);
        if (animal == null) return StatusCode(403, "Animal not found or access forbidden.");

        var log = new WeightLog
        {
            AnimalId = id,
            WeightKg = dto.WeightKg
        };

        _context.WeightLogs.Add(log);
        await _context.SaveChangesAsync();

        return StatusCode(201, new { message = "Weight log added successfully." });
    }

    [HttpPost("animals/{id}/health-records")]
    public async Task<IActionResult> AddHealthRecord(Guid id, [FromBody] CreateHealthRecordDto dto)
    {
        var animal = await _context.Animals.FirstOrDefaultAsync(a => a.Id == id);
        if (animal == null) return StatusCode(403, "Animal not found or access forbidden.");

        var record = new HealthRecord
        {
            AnimalId = id,
            SymptomsDescription = dto.SymptomsDescription,
            Diagnosis = dto.Diagnosis,
            TreatmentAdministered = dto.TreatmentAdministered
        };

        _context.HealthRecords.Add(record);
        await _context.SaveChangesAsync();

        return StatusCode(201, new { message = "Health record added successfully." });
    }

    [HttpPut("animals/{id}")]
    public async Task<IActionResult> UpdateAnimal(Guid id, [FromBody] CreateAnimalDto dto)
    {
        var animal = await _context.Animals.FirstOrDefaultAsync(a => a.Id == id);
        if (animal == null) return NotFound();

        animal.Type = dto.Type;
        animal.IdentificationTag = dto.IdentificationTag;
        animal.BirthDate = dto.BirthDate;
        animal.Status = dto.Status;

        await _context.SaveChangesAsync();

        return Ok(animal);
    }

    [HttpDelete("animals/{id}")]
    public async Task<IActionResult> DeleteAnimal(Guid id)
    {
        var animal = await _context.Animals.FirstOrDefaultAsync(a => a.Id == id);
        if (animal == null) return NotFound();

        _context.Animals.Remove(animal);
        await _context.SaveChangesAsync();

        return NoContent();
    }
}
