package com.irwi.fincapp.repository;

import android.content.Context;
import android.util.Log;

import com.irwi.fincapp.database.DatabaseHelper;
import com.irwi.fincapp.network.ApiClient;
import com.irwi.fincapp.network.dto.BulkSyncRequestDto;
import com.irwi.fincapp.network.dto.PayloadMutationsDto;
import com.irwi.fincapp.network.dto.SyncResponse;
import com.irwi.fincapp.storage.SessionManager;

import retrofit2.Response;

public class SyncRepository {
    private static final String TAG = "FincAppSync";
    private final DatabaseHelper db;
    private final SessionManager session;
    private final Context context;

    public SyncRepository(Context context) {
        this.context = context.getApplicationContext();
        db = new DatabaseHelper(this.context);
        session = new SessionManager(this.context);
    }

    public int pendingCount() { return db.pendingSyncCount(); }

    public boolean dispatchPendingRows() {
        int pending = db.pendingSyncCount();
        Log.d(TAG, "Pending local rows found: " + pending);
        if (pending == 0) return true;

        if (!session.hasBackendSession()) {
            Log.w(TAG, "Backend session is incomplete. Set BASE_URL, login, and select a farm before real sync. Rows stay pending.");
            return true; // Do not retry forever because this is configuration, not network failure.
        }

        try {
            PayloadMutationsDto payload = db.buildPendingPayload();
            BulkSyncRequestDto request = new BulkSyncRequestDto();
            request.deviceUuid = session.getDeviceUuid();
            request.userId = session.getUserId();
            request.payloadMutations = payload;

            Log.d(TAG, "Dispatching to backend: animals=" + payload.animals.size()
                    + ", weights=" + payload.weightLogs.size()
                    + ", health=" + payload.healthRecords.size());

            Response<SyncResponse> response = new ApiClient(context).service()
                    .syncFarmData(session.getFarmId(), session.getFarmId(), request)
                    .execute();

            if (response.isSuccessful()) {
                db.markAllPendingAsSynced();
                SyncResponse body = response.body();
                Log.d(TAG, "Backend sync OK. Rows marked as synced. Server rows_synced=" + (body == null ? "unknown" : body.rowsSynced));
                return true;
            }

            Log.e(TAG, "Backend sync failed. HTTP " + response.code() + " " + response.message());
            return false;
        } catch (Exception e) {
            Log.e(TAG, "Sync failed. WorkManager will retry using exponential backoff.", e);
            return false;
        }
    }
}
