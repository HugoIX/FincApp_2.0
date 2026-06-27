package com.irwi.fincapp.network;

import java.util.List;
import java.util.Map;

import retrofit2.Call;
import retrofit2.http.Body;
import retrofit2.http.POST;

public interface SyncApiService {
    @POST("mobile/sync/bulk")
    Call<Void> dispatchBulkQueue(@Body List<Map<String, Object>> pendingRows);
}
