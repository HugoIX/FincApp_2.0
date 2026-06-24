using System;
using System.Collections.Generic;

namespace FincApp.Core;

public class Farm
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid OwnerId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Location { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public User Owner { get; set; } = null!;
    public ICollection<FarmAssignment> Assignments { get; set; } = new List<FarmAssignment>();
    public ICollection<ProductionModule> ProductionModules { get; set; } = new List<ProductionModule>();
}
