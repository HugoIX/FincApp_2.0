package com.irwi.fincapp.models;

public class SyncQueueItem {
    public long id;
    public String entityName;
    public String operationType;
    public long entityId;
    public String payloadSummary;
    public String syncStatus;
    public String createdAt;

    public SyncQueueItem(long id, String entityName, String operationType, long entityId,
                         String payloadSummary, String syncStatus, String createdAt) {
        this.id = id;
        this.entityName = entityName;
        this.operationType = operationType;
        this.entityId = entityId;
        this.payloadSummary = payloadSummary;
        this.syncStatus = syncStatus;
        this.createdAt = createdAt;
    }
}
