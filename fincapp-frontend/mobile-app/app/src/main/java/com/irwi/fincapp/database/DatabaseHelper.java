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

    private static final String DATABASE_NAME = "fincapp_local.db";
    private static final int DATABASE_VERSION = 1;
    public static final String STATUS_PENDING = "pending";

    public DatabaseHelper(Context context) {
        super(context, DATABASE_NAME, null, DATABASE_VERSION);
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE local_users (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
                "remote_id INTEGER, " +
                "full_name TEXT NOT NULL, " +
                "email TEXT, " +
                "role TEXT DEFAULT 'field_worker', " +
                "is_active INTEGER DEFAULT 1, " +
                "sync_status TEXT NOT NULL DEFAULT 'pending', " +
                "created_at TEXT DEFAULT CURRENT_TIMESTAMP, " +
                "updated_at TEXT DEFAULT CURRENT_TIMESTAMP" +
                ")");

        db.execSQL("CREATE TABLE local_farms (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
                "remote_id INTEGER, " +
                "name TEXT NOT NULL, " +
                "location TEXT, " +
                "is_active INTEGER DEFAULT 1, " +
                "sync_status TEXT NOT NULL DEFAULT 'pending', " +
                "created_at TEXT DEFAULT CURRENT_TIMESTAMP, " +
                "updated_at TEXT DEFAULT CURRENT_TIMESTAMP" +
                ")");

        db.execSQL("CREATE TABLE local_production_modules (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
                "remote_id INTEGER, " +
                "farm_id INTEGER NOT NULL, " +
                "module_name TEXT NOT NULL, " +
                "module_type TEXT NOT NULL, " +
                "is_active INTEGER DEFAULT 1, " +
                "sync_status TEXT NOT NULL DEFAULT 'pending', " +
                "created_at TEXT DEFAULT CURRENT_TIMESTAMP, " +
                "updated_at TEXT DEFAULT CURRENT_TIMESTAMP, " +
                "FOREIGN KEY(farm_id) REFERENCES local_farms(id)" +
                ")");

        db.execSQL("CREATE TABLE sync_queue (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
                "entity_table TEXT NOT NULL, " +
                "entity_id INTEGER NOT NULL, " +
                "operation_type TEXT NOT NULL, " +
                "payload TEXT, " +
                "sync_status TEXT NOT NULL DEFAULT 'pending', " +
                "created_at TEXT DEFAULT CURRENT_TIMESTAMP" +
                ")");

        seedInitialOfflineData(db);
    }

    private void seedInitialOfflineData(SQLiteDatabase db) {
        ContentValues user = new ContentValues();
        user.put("full_name", "Offline Field Worker");
        user.put("email", "field.worker@fincapp.local");
        user.put("sync_status", STATUS_PENDING);
        long userId = db.insert("local_users", null, user);
        insertSyncQueue(db, "local_users", userId, "INSERT", "{\"full_name\":\"Offline Field Worker\"}");

        insertFarmSeed(db, "Demo Farm North", "Remote area A");
        insertFarmSeed(db, "Demo Farm South", "Remote area B");
    }

    private void insertFarmSeed(SQLiteDatabase db, String name, String location) {
        ContentValues values = new ContentValues();
        values.put("name", name);
        values.put("location", location);
        values.put("is_active", 1);
        values.put("sync_status", STATUS_PENDING);
        long farmId = db.insert("local_farms", null, values);
        insertSyncQueue(db, "local_farms", farmId, "INSERT", "{\"name\":\"" + name + "\"}");
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        db.execSQL("DROP TABLE IF EXISTS sync_queue");
        db.execSQL("DROP TABLE IF EXISTS local_production_modules");
        db.execSQL("DROP TABLE IF EXISTS local_farms");
        db.execSQL("DROP TABLE IF EXISTS local_users");
        onCreate(db);
    }

    public List<Farm> getActiveFarms() {
        List<Farm> farms = new ArrayList<>();
        SQLiteDatabase db = getReadableDatabase();
        Cursor cursor = db.rawQuery("SELECT id, name FROM local_farms WHERE is_active = 1 ORDER BY name", null);
        try {
            while (cursor.moveToNext()) {
                farms.add(new Farm(cursor.getLong(0), cursor.getString(1)));
            }
        } finally {
            cursor.close();
        }
        return farms;
    }

    public long saveProductionModule(ProductionModule module) {
        SQLiteDatabase db = getWritableDatabase();
        db.beginTransaction();
        try {
            ContentValues values = new ContentValues();
            values.put("farm_id", module.getFarmId());
            values.put("module_name", module.getModuleName());
            values.put("module_type", module.getModuleName().toUpperCase());
            values.put("is_active", 1);
            values.put("sync_status", STATUS_PENDING);
            long moduleId = db.insertOrThrow("local_production_modules", null, values);

            String payload = "{\"farm_id\":" + module.getFarmId() +
                    ",\"module_name\":\"" + module.getModuleName() +
                    "\",\"sync_status\":\"pending\"}";
            insertSyncQueue(db, "local_production_modules", moduleId, "INSERT", payload);

            db.setTransactionSuccessful();
            return moduleId;
        } finally {
            db.endTransaction();
        }
    }

    private void insertSyncQueue(SQLiteDatabase db, String table, long entityId, String operation, String payload) {
        ContentValues queue = new ContentValues();
        queue.put("entity_table", table);
        queue.put("entity_id", entityId);
        queue.put("operation_type", operation);
        queue.put("payload", payload);
        queue.put("sync_status", STATUS_PENDING);
        db.insert("sync_queue", null, queue);
    }

    public int getPendingSyncCount() {
        SQLiteDatabase db = getReadableDatabase();
        Cursor cursor = db.rawQuery("SELECT COUNT(*) FROM sync_queue WHERE sync_status = ?", new String[]{STATUS_PENDING});
        try {
            return cursor.moveToFirst() ? cursor.getInt(0) : 0;
        } finally {
            cursor.close();
        }
    }
}
