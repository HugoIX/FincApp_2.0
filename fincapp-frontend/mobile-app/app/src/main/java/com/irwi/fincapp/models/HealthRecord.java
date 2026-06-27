package com.irwi.fincapp.models;

public class HealthRecord {
    public long id;
    public long animalId;
    public String symptomsDescription;
    public String diagnosis;
    public String treatmentAdministered;
    public String recordedAt;

    public HealthRecord(long id, long animalId, String symptomsDescription, String diagnosis,
                        String treatmentAdministered, String recordedAt) {
        this.id = id;
        this.animalId = animalId;
        this.symptomsDescription = symptomsDescription;
        this.diagnosis = diagnosis;
        this.treatmentAdministered = treatmentAdministered;
        this.recordedAt = recordedAt;
    }
}
