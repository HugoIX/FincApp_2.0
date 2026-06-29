package com.irwi.fincapp.ui;

import android.app.Activity;
import android.os.Bundle;
import android.content.Intent;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import com.irwi.fincapp.R;
import com.irwi.fincapp.database.DatabaseHelper;
import com.irwi.fincapp.models.Farm;
import com.irwi.fincapp.repository.ModuleRepository;

import java.util.List;

public class MainActivity extends Activity {

    private ModuleRepository moduleRepository;
    private Spinner spinnerFarms;
    private TextView txtStatus;
    private List<Farm> activeFarms;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        DatabaseHelper databaseHelper = new DatabaseHelper(this);
        databaseHelper.getWritableDatabase(); // Initializes local SQLite on first boot, even in airplane mode.
        moduleRepository = new ModuleRepository(databaseHelper);

        spinnerFarms = findViewById(R.id.spinnerFarms);
        txtStatus = findViewById(R.id.txtStatus);

        Button btnWakeAura = findViewById(R.id.btnWakeAura);
        Button btnCattle = findViewById(R.id.btnCattle);
        Button btnSwine = findViewById(R.id.btnSwine);
        Button btnPoultry = findViewById(R.id.btnPoultry);

        loadActiveFarms();
        updateStatus("SQLite local DB initialized. Pending sync items: " + moduleRepository.getPendingSyncCount());

        btnWakeAura.setOnClickListener(v -> startActivity(new Intent(this, AuraActivity.class)));

        btnCattle.setOnClickListener(v -> saveModuleOffline("Cattle"));
        btnSwine.setOnClickListener(v -> saveModuleOffline("Swine"));
        btnPoultry.setOnClickListener(v -> saveModuleOffline("Poultry"));
    }

    private void loadActiveFarms() {
        activeFarms = moduleRepository.getActiveFarms();
        ArrayAdapter<Farm> adapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_item, activeFarms);
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        spinnerFarms.setAdapter(adapter);
    }

    private void saveModuleOffline(String moduleName) {
        if (activeFarms == null || activeFarms.isEmpty()) {
            Toast.makeText(this, "No active farms available", Toast.LENGTH_SHORT).show();
            return;
        }

        Farm selectedFarm = (Farm) spinnerFarms.getSelectedItem();
        long id = moduleRepository.registerModuleSelection(selectedFarm.getId(), moduleName);
        String message = moduleName + " saved offline for " + selectedFarm.getName() +
                "\nsync_status = pending\nlocal_id = " + id +
                "\npending queue = " + moduleRepository.getPendingSyncCount();

        updateStatus(message);
        Toast.makeText(this, moduleName + " saved offline", Toast.LENGTH_SHORT).show();
    }

    private void updateStatus(String text) {
        txtStatus.setText(text);
    }
}
