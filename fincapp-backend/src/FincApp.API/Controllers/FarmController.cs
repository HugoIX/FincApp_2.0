using System;
using System.Linq;
using System.Threading.Tasks;
using FincApp.Core;
using FincApp.Infrastructure;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FincApp.API.Controllers;

[ApiController]
[Route("api/v1/farms")]
public class FarmController : ControllerBase
{
    private readonly FincAppDbContext _context;

    public FarmController(FincAppDbContext context)
    {
        _context = context;
    }

    [HttpPost]
    public async Task<IActionResult> CreateFarm([FromBody] CreateFarmRequest request)
    {
        // Validate if owner exists
        var ownerExists = await _context.Users.AnyAsync(u => u.Id == request.OwnerId);
        if (!ownerExists)
        {
            return BadRequest(new { message = $"Owner with ID {request.OwnerId} does not exist. Please register the user first." });
        }

        var farm = new Farm
        {
            OwnerId = request.OwnerId,
            Name = request.Name,
            Location = request.Location
        };

        _context.Farms.Add(farm);
        await _context.SaveChangesAsync();

        var response = new
        {
            id = farm.Id,
            ownerId = farm.OwnerId,
            name = farm.Name,
            location = farm.Location,
            createdAt = farm.CreatedAt
        };

        return Created($"/api/v1/farms/{farm.Id}", response);
    }

    [HttpGet]
    public async Task<IActionResult> GetAllFarms()
    {
        var farms = await _context.Farms
            .Select(f => new
            {
                id = f.Id,
                ownerId = f.OwnerId,
                name = f.Name,
                location = f.Location,
                createdAt = f.CreatedAt
            })
            .ToListAsync();

        return Ok(farms);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetFarmById(Guid id)
    {
        var farm = await _context.Farms
            .Where(f => f.Id == id)
            .Select(f => new
            {
                id = f.Id,
                ownerId = f.OwnerId,
                name = f.Name,
                location = f.Location,
                createdAt = f.CreatedAt
            })
            .FirstOrDefaultAsync();

        if (farm == null)
        {
            return NotFound(new { message = "Farm not found" });
        }

        return Ok(farm);
    }
}

public class CreateFarmRequest
{
    public Guid OwnerId { get; set; }
    public string Name { get; set; } = null!;
    public string? Location { get; set; }
}
