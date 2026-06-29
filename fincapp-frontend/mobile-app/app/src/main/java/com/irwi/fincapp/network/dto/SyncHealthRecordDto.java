package com.irwi.fincapp.network.dto;

import com.google.gson.annotations.SerializedName;

public class SyncHealthRecordDto {
    public String id;
    @SerializedName("animal_id") public String animalId;
    @SerializedName("symptoms_description") public String symptomsDescription;
    public String diagnosis;
    @SerializedName("treatment_administered") public String treatmentAdministered;
    @SerializedName("recorded_at") public String recordedAt;
}
