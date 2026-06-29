package com.irwi.fincapp.models;

public class WeightLog {
    public long id;
    public String cloudId;
    public long animalId;
    public String animalCloudId;
    public double weightKg;
    public String logDate;
    public String syncStatus;

    public WeightLog(long id, String cloudId, long animalId, String animalCloudId, double weightKg, String logDate, String syncStatus) {
        this.id = id;
        this.cloudId = cloudId;
        this.animalId = animalId;
        this.animalCloudId = animalCloudId;
        this.weightKg = weightKg;
        this.logDate = logDate;
        this.syncStatus = syncStatus;
    }
}
