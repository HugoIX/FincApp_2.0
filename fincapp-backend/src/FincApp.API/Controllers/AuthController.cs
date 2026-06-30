using System;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using FincApp.Core;
using FincApp.Infrastructure;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FincApp.API.Controllers;

[ApiController]
[Route("api/v1/auth")]
public class AuthController : ControllerBase
{
    private readonly FincAppDbContext _context;

    public AuthController(FincAppDbContext context)
    {
        _context = context;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        if (await _context.Users.AnyAsync(u => u.Email == request.Email))
        {
            return BadRequest(new { message = "Email already registered" });
        }

        var user = new User
        {
            Email = request.Email,
            PasswordHash = HashPassword(request.Password),
            Role = request.Role
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        return Ok(new
        {
            id = user.Id,
            email = user.Email,
            role = user.Role.ToString().ToLower(),
            createdAt = user.CreatedAt
        });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == request.Email);
        var passwordHash = HashPassword(request.Password);
        if (user == null || (user.PasswordHash != passwordHash && user.PasswordHash != request.Password))
        {
            return Unauthorized(new { message = "Invalid email or password" });
        }

        return Ok(new
        {
            id = user.Id,
            email = user.Email,
            role = user.Role.ToString().ToLower(),
            token = $"mock-jwt-token-for-{user.Id}"
        });
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

public class RegisterRequest
{
    public string Email { get; set; } = null!;
    public string Password { get; set; } = null!;
    public UserRole Role { get; set; } = UserRole.Worker;
}

public class LoginRequest
{
    public string Email { get; set; } = null!;
    public string Password { get; set; } = null!;
}
