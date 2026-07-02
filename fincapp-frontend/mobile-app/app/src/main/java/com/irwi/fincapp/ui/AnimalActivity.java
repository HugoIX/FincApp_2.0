package com.irwi.fincapp.ui;

import android.app.Activity;
import android.database.Cursor;
import android.os.Bundle;
import android.text.InputType;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import com.irwi.fincapp.repository.AnimalRepository;
import com.irwi.fincapp.session.SessionManager;
import com.irwi.fincapp.sync.SyncScheduler;

public class AnimalActivity extends Activity {
    private AnimalRepository repository;
    private SessionManager session;
    private LinearLayout animalList;
    private String type;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        repository = new AnimalRepository(this);
        session = new SessionManager(this);
        type = getIntent().getStringExtra("type");
        if (type == null || type.trim().isEmpty()) type = "Cattle";

        LinearLayout layout = BaseUi.root(this);
        layout.addView(BaseUi.title(this, type + " records"));
        layout.addView(BaseUi.subtitle(this, "Register animals offline. They will sync to the backend when internet is available."));

        EditText tag = BaseUi.input(this, "Identification tag / ear tag");
        EditText birth = BaseUi.input(this, "Birth date YYYY-MM-DD (optional)");
        EditText status = BaseUi.input(this, "Status (healthy, active, sick...)");
        status.setText("healthy");
        Button saveAnimal = BaseUi.button(this, "Save animal");

        layout.addView(tag);
        layout.addView(birth);
        layout.addView(status);
        layout.addView(saveAnimal);
        layout.addView(BaseUi.divider(this));
        layout.addView(BaseUi.text(this, "Animals in this module", 22));

        animalList = new LinearLayout(this);
        animalList.setOrientation(LinearLayout.VERTICAL);
        layout.addView(animalList);

        saveAnimal.setOnClickListener(v -> {
            String value = tag.getText().toString().trim();
            if (value.isEmpty()) {
                BaseUi.toast(this, "Identification tag is required.");
                return;
            }
            repository.addAnimal(session.farmId(), type, value, birth.getText().toString().trim(), status.getText().toString().trim());
            tag.setText("");
            birth.setText("");
            SyncScheduler.schedule(this);
            BaseUi.toast(this, "Animal saved locally with sync_status = pending.");
            renderAnimals();
        });

        renderAnimals();
    }

    private void renderAnimals() {
        animalList.removeAllViews();
        Cursor cursor = repository.animalsByType(session.farmId(), type);
        int count = 0;
        try {
            while (cursor.moveToNext()) {
                count++;
                long localId = cursor.getLong(0);
                String tag = cursor.getString(1);
                String sync = cursor.getString(3);
                Button item = BaseUi.secondaryButton(this, "#" + tag + "  •  " + sync + "\nAdd weight or health record");
                animalList.addView(item);
                item.setOnClickListener(v -> showLogDialog(localId, tag));
            }
        } finally {
            cursor.close();
        }
        if (count == 0) {
            animalList.addView(BaseUi.text(this, "No animals yet in " + type + ". Register the first one above.", 17));
        }
    }

    private void showLogDialog(long animalId, String tag) {
        final android.app.Dialog dialog = new android.app.Dialog(this);
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(32, 32, 32, 32);

        layout.addView(BaseUi.title(this, "Animal #" + tag));
        EditText weight = BaseUi.input(this, "Weight kg");
        weight.setInputType(InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_FLAG_DECIMAL);
        EditText symptoms = BaseUi.input(this, "Health symptoms");
        EditText diagnosis = BaseUi.input(this, "Diagnosis (optional)");
        EditText treatment = BaseUi.input(this, "Treatment administered (optional)");
        Button saveWeight = BaseUi.button(this, "Save weight");
        Button saveHealth = BaseUi.button(this, "Save health record");
        Button close = BaseUi.secondaryButton(this, "Close");

        layout.addView(weight);
        layout.addView(saveWeight);
        layout.addView(BaseUi.divider(this));
        layout.addView(symptoms);
        layout.addView(diagnosis);
        layout.addView(treatment);
        layout.addView(saveHealth);
        layout.addView(close);

        saveWeight.setOnClickListener(v -> {
            try {
                double kg = Double.parseDouble(weight.getText().toString().trim());
                repository.addWeight(animalId, kg);
                SyncScheduler.schedule(this);
                BaseUi.toast(this, "Weight saved locally.");
                dialog.dismiss();
                renderAnimals();
            } catch (Exception ex) {
                BaseUi.toast(this, "Enter a valid weight.");
            }
        });

        saveHealth.setOnClickListener(v -> {
            String sym = symptoms.getText().toString().trim();
            if (sym.isEmpty()) {
                BaseUi.toast(this, "Symptoms are required.");
                return;
            }
            repository.addHealth(animalId, sym, diagnosis.getText().toString().trim(), treatment.getText().toString().trim());
            SyncScheduler.schedule(this);
            BaseUi.toast(this, "Health record saved locally.");
            dialog.dismiss();
            renderAnimals();
        });

        close.setOnClickListener(v -> dialog.dismiss());
        dialog.setContentView(layout);
        dialog.show();
    }
}
