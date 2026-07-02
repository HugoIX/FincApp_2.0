package com.irwi.fincapp.sync;

import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.provider.Settings;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import com.irwi.fincapp.database.DatabaseHelper;
import com.irwi.fincapp.network.ApiClient;
import com.irwi.fincapp.session.SessionManager;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;
import retrofit2.Response;

public class SyncWorker extends Worker {
    private static final String TAG = "FincAppSync";

    public SyncWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context context = getApplicationContext();
        SessionManager session = new SessionManager(context);

        if (!session.isLogged() || session.farmId().isEmpty()) {
            Log.d(TAG, "Sync skipped: user or farm not selected yet.");
            return Result.success();
        }

        try {
            DatabaseHelper helper = new DatabaseHelper(context);
            SQLiteDatabase db = helper.getReadableDatabase();

            ArrayList<Map<String, Object>> animals = pendingAnimals(db, session.farmId());
            ArrayList<Map<String, Object>> weights = pendingWeights(db, session.farmId());
            ArrayList<Map<String, Object>> health = pendingHealth(db, session.farmId());
            int total = animals.size() + weights.size() + health.size();

            Log.d(TAG, "Pending rows for sync: " + total);
            if (total == 0) return Result.success();

            Map<String, Object> mutations = new HashMap<>();
            mutations.put("animals", animals);
            mutations.put("weight_logs", weights);
            mutations.put("health_records", health);

            Map<String, Object> payload = new HashMap<>();
            payload.put("device_uuid", Settings.Secure.getString(context.getContentResolver(), Settings.Secure.ANDROID_ID));
            payload.put("user_id", session.userId());
            payload.put("payload_mutations", mutations);

            Response<Map<String, Object>> response = ApiClient.service(session.baseUrl())
                    .sync(session.farmId(), session.farmId(), payload)
                    .execute();

            if (response.isSuccessful()) {
                SQLiteDatabase writable = helper.getWritableDatabase();
                writable.execSQL("UPDATE animals SET sync_status='synced' WHERE farm_cloud_id=? AND sync_status='pending'", new Object[]{session.farmId()});
                writable.execSQL("UPDATE weight_logs SET sync_status='synced' WHERE animal_cloud_id IN (SELECT cloud_id FROM animals WHERE farm_cloud_id=?) AND sync_status='pending'", new Object[]{session.farmId()});
                writable.execSQL("UPDATE health_records SET sync_status='synced' WHERE animal_cloud_id IN (SELECT cloud_id FROM animals WHERE farm_cloud_id=?) AND sync_status='pending'", new Object[]{session.farmId()});
                writable.execSQL("UPDATE sync_queue SET sync_status='synced' WHERE sync_status='pending'");
                Log.d(TAG, "Sync success. Rows sent: " + total);
                return Result.success();
            }

            Log.e(TAG, "Sync HTTP error: " + response.code());
            if (response.code() >= 400 && response.code() < 500) {
                return Result.failure();
            }
            return Result.retry();
        } catch (Exception exception) {
            Log.e(TAG, "Sync failed. WorkManager will retry with exponential backoff.", exception);
            return Result.retry();
        }
    }

    private ArrayList<Map<String, Object>> pendingAnimals(SQLiteDatabase db, String farmId) {
        ArrayList<Map<String, Object>> rows = new ArrayList<>();
        Cursor c = db.rawQuery("SELECT cloud_id,type,identification_tag,birth_date,status FROM animals WHERE farm_cloud_id=? AND sync_status='pending'", new String[]{farmId});
        try {
            while (c.moveToNext()) {
                Map<String, Object> row = new HashMap<>();
                row.put("id", c.getString(0));
                row.put("type", c.getString(1));
                row.put("identification_tag", c.getString(2));
                row.put("birth_date", c.isNull(3) ? null : c.getString(3));
                row.put("status", c.getString(4));
                rows.add(row);
            }
        } finally { c.close(); }
        return rows;
    }

    private ArrayList<Map<String, Object>> pendingWeights(SQLiteDatabase db, String farmId) {
        ArrayList<Map<String, Object>> rows = new ArrayList<>();
        Cursor c = db.rawQuery("SELECT w.cloud_id,w.animal_cloud_id,w.weight_kg,w.log_date FROM weight_logs w INNER JOIN animals a ON a.cloud_id=w.animal_cloud_id WHERE a.farm_cloud_id=? AND w.sync_status='pending'", new String[]{farmId});
        try {
            while (c.moveToNext()) {
                Map<String, Object> row = new HashMap<>();
                row.put("id", c.getString(0));
                row.put("animal_id", c.getString(1));
                row.put("weight_kg", c.getDouble(2));
                row.put("log_date", c.getString(3));
                rows.add(row);
            }
        } finally { c.close(); }
        return rows;
    }

    private ArrayList<Map<String, Object>> pendingHealth(SQLiteDatabase db, String farmId) {
        ArrayList<Map<String, Object>> rows = new ArrayList<>();
        Cursor c = db.rawQuery("SELECT h.cloud_id,h.animal_cloud_id,h.symptoms_description,h.diagnosis,h.treatment_administered,h.recorded_at FROM health_records h INNER JOIN animals a ON a.cloud_id=h.animal_cloud_id WHERE a.farm_cloud_id=? AND h.sync_status='pending'", new String[]{farmId});
        try {
            while (c.moveToNext()) {
                Map<String, Object> row = new HashMap<>();
                row.put("id", c.getString(0));
                row.put("animal_id", c.getString(1));
                row.put("symptoms_description", c.getString(2));
                row.put("diagnosis", c.isNull(3) ? null : c.getString(3));
                row.put("treatment_administered", c.isNull(4) ? null : c.getString(4));
                row.put("recorded_at", c.getString(5));
                rows.add(row);
            }
        } finally { c.close(); }
        return rows;
    }
}
