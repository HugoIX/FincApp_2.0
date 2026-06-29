package com.irwi.fincapp.network.dto;

import com.google.gson.annotations.SerializedName;

public class BulkSyncRequestDto {
    @SerializedName("device_uuid") public String deviceUuid;
    @SerializedName("user_id") public String userId;
    @SerializedName("payload_mutations") public PayloadMutationsDto payloadMutations;
}
