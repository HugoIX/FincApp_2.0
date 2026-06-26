using System;
using System.Text.Json.Serialization;

namespace FincApp.API.DTOs;

public class BulkSyncRequestDto
{
    [JsonPropertyName("device_uuid")]
    public string DeviceUuid { get; set; } = string.Empty;

    [JsonPropertyName("user_id")]
    public Guid UserId { get; set; }

    [JsonPropertyName("payload_mutations")]
    public PayloadMutationsDto PayloadMutations { get; set; } = new();
}
