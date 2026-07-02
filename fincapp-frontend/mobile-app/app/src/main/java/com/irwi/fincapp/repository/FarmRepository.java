package com.irwi.fincapp.repository;

import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import com.irwi.fincapp.database.DatabaseHelper;

public class FarmRepository {
    private final DatabaseHelper helper;

    public FarmRepository(Context context) {
        helper = new DatabaseHelper(context);
    }

    public void saveFarm(String cloudId, String ownerId, String name, String location, String createdAt) {
        helper.upsertFarm(cloudId, ownerId, name, location, createdAt);
    }

    public Cursor localFarms() {
        SQLiteDatabase db = helper.getReadableDatabase();
        return db.rawQuery("SELECT cloud_id, name, IFNULL(location, ''), IFNULL(owner_id, '') FROM farms ORDER BY name", null);
    }

    public int count() {
        Cursor c = helper.getReadableDatabase().rawQuery("SELECT COUNT(*) FROM farms", null);
        try { return c.moveToFirst() ? c.getInt(0) : 0; } finally { c.close(); }
    }
}
