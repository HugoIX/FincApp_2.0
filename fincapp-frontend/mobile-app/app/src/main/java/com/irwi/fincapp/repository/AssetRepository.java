package com.irwi.fincapp.repository;

import android.content.Context;

import com.irwi.fincapp.database.DatabaseHelper;
import com.irwi.fincapp.models.Animal;
import com.irwi.fincapp.models.HealthRecord;
import com.irwi.fincapp.models.WeightLog;

import java.util.List;

public class AssetRepository {
    private final DatabaseHelper db;
    public AssetRepository(Context context) { db = new DatabaseHelper(context); db.getWritableDatabase(); }

    public long createAnimal(String farmCloudId, String type, String tag, String birthDate, String status) {
        return db.insertAnimal(farmCloudId, type, tag, birthDate, status);
    }
    public int updateStatus(long animalId, String status) { return db.updateAnimalStatus(animalId, status); }
    public int deleteAnimal(long animalId) { return db.deleteAnimal(animalId); }
    public long appendWeight(long animalId, double kg) { return db.insertWeightLog(animalId, kg); }
    public long appendHealth(long animalId, String symptoms, String diagnosis, String treatment) { return db.insertHealthRecord(animalId, symptoms, diagnosis, treatment); }
    public List<Animal> getAnimals() { return db.getAnimals(); }
    public List<WeightLog> getWeightLogs(long animalId) { return db.getWeightLogs(animalId); }
    public List<HealthRecord> getHealthRecords(long animalId) { return db.getHealthRecords(animalId); }
    public int pendingSyncCount() { return db.pendingSyncCount(); }
}
