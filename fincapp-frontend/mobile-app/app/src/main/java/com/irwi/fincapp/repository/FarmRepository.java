package com.irwi.fincapp.repository;import android.content.*;import android.database.*;import com.irwi.fincapp.database.DatabaseHelper;
public class FarmRepository{private final DatabaseHelper h; public FarmRepository(Context c){h=new DatabaseHelper(c);} public Cursor farms(){return h.getReadableDatabase().rawQuery("SELECT cloud_id,name,location FROM farms ORDER BY name",null);} }
