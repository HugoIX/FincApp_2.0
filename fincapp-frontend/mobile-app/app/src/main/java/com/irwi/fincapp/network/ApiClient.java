package com.irwi.fincapp.network;

import android.util.Log;

import com.irwi.fincapp.models.SyncQueueItem;

import java.util.List;
import java.util.concurrent.TimeUnit;

import retrofit2.Retrofit;
import retrofit2.converter.gson.GsonConverterFactory;

public class ApiClient {
    private static final String TAG = "FincAppSync";

    // Temporary placeholder until Sergio's API URL is provided.
    // Replace it later with the real backend base URL, for example:
    // private static final String BASE_URL = "https://api.fincapp.com/api/";
    private static final String BASE_URL = "https://example.com/api/";

    private final boolean mockMode;
    private final SyncApiService service;

    public ApiClient() {
        this(true); // Keep true while API access is not available.
    }

    public ApiClient(boolean mockMode) {
        this.mockMode = mockMode;
        Retrofit retrofit = new Retrofit.Builder()
                .baseUrl(BASE_URL)
                .addConverterFactory(GsonConverterFactory.create())
                .build();
        service = retrofit.create(SyncApiService.class);
    }

    public boolean dispatchPendingRows(List<SyncQueueItem> pendingItems) throws Exception {
        if (pendingItems == null || pendingItems.isEmpty()) {
            Log.d(TAG, "No pending rows to dispatch.");
            return true;
        }

        if (mockMode) {
            Log.d(TAG, "MOCK API MODE: simulating bulk sync to Sergio's API.");
            Log.d(TAG, "Rows to send: " + pendingItems.size());
            for (SyncQueueItem item : pendingItems) {
                Log.d(TAG, "Dispatching queue_id=" + item.id
                        + " entity=" + item.entityName
                        + " operation=" + item.operationType
                        + " entity_id=" + item.entityId);
            }
            TimeUnit.MILLISECONDS.sleep(700);
            Log.d(TAG, "MOCK API MODE: server response simulated as HTTP 200 OK.");
            return true;
        }

        // Real API implementation placeholder:
        // Build a List<Map<String, Object>> payload and call service.dispatchBulkQueue(payload).execute().
        // This stays disabled until the backend contract URL and auth requirements are available.
        throw new UnsupportedOperationException("Real API mode is not configured yet.");
    }
}
