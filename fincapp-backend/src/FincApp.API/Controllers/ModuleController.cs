using System;
using System.Linq;
using System.Threading.Tasks;
using FincApp.Core;
using FincApp.Core.Interfaces;
using FincApp.Infrastructure;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FincApp.API.Controllers;

[ApiController]
[Route("api/v1/modules")]
public class ModuleController : ControllerBase
{
    private readonly FincAppDbContext _context;
    private readonly ITenantProvider _tenantProvider;

    public ModuleController(FincAppDbContext context, ITenantProvider tenantProvider)
    {
        _context = context;
        _tenantProvider = tenantProvider;
    }

    [HttpPost]
    public async Task<IActionResult> CreateModule([FromBody] CreateModuleRequest request)
    {
        var tenantId = _tenantProvider.TenantId;
        if (tenantId == null)
        {
            return BadRequest(new { message = "Header 'X-Farm-Id' is required." });
        }

        var farmExists = await _context.Farms.IgnoreQueryFilters().AnyAsync(f => f.Id == tenantId.Value);
        if (!farmExists)
        {
            return BadRequest(new { message = $"The active farm with ID {tenantId.Value} does not exist." });
        }

        var exists = await _context.ProductionModules.AnyAsync(m => m.Type == request.Type);
        if (exists)
        {
            return BadRequest(new { message = $"A production module of type '{request.Type.ToString().ToLower()}' already exists for this farm." });
        }

        var module = new ProductionModule
        {
            FarmId = tenantId.Value,
            Type = request.Type,
            IsActive = true
        };

        _context.ProductionModules.Add(module);
        await _context.SaveChangesAsync();

        return Created($"/api/v1/modules/{module.Id}", new
        {
            id = module.Id,
            farmId = module.FarmId,
            type = module.Type.ToString().ToLower(),
            isActive = module.IsActive,
            createdAt = module.CreatedAt
        });
    }

    [HttpGet]
    public async Task<IActionResult> GetModules()
    {
        var tenantId = _tenantProvider.TenantId;
        if (tenantId == null)
        {
            return BadRequest(new { message = "Header 'X-Farm-Id' is required." });
        }

        var modules = await _context.ProductionModules
            .Select(m => new
            {
                id = m.Id,
                farmId = m.FarmId,
                type = m.Type.ToString().ToLower(),
                isActive = m.IsActive,
                createdAt = m.CreatedAt
            })
            .ToListAsync();

        return Ok(modules);
    }

    [HttpPut("{id}/toggle")]
    public async Task<IActionResult> ToggleModule(Guid id)
    {
        var tenantId = _tenantProvider.TenantId;
        if (tenantId == null)
        {
            return BadRequest(new { message = "Header 'X-Farm-Id' is required." });
        }

        var module = await _context.ProductionModules.FirstOrDefaultAsync(m => m.Id == id);
        if (module == null)
        {
            return NotFound(new { message = "Production module not found on the active farm." });
        }

        module.IsActive = !module.IsActive;
        await _context.SaveChangesAsync();

        return Ok(new
        {
            id = module.Id,
            farmId = module.FarmId,
            type = module.Type.ToString().ToLower(),
            isActive = module.IsActive,
            createdAt = module.CreatedAt
        });
    }
}

public class CreateModuleRequest
{
    public ProductionType Type { get; set; }
}
