package com.irwi.fincapp.database;

import android.content.ContentValues;
import android.content.Context;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

public class DatabaseHelper extends SQLiteOpenHelper {

    private static final String DATABASE_NAME = "fincapp_local.db";
    private static final int DATABASE_VERSION = 1;

    public static final String SYNC_PENDING = "pending";

    public DatabaseHelper(Context context) {
        super(context, DATABASE_NAME, null, DATABASE_VERSION);
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE IF NOT EXISTS local_users (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
                "name TEXT NOT NULL, " +
                "email TEXT, " +
                "sync_status TEXT NOT NULL DEFAULT 'pending', " +
                "created_at DATETIME DEFAULT CURRENT_TIMESTAMP" +
                ")");

        db.execSQL("CREATE TABLE IF NOT EXISTS local_farms (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
                "name TEXT NOT NULL, " +
                "location TEXT, " +
                "sync_status TEXT NOT NULL DEFAULT 'pending', " +
                "created_at DATETIME DEFAULT CURRENT_TIMESTAMP" +
                ")");

        db.execSQL("CREATE TABLE IF NOT EXISTS local_production_modules (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
                "farm_id INTEGER, " +
                "module_name TEXT NOT NULL, " +
                "sync_status TEXT NOT NULL DEFAULT 'pending', " +
                "created_at DATETIME DEFAULT CURRENT_TIMESTAMP" +
                ")");

        db.execSQL("CREATE TABLE IF NOT EXISTS sync_queue (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
                "entity_name TEXT NOT NULL, " +
                "operation_type TEXT NOT NULL, " +
                "entity_id INTEGER, " +
                "sync_status TEXT NOT NULL DEFAULT 'pending', " +
                "created_at DATETIME DEFAULT CURRENT_TIMESTAMP" +
                ")");
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        db.execSQL("DROP TABLE IF EXISTS sync_queue");
        db.execSQL("DROP TABLE IF EXISTS local_production_modules");
        db.execSQL("DROP TABLE IF EXISTS local_farms");
        db.execSQL("DROP TABLE IF EXISTS local_users");
        onCreate(db);
    }

    public long saveSelectedModule(String moduleName) {
        SQLiteDatabase db = getWritableDatabase();

        ContentValues moduleValues = new ContentValues();
        moduleValues.put("module_name", moduleName);
        moduleValues.put("sync_status", SYNC_PENDING);

        long moduleId = db.insert("local_production_modules", null, moduleValues);

        ContentValues queueValues = new ContentValues();
        queueValues.put("entity_name", "local_production_modules");
        queueValues.put("operation_type", "INSERT");
        queueValues.put("entity_id", moduleId);
        queueValues.put("sync_status", SYNC_PENDING);

        db.insert("sync_queue", null, queueValues);
        return moduleId;
    }
}
