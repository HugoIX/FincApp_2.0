using System;
using System.Text.Json.Serialization;

namespace FincApp.API.DTOs;

public class SyncWeightLogDto
{
    [JsonPropertyName("id")]
    public Guid? Id { get; set; }

    [JsonPropertyName("animal_id")]
    public Guid AnimalId { get; set; }

    [JsonPropertyName("weight_kg")]
    public decimal WeightKg { get; set; }

    [JsonPropertyName("log_date")]
    public DateTime LogDate { get; set; }
}
