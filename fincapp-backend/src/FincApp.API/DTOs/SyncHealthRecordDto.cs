using System;
using System.Text.Json.Serialization;

namespace FincApp.API.DTOs;

public class SyncHealthRecordDto
{
    [JsonPropertyName("id")]
    public Guid? Id { get; set; }

    [JsonPropertyName("animal_id")]
    public Guid AnimalId { get; set; }

    [JsonPropertyName("symptoms_description")]
    public string SymptomsDescription { get; set; } = string.Empty;

    [JsonPropertyName("diagnosis")]
    public string? Diagnosis { get; set; }

    [JsonPropertyName("treatment_administered")]
    public string? TreatmentAdministered { get; set; }

    [JsonPropertyName("recorded_at")]
    public DateTime? RecordedAt { get; set; }
}
