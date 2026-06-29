package com.irwi.fincapp.network.dto;

import com.google.gson.annotations.SerializedName;

public class SyncResponse {
    public String status;
    @SerializedName("rows_synced") public int rowsSynced;
    public String message;
    public String error;
}
