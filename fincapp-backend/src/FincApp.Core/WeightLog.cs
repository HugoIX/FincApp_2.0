using System;

namespace FincApp.Core;

public class WeightLog
{
    public Guid Id { get; set; }
    public Guid AnimalId { get; set; }
    public decimal WeightKg { get; set; }
    public DateTime LogDate { get; set; }

    public Animal? Animal { get; set; }
}
