package com.irwi.fincapp.database;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

import com.irwi.fincapp.models.Farm;
import com.irwi.fincapp.models.ProductionModule;

import java.util.ArrayList;
import java.util.List;

public class DatabaseHelper extends SQLiteOpenHelper {

    public static final String DB_NAME = "fincapp_mobile.db";
    public static final int DB_VERSION = 7;

    public DatabaseHelper(Context context) {
        super(context, DB_NAME, null, DB_VERSION);
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE IF NOT EXISTS farms (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
                "cloud_id TEXT UNIQUE NOT NULL, " +
                "owner_id TEXT, " +
                "name TEXT NOT NULL, " +
                "location TEXT, " +
                "created_at TEXT, " +
                "sync_status TEXT DEFAULT 'synced')");

        db.execSQL("CREATE TABLE IF NOT EXISTS animals (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
                "cloud_id TEXT UNIQUE NOT NULL, " +
                "farm_cloud_id TEXT NOT NULL, " +
                "type TEXT NOT NULL, " +
                "identification_tag TEXT NOT NULL, " +
                "birth_date TEXT, " +
                "status TEXT DEFAULT 'healthy', " +
                "created_at TEXT, " +
                "sync_status TEXT DEFAULT 'pending')");

        db.execSQL("CREATE TABLE IF NOT EXISTS weight_logs (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
                "cloud_id TEXT UNIQUE NOT NULL, " +
                "animal_id INTEGER NOT NULL, " +
                "animal_cloud_id TEXT NOT NULL, " +
                "weight_kg REAL NOT NULL, " +
                "log_date TEXT NOT NULL, " +
                "sync_status TEXT DEFAULT 'pending')");

        db.execSQL("CREATE TABLE IF NOT EXISTS health_records (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
                "cloud_id TEXT UNIQUE NOT NULL, " +
                "animal_id INTEGER NOT NULL, " +
                "animal_cloud_id TEXT NOT NULL, " +
                "symptoms_description TEXT NOT NULL, " +
                "diagnosis TEXT, " +
                "treatment_administered TEXT, " +
                "recorded_at TEXT NOT NULL, " +
                "sync_status TEXT DEFAULT 'pending')");

        db.execSQL("CREATE TABLE IF NOT EXISTS sync_queue (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
                "entity_name TEXT NOT NULL, " +
                "entity_id INTEGER NOT NULL, " +
                "operation_type TEXT DEFAULT 'create', " +
                "sync_status TEXT DEFAULT 'pending', " +
                "created_at TEXT)");
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        db.execSQL("DROP TABLE IF EXISTS sync_queue");
        db.execSQL("DROP TABLE IF EXISTS health_records");
        db.execSQL("DROP TABLE IF EXISTS weight_logs");
        db.execSQL("DROP TABLE IF EXISTS animals");
        db.execSQL("DROP TABLE IF EXISTS farms");
        onCreate(db);
    }

    public void upsertFarm(String cloudId, String ownerId, String name, String location, String createdAt) {
        SQLiteDatabase db = getWritableDatabase();

        ContentValues values = new ContentValues();
        values.put("cloud_id", cloudId);
        values.put("owner_id", ownerId);
        values.put("name", name);
        values.put("location", location);
        values.put("created_at", createdAt);
        values.put("sync_status", "synced");

        db.insertWithOnConflict("farms", null, values, SQLiteDatabase.CONFLICT_REPLACE);
    }

    public List<Farm> getActiveFarms() {
        List<Farm> farms = new ArrayList<>();

        SQLiteDatabase db = this.getReadableDatabase();

        Cursor cursor = db.rawQuery(
                "SELECT id, name FROM farms WHERE sync_status != 'deleted' ORDER BY name ASC",
                null
        );

        if (cursor.moveToFirst()) {
            do {
                Farm farm = new Farm(
                        cursor.getLong(cursor.getColumnIndexOrThrow("id")),
                        cursor.getString(cursor.getColumnIndexOrThrow("name"))
                );

                farms.add(farm);
            } while (cursor.moveToNext());
        }

        cursor.close();
        return farms;
    }

    public long saveProductionModule(ProductionModule module) {
        SQLiteDatabase db = this.getWritableDatabase();

        ContentValues values = new ContentValues();
        values.put("entity_name", "production_module");
        values.put("entity_id", module.getFarmId());
        values.put("operation_type", "select_" + module.getModuleName());
        values.put("sync_status", "pending");
        values.put("created_at", String.valueOf(System.currentTimeMillis()));

        return db.insert("sync_queue", null, values);
    }

    public int getPendingSyncCount() {
        SQLiteDatabase db = this.getReadableDatabase();

        Cursor cursor = db.rawQuery(
                "SELECT COUNT(*) FROM sync_queue WHERE sync_status = 'pending'",
                null
        );

        int count = 0;

        if (cursor.moveToFirst()) {
            count = cursor.getInt(0);
        }

        cursor.close();
        return count;
    }
}