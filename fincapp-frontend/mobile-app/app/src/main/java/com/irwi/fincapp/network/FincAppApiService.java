package com.irwi.fincapp.network;

import com.irwi.fincapp.network.dto.*;

import java.util.List;

import retrofit2.Call;
import retrofit2.http.Body;
import retrofit2.http.GET;
import retrofit2.http.Header;
import retrofit2.http.POST;
import retrofit2.http.Path;

public interface FincAppApiService {
    @POST("v1/auth/login")
    Call<LoginResponse> login(@Body LoginRequest request);

    @GET("v1/farms")
    Call<List<FarmDto>> getFarms();

    @POST("v1/farms/{farmId}/sync")
    Call<SyncResponse> syncFarmData(
            @Header("X-Farm-Id") String farmIdHeader,
            @Path("farmId") String farmId,
            @Body BulkSyncRequestDto request
    );

    @POST("aura/tool-agent")
    Call<AuraResponse> askAura(@Body AuraRequest request);
}
