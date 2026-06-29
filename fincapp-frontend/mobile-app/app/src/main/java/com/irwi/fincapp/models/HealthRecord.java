package com.irwi.fincapp.models;

public class HealthRecord {
    public long id;
    public String cloudId;
    public long animalId;
    public String animalCloudId;
    public String symptomsDescription;
    public String diagnosis;
    public String treatmentAdministered;
    public String recordedAt;
    public String syncStatus;

    public HealthRecord(long id, String cloudId, long animalId, String animalCloudId, String symptomsDescription, String diagnosis,
                        String treatmentAdministered, String recordedAt, String syncStatus) {
        this.id = id;
        this.cloudId = cloudId;
        this.animalId = animalId;
        this.animalCloudId = animalCloudId;
        this.symptomsDescription = symptomsDescription;
        this.diagnosis = diagnosis;
        this.treatmentAdministered = treatmentAdministered;
        this.recordedAt = recordedAt;
        this.syncStatus = syncStatus;
    }
}
