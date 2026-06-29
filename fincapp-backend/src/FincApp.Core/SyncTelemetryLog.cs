using System;

namespace FincApp.Core;

public class SyncTelemetryLog
{
    public Guid Id { get; set; }
    public string DeviceUuid { get; set; } = string.Empty;
    public Guid UserId { get; set; }
    public Guid FarmId { get; set; }
    public string Status { get; set; } = string.Empty; // 'success', 'failed', 'partial_conflict'
    public int RowsSynced { get; set; }
    public string? ErrorMessage { get; set; }
    public DateTime SynchronizedAt { get; set; }

    public User? User { get; set; }
    public Farm? Farm { get; set; }
}
