package com.irwi.fincapp.database;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

import com.irwi.fincapp.models.Animal;
import com.irwi.fincapp.models.HealthRecord;
import com.irwi.fincapp.models.WeightLog;
import com.irwi.fincapp.models.SyncQueueItem;
import com.irwi.fincapp.network.dto.*;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.TimeZone;
import java.util.UUID;

public class DatabaseHelper extends SQLiteOpenHelper {
    public static final String DB_NAME = "fincapp_local.db";
    public static final int DB_VERSION = 4;
    public static final String PENDING = "pending";
    public static final String SYNCED = "synced";

    public DatabaseHelper(Context context) { super(context, DB_NAME, null, DB_VERSION); }

    @Override
    public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE IF NOT EXISTS local_users (id INTEGER PRIMARY KEY AUTOINCREMENT, cloud_id TEXT, name TEXT, email TEXT, token TEXT, sync_status TEXT DEFAULT 'synced')");
        db.execSQL("CREATE TABLE IF NOT EXISTS local_farms (id INTEGER PRIMARY KEY AUTOINCREMENT, cloud_id TEXT UNIQUE, name TEXT NOT NULL, location TEXT, sync_status TEXT DEFAULT 'synced')");
        db.execSQL("CREATE TABLE IF NOT EXISTS local_production_modules (id INTEGER PRIMARY KEY AUTOINCREMENT, farm_id INTEGER, module_name TEXT NOT NULL, sync_status TEXT DEFAULT 'synced')");

        db.execSQL("CREATE TABLE IF NOT EXISTS animals (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
                "cloud_id TEXT NOT NULL UNIQUE, " +
                "farm_cloud_id TEXT, " +
                "type TEXT NOT NULL, " +
                "identification_tag TEXT NOT NULL, " +
                "birth_date TEXT, " +
                "status TEXT NOT NULL DEFAULT 'healthy', " +
                "created_at TEXT NOT NULL, " +
                "sync_status TEXT NOT NULL DEFAULT 'pending')");

        db.execSQL("CREATE TABLE IF NOT EXISTS weight_logs (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
                "cloud_id TEXT NOT NULL UNIQUE, " +
                "animal_id INTEGER NOT NULL, " +
                "animal_cloud_id TEXT NOT NULL, " +
                "weight_kg REAL NOT NULL, " +
                "log_date TEXT NOT NULL, " +
                "sync_status TEXT NOT NULL DEFAULT 'pending', " +
                "FOREIGN KEY(animal_id) REFERENCES animals(id))");

        db.execSQL("CREATE TABLE IF NOT EXISTS health_records (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
                "cloud_id TEXT NOT NULL UNIQUE, " +
                "animal_id INTEGER NOT NULL, " +
                "animal_cloud_id TEXT NOT NULL, " +
                "symptoms_description TEXT NOT NULL, " +
                "diagnosis TEXT, " +
                "treatment_administered TEXT, " +
                "recorded_at TEXT NOT NULL, " +
                "sync_status TEXT NOT NULL DEFAULT 'pending', " +
                "FOREIGN KEY(animal_id) REFERENCES animals(id))");

