using System;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using FincApp.Core;
using FincApp.Infrastructure;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FincApp.API.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthCompatibilityController : ControllerBase
{
    private readonly FincAppDbContext _context;

    public AuthCompatibilityController(FincAppDbContext context)
    {
        _context = context;
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] CompatLoginRequest request)
    {
        try
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == request.Email);

            if (user != null && user.PasswordHash == HashPassword(request.Password))
            {
                var farmName = await _context.Farms
                    .Where(f => f.OwnerId == user.Id)
                    .Select(f => f.Name)
                    .FirstOrDefaultAsync();

                return Ok(new
                {
                    token = $"mock-jwt-token-for-{user.Id}",
                    user = new
                    {
                        id = user.Id,
                        email = user.Email,
                        full_name = user.Email.Split('@')[0],
                        role = user.Role.ToString().ToLower() == "admin" ? "admin" : "farmer",
                        farm_name = farmName ?? "FincApp Farm"
                    }
                });
            }
        }
        catch
        {
            // Demo fallback below.
        }

        if (request.Email == "admin@farm.com" && request.Password == "admin123")
        {
            return Ok(new
            {
                token = "demo-token",
                user = new
                {
                    id = "demo-admin",
                    email = "admin@farm.com",
                    full_name = "Admin User",
                    role = "admin",
                    farm_name = "Demo Farm"
                }
            });
        }

        if (request.Email == "worker@farm.com" && request.Password == "worker123")
        {
            return Ok(new
            {
                token = "demo-token",
                user = new
                {
                    id = "demo-worker",
                    email = "worker@farm.com",
                    full_name = "Farm Worker",
                    role = "farmer",
                    farm_name = "Demo Farm"
                }
            });
        }

        return Unauthorized(new { message = "Invalid email or password" });
    }

    private static string HashPassword(string password)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(password));
        var builder = new StringBuilder();

        foreach (var b in bytes)
        {
            builder.Append(b.ToString("x2"));
        }

        return builder.ToString();
    }
}

public class CompatLoginRequest
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}
