package com.irwi.fincapp.models;

public class ProductionModule {
    private long id;
    private long farmId;
    private String moduleName;
    private String syncStatus;

    public ProductionModule(long farmId, String moduleName) {
        this.farmId = farmId;
        this.moduleName = moduleName;
        this.syncStatus = "pending";
    }

    public long getId() { return id; }
    public void setId(long id) { this.id = id; }
    public long getFarmId() { return farmId; }
    public String getModuleName() { return moduleName; }
    public String getSyncStatus() { return syncStatus; }
}
