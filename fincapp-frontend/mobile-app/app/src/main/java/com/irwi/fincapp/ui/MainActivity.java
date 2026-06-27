package com.irwi.fincapp.ui;

import android.app.Activity;
import android.os.Bundle;
import android.graphics.Typeface;
import android.view.Gravity;
import android.view.View;
import android.widget.*;
import android.text.InputType;
import android.graphics.Color;

import com.irwi.fincapp.R;
import com.irwi.fincapp.models.Animal;
import com.irwi.fincapp.models.HealthRecord;
import com.irwi.fincapp.models.WeightLog;
import com.irwi.fincapp.repository.AssetRepository;
import com.irwi.fincapp.sync.SyncScheduler;

import java.util.List;

public class MainActivity extends Activity {
    private LinearLayout root;
    private AssetRepository repository;
    private EditText farmCloudIdInput, typeInput, tagInput, birthDateInput, statusInput, animalIdInput, weightInput, symptomsInput, diagnosisInput, treatmentInput;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        repository = new AssetRepository(this);
        SyncScheduler.schedulePeriodicSync(this);
        SyncScheduler.scheduleOneTimeSync(this);
        SyncScheduler.registerConnectivityCallback(this);
        root = findViewById(R.id.rootContainer);
        renderHome();
    }

    private void renderHome() {
        root.removeAllViews();
        title("🐄 FincApp - Offline Asset Management", 26);
        subtitle("US-03: Offline CRUD + automatic background sync orchestration.");
        subtitle("Pending sync queue: " + repository.pendingSyncCount() + " | WorkManager auto-sync enabled");

        section("1. New animal registration");
        farmCloudIdInput = input("Farm cloud id (optional, e.g. farm-001)", InputType.TYPE_CLASS_TEXT);
        typeInput = input("Animal type: Cattle / Swine / Poultry", InputType.TYPE_CLASS_TEXT);
        tagInput = input("Identification tag / arete / código", InputType.TYPE_CLASS_TEXT);
        birthDateInput = input("Birth date (YYYY-MM-DD, optional)", InputType.TYPE_CLASS_TEXT);
        statusInput = input("Status", InputType.TYPE_CLASS_TEXT);
        statusInput.setText("active");
        actionButton("💾 SAVE ANIMAL OFFLINE", v -> saveAnimal());

        section("2. Append historical logs to selected animal");
        animalIdInput = input("Local animal id", InputType.TYPE_CLASS_NUMBER);
        weightInput = input("Weight kg", InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_FLAG_DECIMAL);
        actionButton("⚖️ APPEND WEIGHT LOG", v -> appendWeight());
        symptomsInput = input("Health symptoms description", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE);
        diagnosisInput = input("Diagnosis (optional)", InputType.TYPE_CLASS_TEXT);
        treatmentInput = input("Treatment administered (optional)", InputType.TYPE_CLASS_TEXT);
        actionButton("🩺 APPEND HEALTH RECORD", v -> appendHealth());

        section("3. Local offline animals and background sync");
        actionButton("🔄 REFRESH LOCAL LIST", v -> renderHome());
        actionButton("📡 SCHEDULE BACKGROUND SYNC TEST", v -> { SyncScheduler.scheduleOneTimeSync(this); toast("Background sync scheduled. Check Logcat tag: FincAppSync"); });
        renderAnimalList();
    }

    private void saveAnimal() {
        String type = text(typeInput);
        String tag = text(tagInput);
        String status = text(statusInput).isEmpty() ? "active" : text(statusInput);
        if (type.isEmpty() || tag.isEmpty()) { toast("Type and identification tag are required."); return; }
        long id = repository.createAnimal(text(farmCloudIdInput), type, tag, text(birthDateInput), status);
        toast("Animal saved offline. local id=" + id + ", sync_status=pending");
        renderHome();
    }

    private void appendWeight() {
        Long animalId = parseLong(text(animalIdInput));
        Double kg = parseDouble(text(weightInput));
        if (animalId == null || kg == null || kg <= 0) { toast("Valid animal id and weight are required."); return; }
        long id = repository.appendWeight(animalId, kg);
        toast("Weight log appended offline. id=" + id + ", sync_status=pending");
        renderHome();
    }

    private void appendHealth() {
        Long animalId = parseLong(text(animalIdInput));
        String symptoms = text(symptomsInput);
        if (animalId == null || symptoms.isEmpty()) { toast("Valid animal id and symptoms are required."); return; }
        long id = repository.appendHealth(animalId, symptoms, text(diagnosisInput), text(treatmentInput));
        toast("Health record appended offline. id=" + id + ", sync_status=pending");
        renderHome();
    }

    private void renderAnimalList() {
        List<Animal> animals = repository.getAnimals();
        if (animals.isEmpty()) { subtitle("No animals saved yet. Create one above in airplane mode to test offline persistence."); return; }
        for (Animal animal : animals) {
            TextView card = new TextView(this);
            card.setText("#" + animal.id + "  " + animal.type + "  TAG: " + animal.identificationTag +
                    "\nStatus: " + animal.status + " | Created: " + animal.createdAt +
                    "\ncloud_id: " + safe(animal.cloudId) + " | farm_cloud_id: " + safe(animal.farmCloudId) +
                    "\nsync_status: " + animal.syncStatus);
            card.setTextSize(18);
            card.setTypeface(Typeface.DEFAULT_BOLD);
            card.setTextColor(Color.rgb(16,24,32));
            card.setPadding(dp(14), dp(14), dp(14), dp(14));
            LinearLayout.LayoutParams cp = new LinearLayout.LayoutParams(-1, -2);
            cp.setMargins(0, dp(8), 0, dp(8));
            card.setBackgroundColor(Color.WHITE);
            root.addView(card, cp);

            LinearLayout row = new LinearLayout(this);
            row.setOrientation(LinearLayout.HORIZONTAL);
            row.setGravity(Gravity.CENTER);
            Button active = smallButton("Set Active");
            active.setOnClickListener(v -> { repository.updateStatus(animal.id, "active"); renderHome(); });
            Button inactive = smallButton("Set Inactive");
            inactive.setOnClickListener(v -> { repository.updateStatus(animal.id, "inactive"); renderHome(); });
            Button delete = smallButton("Delete");
            delete.setOnClickListener(v -> { repository.deleteAnimal(animal.id); renderHome(); });
            row.addView(active); row.addView(inactive); row.addView(delete);
            root.addView(row);

            List<WeightLog> weights = repository.getWeightLogs(animal.id);
            for (WeightLog w : weights) subtitle("   ⚖️ " + w.weightKg + " kg | " + w.logDate);
            List<HealthRecord> records = repository.getHealthRecords(animal.id);
            for (HealthRecord h : records) subtitle("   🩺 " + h.symptomsDescription + " | " + h.recordedAt);
        }
    }

    private void title(String text, int size) {
        TextView view = new TextView(this);
        view.setText(text);
        view.setTextSize(size);
        view.setTypeface(Typeface.DEFAULT_BOLD);
        view.setTextColor(Color.rgb(20,90,50));
        view.setGravity(Gravity.CENTER);
        view.setPadding(0, dp(10), 0, dp(6));
        root.addView(view, new LinearLayout.LayoutParams(-1, -2));
    }
    private void subtitle(String text) {
        TextView view = new TextView(this);
        view.setText(text);
        view.setTextSize(16);
        view.setTextColor(Color.rgb(16,24,32));
        view.setPadding(0, dp(6), 0, dp(6));
        root.addView(view, new LinearLayout.LayoutParams(-1, -2));
    }
    private void section(String text) { title(text, 21); }

    private EditText input(String hint, int inputType) {
        EditText e = new EditText(this);
        e.setHint(hint);
        e.setTextSize(18);
        e.setTypeface(Typeface.DEFAULT_BOLD);
        e.setSingleLine(false);
        e.setMinHeight(dp(56));
        e.setInputType(inputType);
        e.setBackgroundResource(R.drawable.input_bg);
        e.setPadding(dp(14), dp(10), dp(14), dp(10));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2);
        lp.setMargins(0, dp(8), 0, dp(8));
        root.addView(e, lp);
        return e;
    }

    private void actionButton(String text, View.OnClickListener listener) {
        Button b = new Button(this);
        b.setText(text);
        b.setTextSize(18);
        b.setTypeface(Typeface.DEFAULT_BOLD);
        b.setTextColor(Color.WHITE);
        b.setMinHeight(dp(64));
        b.setAllCaps(false);
        b.setBackgroundResource(R.drawable.module_button_bg);
        b.setOnClickListener(listener);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2);
        lp.setMargins(0, dp(10), 0, dp(10));
        root.addView(b, lp);
    }
    private Button smallButton(String text) {
        Button b = new Button(this);
        b.setText(text);
        b.setTextSize(14);
        b.setMinHeight(dp(48));
        b.setAllCaps(false);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, -2, 1);
        lp.setMargins(dp(3), dp(4), dp(3), dp(4));
        b.setLayoutParams(lp);
        return b;
    }
    private String text(EditText e) { return e.getText().toString().trim(); }
    private String safe(String s) { return s == null ? "local-only" : s; }
    private Long parseLong(String s) { try { return Long.parseLong(s); } catch (Exception e) { return null; } }
    private Double parseDouble(String s) { try { return Double.parseDouble(s); } catch (Exception e) { return null; } }
    private int dp(int value) { return (int) (value * getResources().getDisplayMetrics().density); }
    private void toast(String msg) { Toast.makeText(this, msg, Toast.LENGTH_LONG).show(); }
}
