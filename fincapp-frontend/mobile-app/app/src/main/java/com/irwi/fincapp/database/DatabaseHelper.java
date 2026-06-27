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

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

public class DatabaseHelper extends SQLiteOpenHelper {
    public static final String DB_NAME = "fincapp_local.db";
    public static final int DB_VERSION = 2;
    public static final String PENDING = "pending";

    public DatabaseHelper(Context context) { super(context, DB_NAME, null, DB_VERSION); }

    @Override
    public void onCreate(SQLiteDatabase db) {
        // US-01 support tables
        db.execSQL("CREATE TABLE IF NOT EXISTS local_users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT, sync_status TEXT DEFAULT 'pending')");
        db.execSQL("CREATE TABLE IF NOT EXISTS local_farms (id INTEGER PRIMARY KEY AUTOINCREMENT, cloud_id TEXT, name TEXT NOT NULL, location TEXT, sync_status TEXT DEFAULT 'pending')");
        db.execSQL("CREATE TABLE IF NOT EXISTS local_production_modules (id INTEGER PRIMARY KEY AUTOINCREMENT, farm_id INTEGER, module_name TEXT NOT NULL, sync_status TEXT DEFAULT 'pending')");

        // US-02 / US-09 SQLite <-> Cloud contract names. sync_status is added for US-02 offline sync readiness.
        db.execSQL("CREATE TABLE IF NOT EXISTS animals (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
                "cloud_id TEXT, " +
                "farm_cloud_id TEXT, " +
                "type TEXT NOT NULL, " +
                "identification_tag TEXT NOT NULL, " +
                "birth_date TEXT, " +
                "status TEXT NOT NULL DEFAULT 'active', " +
                "created_at TEXT NOT NULL, " +
                "sync_status TEXT NOT NULL DEFAULT 'pending')");

        db.execSQL("CREATE TABLE IF NOT EXISTS weight_logs (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
                "cloud_id TEXT, " +
                "animal_id INTEGER NOT NULL, " +
                "animal_cloud_id TEXT, " +
                "weight_kg REAL NOT NULL, " +
                "log_date TEXT NOT NULL, " +
                "sync_status TEXT NOT NULL DEFAULT 'pending', " +
                "FOREIGN KEY(animal_id) REFERENCES animals(id))");

        db.execSQL("CREATE TABLE IF NOT EXISTS health_records (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
                "cloud_id TEXT, " +
                "animal_id INTEGER NOT NULL, " +
                "animal_cloud_id TEXT, " +
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
        return new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault()).format(new Date());
    }

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

