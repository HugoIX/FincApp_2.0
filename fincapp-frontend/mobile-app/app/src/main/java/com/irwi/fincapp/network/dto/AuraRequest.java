package com.irwi.fincapp.network.dto;

import com.google.gson.annotations.SerializedName;

public class AuraRequest {
    public String text;
    @SerializedName("session_id") public String sessionId;
    @SerializedName("farm_id") public String farmId;
    public AuraRequest(String text, String sessionId, String farmId) { this.text = text; this.sessionId = sessionId; this.farmId = farmId; }
}
