using System;
using System.Text.Json.Serialization;
using FincApp.Core;

namespace FincApp.API.DTOs;

public class SyncAnimalDto
{
    [JsonPropertyName("id")]
    public Guid Id { get; set; }

    [JsonPropertyName("type")]
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public ProductionType Type { get; set; }

    [JsonPropertyName("identification_tag")]
    public string IdentificationTag { get; set; } = string.Empty;

    [JsonPropertyName("birth_date")]
    public DateTime? BirthDate { get; set; }

    [JsonPropertyName("status")]
    public string Status { get; set; } = "healthy";
}
