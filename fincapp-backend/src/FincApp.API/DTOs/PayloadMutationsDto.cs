using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace FincApp.API.DTOs;

public class PayloadMutationsDto
{
    [JsonPropertyName("animals")]
    public List<SyncAnimalDto> Animals { get; set; } = new();

    [JsonPropertyName("weight_logs")]
    public List<SyncWeightLogDto> WeightLogs { get; set; } = new();

    [JsonPropertyName("health_records")]
    public List<SyncHealthRecordDto> HealthRecords { get; set; } = new();
}
