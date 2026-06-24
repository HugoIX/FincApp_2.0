using System;
using System.Collections.Generic;

namespace FincApp.Core;

public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public UserRole Role { get; set; } = UserRole.Worker;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public ICollection<Farm> OwnedFarms { get; set; } = new List<Farm>();
    public ICollection<FarmAssignment> Assignments { get; set; } = new List<FarmAssignment>();
}
