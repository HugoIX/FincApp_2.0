package com.irwi.fincapp.network.dto;

import com.google.gson.annotations.SerializedName;

public class SyncWeightLogDto {
    public String id;
    @SerializedName("animal_id") public String animalId;
    @SerializedName("weight_kg") public double weightKg;
    @SerializedName("log_date") public String logDate;
}
