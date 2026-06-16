package com.irwi.fincapp.ui;

import android.app.Activity;
import android.os.Bundle;
import android.widget.Button;
import android.widget.Toast;

import com.irwi.fincapp.R;
import com.irwi.fincapp.database.DatabaseHelper;

public class MainActivity extends Activity {

    private DatabaseHelper databaseHelper;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        databaseHelper = new DatabaseHelper(this);
        databaseHelper.getWritableDatabase();

        Button btnCattle = findViewById(R.id.btnCattle);
        Button btnSwine = findViewById(R.id.btnSwine);
        Button btnPoultry = findViewById(R.id.btnPoultry);

        btnCattle.setOnClickListener(v -> saveModule("Cattle"));
        btnSwine.setOnClickListener(v -> saveModule("Swine"));
        btnPoultry.setOnClickListener(v -> saveModule("Poultry"));
    }

    private void saveModule(String moduleName) {
        long id = databaseHelper.saveSelectedModule(moduleName);
        Toast.makeText(
                this,
                moduleName + " saved offline. sync_status = pending. ID: " + id,
                Toast.LENGTH_SHORT
        ).show();
    }
}