        db.execSQL("CREATE TABLE IF NOT EXISTS sync_queue (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
                "entity_name TEXT NOT NULL, " +
                "operation_type TEXT NOT NULL, " +
                "entity_id INTEGER NOT NULL, " +
                "payload_summary TEXT, " +
                "sync_status TEXT NOT NULL DEFAULT 'pending', " +
                "created_at TEXT NOT NULL)");
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        db.execSQL("DROP TABLE IF EXISTS sync_queue");
        db.execSQL("DROP TABLE IF EXISTS health_records");
        db.execSQL("DROP TABLE IF EXISTS weight_logs");
        db.execSQL("DROP TABLE IF EXISTS animals");
        db.execSQL("DROP TABLE IF EXISTS local_production_modules");
        db.execSQL("DROP TABLE IF EXISTS local_farms");
        db.execSQL("DROP TABLE IF EXISTS local_users");
        onCreate(db);
    }

    public static String now() {
        SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US);
        format.setTimeZone(TimeZone.getTimeZone("UTC"));
        return format.format(new Date());
    }

    public static String uuid() { return UUID.randomUUID().toString(); }

    private void enqueue(SQLiteDatabase db, String entityName, String operationType, long entityId, String summary) {
        ContentValues values = new ContentValues();
        values.put("entity_name", entityName);
        values.put("operation_type", operationType);
        values.put("entity_id", entityId);
        values.put("payload_summary", summary);
        values.put("sync_status", PENDING);
        values.put("created_at", now());
        db.insert("sync_queue", null, values);
    }

    public void upsertFarm(String cloudId, String name, String location) {
        if (cloudId == null || cloudId.isEmpty()) return;
        SQLiteDatabase db = getWritableDatabase();
        ContentValues values = new ContentValues();
        values.put("cloud_id", cloudId);
        values.put("name", name == null ? "Unnamed farm" : name);
        values.put("location", location);
        values.put("sync_status", SYNCED);
        db.insertWithOnConflict("local_farms", null, values, SQLiteDatabase.CONFLICT_REPLACE);
    }

    public long insertAnimal(String farmCloudId, String type, String identificationTag, String birthDate, String status) {
        SQLiteDatabase db = getWritableDatabase();
        db.beginTransaction();
        long id;
        try {
            ContentValues values = new ContentValues();
            values.put("cloud_id", uuid());
            values.put("farm_cloud_id", farmCloudId);
            values.put("type", normalizeType(type));
            values.put("identification_tag", identificationTag);
            values.put("birth_date", emptyToNull(birthDate));
            values.put("status", status == null || status.trim().isEmpty() ? "healthy" : status.trim());
            values.put("created_at", now());
            values.put("sync_status", PENDING);
            id = db.insertOrThrow("animals", null, values);
            enqueue(db, "animals", "CREATE", id, "Animal " + identificationTag + " created offline");
            db.setTransactionSuccessful();
        } finally { db.endTransaction(); }
        return id;
    }

    public int updateAnimalStatus(long animalId, String newStatus) {
        SQLiteDatabase db = getWritableDatabase();
        ContentValues values = new ContentValues();
        values.put("status", newStatus);
        values.put("sync_status", PENDING);
        int rows = db.update("animals", values, "id=?", new String[]{String.valueOf(animalId)});
        if (rows > 0) enqueue(db, "animals", "UPDATE", animalId, "Animal status changed to " + newStatus);
        return rows;
    }

    public int deleteAnimal(long animalId) {
        SQLiteDatabase db = getWritableDatabase();
        db.delete("weight_logs", "animal_id=?", new String[]{String.valueOf(animalId)});
        db.delete("health_records", "animal_id=?", new String[]{String.valueOf(animalId)});
        int rows = db.delete("animals", "id=?", new String[]{String.valueOf(animalId)});
        if (rows > 0) enqueue(db, "animals", "DELETE", animalId, "Animal deleted locally");
        return rows;
    }

    public long insertWeightLog(long animalId, double weightKg) {
        String animalCloudId = getAnimalCloudId(animalId);
        if (animalCloudId == null || animalCloudId.isEmpty()) throw new IllegalArgumentException("Animal does not exist");
        SQLiteDatabase db = getWritableDatabase();
        ContentValues values = new ContentValues();
        values.put("cloud_id", uuid());
        values.put("animal_id", animalId);
        values.put("animal_cloud_id", animalCloudId);
        values.put("weight_kg", weightKg);
        values.put("log_date", now());
        values.put("sync_status", PENDING);
        long id = db.insertOrThrow("weight_logs", null, values);
        enqueue(db, "weight_logs", "CREATE", id, "Weight " + weightKg + " kg appended offline");
        return id;
    }

    public long insertHealthRecord(long animalId, String symptoms, String diagnosis, String treatment) {
        String animalCloudId = getAnimalCloudId(animalId);
        if (animalCloudId == null || animalCloudId.isEmpty()) throw new IllegalArgumentException("Animal does not exist");
        SQLiteDatabase db = getWritableDatabase();
        ContentValues values = new ContentValues();
        values.put("cloud_id", uuid());
        values.put("animal_id", animalId);
        values.put("animal_cloud_id", animalCloudId);
        values.put("symptoms_description", symptoms);
        values.put("diagnosis", emptyToNull(diagnosis));
        values.put("treatment_administered", emptyToNull(treatment));
        values.put("recorded_at", now());
        values.put("sync_status", PENDING);
        long id = db.insertOrThrow("health_records", null, values);
        enqueue(db, "health_records", "CREATE", id, "Health record appended offline");
        return id;
    }

    public List<Animal> getAnimals() {
        List<Animal> animals = new ArrayList<>();
        Cursor c = getReadableDatabase().rawQuery("SELECT id, cloud_id, farm_cloud_id, type, identification_tag, birth_date, status, created_at, sync_status FROM animals ORDER BY id DESC", null);
        try { while (c.moveToNext()) animals.add(readAnimal(c)); }
        finally { c.close(); }
        return animals;
    }

    public List<Animal> getPendingAnimals() {
        List<Animal> animals = new ArrayList<>();
        Cursor c = getReadableDatabase().rawQuery("SELECT id, cloud_id, farm_cloud_id, type, identification_tag, birth_date, status, created_at, sync_status FROM animals WHERE sync_status='pending' ORDER BY id ASC", null);
        try { while (c.moveToNext()) animals.add(readAnimal(c)); }
        finally { c.close(); }
        return animals;
    }

    private Animal readAnimal(Cursor c) {
        return new Animal(c.getLong(0), c.getString(1), c.getString(2), c.getString(3), c.getString(4), c.getString(5), c.getString(6), c.getString(7), c.getString(8));
    }

    public List<WeightLog> getWeightLogs(long animalId) {
        List<WeightLog> logs = new ArrayList<>();
        Cursor c = getReadableDatabase().rawQuery("SELECT id, cloud_id, animal_id, animal_cloud_id, weight_kg, log_date, sync_status FROM weight_logs WHERE animal_id=? ORDER BY id DESC", new String[]{String.valueOf(animalId)});
        try { while (c.moveToNext()) logs.add(readWeight(c)); }
        finally { c.close(); }
        return logs;
    }

    public List<WeightLog> getPendingWeightLogs() {
        List<WeightLog> logs = new ArrayList<>();
        Cursor c = getReadableDatabase().rawQuery("SELECT id, cloud_id, animal_id, animal_cloud_id, weight_kg, log_date, sync_status FROM weight_logs WHERE sync_status='pending' ORDER BY id ASC", null);
        try { while (c.moveToNext()) logs.add(readWeight(c)); }
        finally { c.close(); }
        return logs;
    }

    private WeightLog readWeight(Cursor c) {
        return new WeightLog(c.getLong(0), c.getString(1), c.getLong(2), c.getString(3), c.getDouble(4), c.getString(5), c.getString(6));
    }

    public List<HealthRecord> getHealthRecords(long animalId) {
        List<HealthRecord> records = new ArrayList<>();
        Cursor c = getReadableDatabase().rawQuery("SELECT id, cloud_id, animal_id, animal_cloud_id, symptoms_description, diagnosis, treatment_administered, recorded_at, sync_status FROM health_records WHERE animal_id=? ORDER BY id DESC", new String[]{String.valueOf(animalId)});
        try { while (c.moveToNext()) records.add(readHealth(c)); }
        finally { c.close(); }
        return records;
    }

    public List<HealthRecord> getPendingHealthRecords() {
        List<HealthRecord> records = new ArrayList<>();
        Cursor c = getReadableDatabase().rawQuery("SELECT id, cloud_id, animal_id, animal_cloud_id, symptoms_description, diagnosis, treatment_administered, recorded_at, sync_status FROM health_records WHERE sync_status='pending' ORDER BY id ASC", null);
        try { while (c.moveToNext()) records.add(readHealth(c)); }
        finally { c.close(); }
        return records;
    }

    private HealthRecord readHealth(Cursor c) {
        return new HealthRecord(c.getLong(0), c.getString(1), c.getLong(2), c.getString(3), c.getString(4), c.getString(5), c.getString(6), c.getString(7), c.getString(8));
    }

    public PayloadMutationsDto buildPendingPayload() {
        PayloadMutationsDto payload = new PayloadMutationsDto();
        for (Animal a : getPendingAnimals()) {
            SyncAnimalDto dto = new SyncAnimalDto();
            dto.id = a.cloudId;
            dto.type = normalizeType(a.type);
            dto.identificationTag = a.identificationTag;
            dto.birthDate = emptyToNull(a.birthDate);
            dto.status = a.status == null || a.status.isEmpty() ? "healthy" : a.status;
            payload.animals.add(dto);
        }
        for (WeightLog w : getPendingWeightLogs()) {
            SyncWeightLogDto dto = new SyncWeightLogDto();
            dto.id = w.cloudId;
            dto.animalId = w.animalCloudId;
            dto.weightKg = w.weightKg;
            dto.logDate = w.logDate;
            payload.weightLogs.add(dto);
        }
        for (HealthRecord h : getPendingHealthRecords()) {
            SyncHealthRecordDto dto = new SyncHealthRecordDto();
            dto.id = h.cloudId;
            dto.animalId = h.animalCloudId;
            dto.symptomsDescription = h.symptomsDescription;
            dto.diagnosis = emptyToNull(h.diagnosis);
            dto.treatmentAdministered = emptyToNull(h.treatmentAdministered);
            dto.recordedAt = h.recordedAt;
            payload.healthRecords.add(dto);
        }
        return payload;
    }

    public void markAllPendingAsSynced() {
        SQLiteDatabase db = getWritableDatabase();
        db.beginTransaction();
        try {
            ContentValues values = new ContentValues();
            values.put("sync_status", SYNCED);
            db.update("animals", values, "sync_status='pending'", null);
            db.update("weight_logs", values, "sync_status='pending'", null);
            db.update("health_records", values, "sync_status='pending'", null);
            db.update("sync_queue", values, "sync_status='pending'", null);
            db.setTransactionSuccessful();
        } finally { db.endTransaction(); }
    }

    public int pendingSyncCount() {
        Cursor c = getReadableDatabase().rawQuery("SELECT (SELECT COUNT(*) FROM animals WHERE sync_status='pending') + (SELECT COUNT(*) FROM weight_logs WHERE sync_status='pending') + (SELECT COUNT(*) FROM health_records WHERE sync_status='pending')", null);
        try { return c.moveToFirst() ? c.getInt(0) : 0; } finally { c.close(); }
    }

    public List<SyncQueueItem> getPendingSyncQueueItems() {
        List<SyncQueueItem> items = new ArrayList<>();
        Cursor c = getReadableDatabase().rawQuery("SELECT id, entity_name, operation_type, entity_id, payload_summary, sync_status, created_at FROM sync_queue WHERE sync_status='pending' ORDER BY id ASC", null);
        try { while (c.moveToNext()) items.add(new SyncQueueItem(c.getLong(0), c.getString(1), c.getString(2), c.getLong(3), c.getString(4), c.getString(5), c.getString(6))); }
        finally { c.close(); }
        return items;
    }

    public void markQueueItemsAsSynced(List<SyncQueueItem> items) { markAllPendingAsSynced(); }
    public void markQueueItemsPendingAfterFailure(List<SyncQueueItem> items) { }

    private String getAnimalCloudId(long animalId) {
        Cursor c = getReadableDatabase().rawQuery("SELECT cloud_id FROM animals WHERE id=?", new String[]{String.valueOf(animalId)});
        try { return c.moveToFirst() ? c.getString(0) : null; } finally { c.close(); }
    }

    private String normalizeType(String type) {
        if (type == null) return "Cattle";
        String t = type.trim().toLowerCase(Locale.US);
        if (t.contains("swine") || t.contains("pig") || t.contains("cerdo")) return "Swine";
        if (t.contains("poultry") || t.contains("chicken") || t.contains("ave") || t.contains("pollo")) return "Poultry";
        return "Cattle";
    }

    private String emptyToNull(String value) {
        return value == null || value.trim().isEmpty() ? null : value.trim();
    }
}
