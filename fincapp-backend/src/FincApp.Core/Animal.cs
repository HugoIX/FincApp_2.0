using System;
using System.Collections.Generic;

namespace FincApp.Core;

public class Animal
{
    public Guid Id { get; set; }
    public Guid FarmId { get; set; }
    public ProductionType Type { get; set; }
    public string IdentificationTag { get; set; } = string.Empty;
    public DateTime? BirthDate { get; set; }
    public string Status { get; set; } = "healthy";
    public DateTime CreatedAt { get; set; }

    public Farm? Farm { get; set; }
    public ICollection<WeightLog> WeightLogs { get; set; } = new List<WeightLog>();
    public ICollection<HealthRecord> HealthRecords { get; set; } = new List<HealthRecord>();
}
