package com.irwi.fincapp.network.dto;

import com.google.gson.annotations.SerializedName;
import java.util.ArrayList;
import java.util.List;

public class PayloadMutationsDto {
    public List<SyncAnimalDto> animals = new ArrayList<>();
    @SerializedName("weight_logs") public List<SyncWeightLogDto> weightLogs = new ArrayList<>();
    @SerializedName("health_records") public List<SyncHealthRecordDto> healthRecords = new ArrayList<>();
}
