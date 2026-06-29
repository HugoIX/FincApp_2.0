package com.irwi.fincapp.database;

import android.content.Context;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

public class DatabaseHelper extends SQLiteOpenHelper {
    public static final String DB_NAME = "fincapp_local.db";
    public static final int DB_VERSION = 4;
    public DatabaseHelper(Context c){ super(c, DB_NAME, null, DB_VERSION); }
    @Override public void onCreate(SQLiteDatabase db){
        db.execSQL("CREATE TABLE IF NOT EXISTS farms (id INTEGER PRIMARY KEY AUTOINCREMENT, cloud_id TEXT, name TEXT NOT NULL, location TEXT, sync_status TEXT DEFAULT 'synced')");
        db.execSQL("CREATE TABLE IF NOT EXISTS animals (id INTEGER PRIMARY KEY AUTOINCREMENT, cloud_id TEXT, farm_cloud_id TEXT, type TEXT, identification_tag TEXT NOT NULL, birth_date TEXT, status TEXT DEFAULT 'active', created_at TEXT, sync_status TEXT DEFAULT 'pending')");
        db.execSQL("CREATE TABLE IF NOT EXISTS weight_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, cloud_id TEXT, animal_id INTEGER, animal_cloud_id TEXT, weight_kg REAL, log_date TEXT, sync_status TEXT DEFAULT 'pending')");
        db.execSQL("CREATE TABLE IF NOT EXISTS health_records (id INTEGER PRIMARY KEY AUTOINCREMENT, cloud_id TEXT, animal_id INTEGER, animal_cloud_id TEXT, symptoms_description TEXT, diagnosis TEXT, treatment_administered TEXT, recorded_at TEXT, sync_status TEXT DEFAULT 'pending')");
        db.execSQL("CREATE TABLE IF NOT EXISTS sync_queue (id INTEGER PRIMARY KEY AUTOINCREMENT, entity_name TEXT, entity_id INTEGER, operation_type TEXT, payload TEXT, sync_status TEXT DEFAULT 'pending', created_at TEXT)");
        db.execSQL("INSERT OR IGNORE INTO farms(id, cloud_id, name, location, sync_status) VALUES (1, '00000000-0000-0000-0000-000000000001', 'Demo Farm', 'Offline demo', 'synced')");
    }
    @Override public void onUpgrade(SQLiteDatabase db,int oldV,int newV){ onCreate(db); }
}
