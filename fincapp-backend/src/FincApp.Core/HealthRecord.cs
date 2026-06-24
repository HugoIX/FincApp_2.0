using System;

namespace FincApp.Core;

public class HealthRecord
{
    public Guid Id { get; set; }
    public Guid AnimalId { get; set; }
    public string SymptomsDescription { get; set; } = string.Empty;
    public string? Diagnosis { get; set; }
    public string? TreatmentAdministered { get; set; }
    public DateTime RecordedAt { get; set; }

    public Animal? Animal { get; set; }
}
