package com.irwi.fincapp.repository;

import com.irwi.fincapp.database.DatabaseHelper;
import com.irwi.fincapp.models.Farm;
import com.irwi.fincapp.models.ProductionModule;

import java.util.List;

public class ModuleRepository {

    private final DatabaseHelper databaseHelper;

    public ModuleRepository(DatabaseHelper databaseHelper) {
        this.databaseHelper = databaseHelper;
    }

    public List<Farm> getActiveFarms() {
        return databaseHelper.getActiveFarms();
    }

    public long registerModuleSelection(long farmId, String moduleName) {
        ProductionModule module = new ProductionModule(farmId, moduleName);
        return databaseHelper.saveProductionModule(module);
    }

    public int getPendingSyncCount() {
        return databaseHelper.getPendingSyncCount();
    }
}