    public long insertAnimal(String farmCloudId, String type, String identificationTag, String birthDate, String status) {
        SQLiteDatabase db = getWritableDatabase();
        db.beginTransaction();
        long id;
        try {
            ContentValues values = new ContentValues();
            values.put("cloud_id", (String) null);
            values.put("farm_cloud_id", farmCloudId);
            values.put("type", type);
            values.put("identification_tag", identificationTag);
            values.put("birth_date", birthDate);
            values.put("status", status);
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
        SQLiteDatabase db = getWritableDatabase();
        ContentValues values = new ContentValues();
        values.put("cloud_id", (String) null);
        values.put("animal_id", animalId);
        values.put("animal_cloud_id", (String) null);
        values.put("weight_kg", weightKg);
        values.put("log_date", now());
        values.put("sync_status", PENDING);
        long id = db.insertOrThrow("weight_logs", null, values);
        enqueue(db, "weight_logs", "CREATE", id, "Weight " + weightKg + " kg appended offline");
        return id;
    }

    public long insertHealthRecord(long animalId, String symptoms, String diagnosis, String treatment) {
        SQLiteDatabase db = getWritableDatabase();
        ContentValues values = new ContentValues();
        values.put("cloud_id", (String) null);
        values.put("animal_id", animalId);
        values.put("animal_cloud_id", (String) null);
        values.put("symptoms_description", symptoms);
        values.put("diagnosis", diagnosis);
        values.put("treatment_administered", treatment);
        values.put("recorded_at", now());
        values.put("sync_status", PENDING);
        long id = db.insertOrThrow("health_records", null, values);
        enqueue(db, "health_records", "CREATE", id, "Health record appended offline");
        return id;
    }

    public List<Animal> getAnimals() {
        List<Animal> animals = new ArrayList<>();
        Cursor c = getReadableDatabase().rawQuery("SELECT id, cloud_id, farm_cloud_id, type, identification_tag, birth_date, status, created_at, sync_status FROM animals ORDER BY id DESC", null);
        try {
            while (c.moveToNext()) {
                animals.add(new Animal(c.getLong(0), c.getString(1), c.getString(2), c.getString(3), c.getString(4), c.getString(5), c.getString(6), c.getString(7), c.getString(8)));
            }
        } finally { c.close(); }
        return animals;
    }

    public List<WeightLog> getWeightLogs(long animalId) {
        List<WeightLog> logs = new ArrayList<>();
        Cursor c = getReadableDatabase().rawQuery("SELECT id, animal_id, weight_kg, log_date FROM weight_logs WHERE animal_id=? ORDER BY id DESC", new String[]{String.valueOf(animalId)});
        try { while (c.moveToNext()) logs.add(new WeightLog(c.getLong(0), c.getLong(1), c.getDouble(2), c.getString(3))); }
        finally { c.close(); }
        return logs;
    }

    public List<HealthRecord> getHealthRecords(long animalId) {
        List<HealthRecord> records = new ArrayList<>();
        Cursor c = getReadableDatabase().rawQuery("SELECT id, animal_id, symptoms_description, diagnosis, treatment_administered, recorded_at FROM health_records WHERE animal_id=? ORDER BY id DESC", new String[]{String.valueOf(animalId)});
        try { while (c.moveToNext()) records.add(new HealthRecord(c.getLong(0), c.getLong(1), c.getString(2), c.getString(3), c.getString(4), c.getString(5))); }
        finally { c.close(); }
        return records;
    }


    public List<SyncQueueItem> getPendingSyncQueueItems() {
        List<SyncQueueItem> items = new ArrayList<>();
        Cursor c = getReadableDatabase().rawQuery(
                "SELECT id, entity_name, operation_type, entity_id, payload_summary, sync_status, created_at " +
                        "FROM sync_queue WHERE sync_status='pending' ORDER BY id ASC", null);
        try {
            while (c.moveToNext()) {
                items.add(new SyncQueueItem(
                        c.getLong(0), c.getString(1), c.getString(2), c.getLong(3),
                        c.getString(4), c.getString(5), c.getString(6)));
            }
        } finally { c.close(); }
        return items;
    }

    public void markQueueItemsAsSynced(List<SyncQueueItem> items) {
        if (items == null || items.isEmpty()) return;
        SQLiteDatabase db = getWritableDatabase();
        db.beginTransaction();
        try {
            ContentValues queueValues = new ContentValues();
            queueValues.put("sync_status", "synced");
            for (SyncQueueItem item : items) {
                db.update("sync_queue", queueValues, "id=?", new String[]{String.valueOf(item.id)});
                markEntityAsSyncedInsideTransaction(db, item.entityName, item.entityId);
            }
            db.setTransactionSuccessful();
        } finally { db.endTransaction(); }
    }

    private void markEntityAsSyncedInsideTransaction(SQLiteDatabase db, String entityName, long entityId) {
        if (!"animals".equals(entityName) && !"weight_logs".equals(entityName) && !"health_records".equals(entityName)) {
            return;
        }
        ContentValues values = new ContentValues();
        values.put("sync_status", "synced");
        db.update(entityName, values, "id=?", new String[]{String.valueOf(entityId)});
    }

    public void markQueueItemsPendingAfterFailure(List<SyncQueueItem> items) {
        // Keep rows as pending. This method exists for readability and Logcat traceability in the sync layer.
        // WorkManager handles the retry using exponential backoff.
    }

    public int pendingSyncCount() {
        Cursor c = getReadableDatabase().rawQuery("SELECT COUNT(*) FROM sync_queue WHERE sync_status='pending'", null);
        try { return c.moveToFirst() ? c.getInt(0) : 0; } finally { c.close(); }
    }
}
