package com.irwi.fincapp.repository;

import android.content.Context;
import android.util.Log;

import com.irwi.fincapp.database.DatabaseHelper;
import com.irwi.fincapp.models.SyncQueueItem;
import com.irwi.fincapp.network.ApiClient;

import java.util.List;

public class SyncRepository {
    private static final String TAG = "FincAppSync";
    private final DatabaseHelper db;
    private final ApiClient apiClient;

    public SyncRepository(Context context) {
        db = new DatabaseHelper(context);
        apiClient = new ApiClient(true); // mock mode until backend URL/auth is provided.
    }

    public int pendingCount() {
        return db.pendingSyncCount();
    }

    public boolean dispatchPendingRows() {
        List<SyncQueueItem> pendingItems = db.getPendingSyncQueueItems();
        Log.d(TAG, "Pending queue rows found: " + pendingItems.size());

        if (pendingItems.isEmpty()) return true;

        try {
            boolean sent = apiClient.dispatchPendingRows(pendingItems);
            if (sent) {
                db.markQueueItemsAsSynced(pendingItems);
                Log.d(TAG, "Background sync completed. Rows marked as synced: " + pendingItems.size());
                return true;
            }
            Log.e(TAG, "API dispatch returned false. Rows remain pending.");
            return false;
        } catch (Exception e) {
            db.markQueueItemsPendingAfterFailure(pendingItems);
            Log.e(TAG, "Sync failed. WorkManager will retry with exponential backoff.", e);
            return false;
        }
    }
}
