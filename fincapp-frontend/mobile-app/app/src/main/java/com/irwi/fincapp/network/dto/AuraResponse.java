package com.irwi.fincapp.network.dto;

import com.google.gson.annotations.SerializedName;

public class AuraResponse {
    @SerializedName("assistant_message") public String assistantMessage;
    @SerializedName("audio_text") public String audioText;
    @SerializedName("aura_response") public String auraResponse;
    @SerializedName("tool_name") public String toolName;
    public String action;
    public String intent;
    public String message() {
        if (auraResponse != null && !auraResponse.isEmpty()) return auraResponse;
        if (audioText != null && !audioText.isEmpty()) return audioText;
        if (assistantMessage != null && !assistantMessage.isEmpty()) return assistantMessage;
        return "AURA answered, but no message field was returned.";
    }
}
