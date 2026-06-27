package com.irwi.fincapp.models;

public class WeightLog {
    public long id;
    public long animalId;
    public double weightKg;
    public String logDate;

    public WeightLog(long id, long animalId, double weightKg, String logDate) {
        this.id = id;
        this.animalId = animalId;
        this.weightKg = weightKg;
        this.logDate = logDate;
    }
}
