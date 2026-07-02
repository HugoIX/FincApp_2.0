package com.irwi.fincapp.repository;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import com.irwi.fincapp.database.DatabaseHelper;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.UUID;

public class AnimalRepository {
    private final DatabaseHelper helper;

    public AnimalRepository(Context context) {
        helper = new DatabaseHelper(context);
    }

    public long addAnimal(String farmCloudId, String type, String tag, String birthDate, String status) {
        SQLiteDatabase db = helper.getWritableDatabase();
        ContentValues values = new ContentValues();
        values.put("cloud_id", UUID.randomUUID().toString());
        values.put("farm_cloud_id", farmCloudId);
        values.put("type", type);
        values.put("identification_tag", tag);
        values.put("birth_date", blankToNull(birthDate));
        values.put("status", isBlank(status) ? "healthy" : status);
        values.put("created_at", now());
        values.put("sync_status", "pending");
        long id = db.insert("animals", null, values);
        queue("animals", id);
        return id;
    }

    public long addWeight(long animalId, double weightKg) {
        SQLiteDatabase db = helper.getWritableDatabase();
        String cloudId = getAnimalCloudId(animalId);
        ContentValues values = new ContentValues();
        values.put("cloud_id", UUID.randomUUID().toString());
        values.put("animal_id", animalId);
        values.put("animal_cloud_id", cloudId);
        values.put("weight_kg", weightKg);
        values.put("log_date", now());
        values.put("sync_status", "pending");
        long id = db.insert("weight_logs", null, values);
        queue("weight_logs", id);
        return id;
    }

    public long addHealth(long animalId, String symptoms, String diagnosis, String treatment) {
        SQLiteDatabase db = helper.getWritableDatabase();
        String cloudId = getAnimalCloudId(animalId);
        ContentValues values = new ContentValues();
        values.put("cloud_id", UUID.randomUUID().toString());
        values.put("animal_id", animalId);
        values.put("animal_cloud_id", cloudId);
        values.put("symptoms_description", symptoms);
        values.put("diagnosis", blankToNull(diagnosis));
        values.put("treatment_administered", blankToNull(treatment));
        values.put("recorded_at", now());
        values.put("sync_status", "pending");
        long id = db.insert("health_records", null, values);
        queue("health_records", id);
        return id;
    }

    public Cursor animalsByType(String farmCloudId, String type) {
        return helper.getReadableDatabase().rawQuery(
                "SELECT id, identification_tag, type, sync_status, cloud_id FROM animals WHERE farm_cloud_id=? AND type=? ORDER BY id DESC",
                new String[]{farmCloudId, type}
        );
    }

    public int pendingCount() {
        Cursor c = helper.getReadableDatabase().rawQuery(
                "SELECT COUNT(*) FROM sync_queue WHERE sync_status='pending'", null);
        try { return c.moveToFirst() ? c.getInt(0) : 0; } finally { c.close(); }
    }

    public String getAnimalCloudId(long animalId) {
        Cursor c = helper.getReadableDatabase().rawQuery(
                "SELECT cloud_id FROM animals WHERE id=?", new String[]{String.valueOf(animalId)});
        try { return c.moveToFirst() ? c.getString(0) : ""; } finally { c.close(); }
    }

    private void queue(String entity, long entityId) {
        ContentValues values = new ContentValues();
        values.put("entity_name", entity);
        values.put("entity_id", entityId);
        values.put("operation_type", "create");
        values.put("sync_status", "pending");
        values.put("created_at", now());
        helper.getWritableDatabase().insert("sync_queue", null, values);
    }

    private String now() {
        return new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).format(new Date());
    }

    private String blankToNull(String value) { return isBlank(value) ? null : value.trim(); }
    private boolean isBlank(String value) { return value == null || value.trim().isEmpty(); }
}
