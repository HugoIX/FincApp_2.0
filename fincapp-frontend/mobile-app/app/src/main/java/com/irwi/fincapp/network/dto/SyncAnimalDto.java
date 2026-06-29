package com.irwi.fincapp.network.dto;

import com.google.gson.annotations.SerializedName;

public class SyncAnimalDto {
    public String id;
    public String type;
    @SerializedName("identification_tag") public String identificationTag;
    @SerializedName("birth_date") public String birthDate;
    public String status;
}
