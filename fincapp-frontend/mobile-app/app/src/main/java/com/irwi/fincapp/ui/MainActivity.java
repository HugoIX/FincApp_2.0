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
import com.irwi.fincapp.network.dto.AuraResponse;
import com.irwi.fincapp.network.dto.FarmDto;
import com.irwi.fincapp.network.dto.LoginResponse;
import com.irwi.fincapp.repository.AssetRepository;
import com.irwi.fincapp.repository.RemoteRepository;
import com.irwi.fincapp.repository.SyncRepository;
import com.irwi.fincapp.storage.SessionManager;
import com.irwi.fincapp.sync.SyncScheduler;

import java.util.List;

public class MainActivity extends Activity {
    private LinearLayout root;
    private AssetRepository repository;
    private RemoteRepository remoteRepository;
    private SyncRepository syncRepository;
    private SessionManager session;

    private EditText baseUrlInput, emailInput, passwordInput, farmIdInput, auraInput;
    private EditText typeInput, tagInput, birthDateInput, statusInput, animalIdInput, weightInput, symptomsInput, diagnosisInput, treatmentInput;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        repository = new AssetRepository(this);
        remoteRepository = new RemoteRepository(this);
        syncRepository = new SyncRepository(this);
        session = new SessionManager(this);
        SyncScheduler.schedulePeriodicSync(this);
        SyncScheduler.scheduleOneTimeSync(this);
        SyncScheduler.registerConnectivityCallback(this);
        root = findViewById(R.id.rootContainer);
        renderHome();
    }

    private void renderHome() {
        root.removeAllViews();
        title("FincApp Mobile", 28);
        subtitle("Native Android client connected to the same .NET backend used by the web app.");
        subtitle("Backend: " + session.getBaseUrl());
        subtitle("User: " + empty(session.getUserEmail(), "not logged in") + " | Farm: " + empty(session.getFarmName(), empty(session.getFarmId(), "not selected")));
        subtitle("Pending local sync rows: " + repository.pendingSyncCount() + " | WorkManager auto-sync enabled");

        section("1. Backend connection and login");
        baseUrlInput = input("Backend base URL. Emulator: http://10.0.2.2:5211/api/ | Phone: http://YOUR_PC_IP:5211/api/", InputType.TYPE_CLASS_TEXT);
        baseUrlInput.setText(session.getBaseUrl());
        actionButton("Save backend URL", v -> { session.setBaseUrl(text(baseUrlInput)); toast("Backend URL saved"); renderHome(); });

        emailInput = input("Email", InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS);
        passwordInput = input("Password", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        actionButton("Login with backend", v -> login());
        actionButton("Load farms from backend", v -> loadFarms());
        farmIdInput = input("Selected Farm GUID", InputType.TYPE_CLASS_TEXT);
        farmIdInput.setText(session.getFarmId());
        actionButton("Save selected farm id", v -> { session.saveFarm(text(farmIdInput), text(farmIdInput)); toast("Farm saved"); renderHome(); });

        section("2. Offline livestock asset management");
        typeInput = input("Animal type: Cattle / Swine / Poultry", InputType.TYPE_CLASS_TEXT);
        tagInput = input("Identification tag", InputType.TYPE_CLASS_TEXT);
        birthDateInput = input("Birth date YYYY-MM-DD optional", InputType.TYPE_CLASS_TEXT);
        statusInput = input("Status", InputType.TYPE_CLASS_TEXT);
        statusInput.setText("healthy");
        actionButton("Save animal offline", v -> saveAnimal());

        section("3. Historical logs for selected animal");
        animalIdInput = input("Local animal id", InputType.TYPE_CLASS_NUMBER);
        weightInput = input("Weight kg", InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_FLAG_DECIMAL);
        actionButton("Append weight log offline", v -> appendWeight());
        symptomsInput = input("Health symptoms description", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE);
        diagnosisInput = input("Diagnosis optional", InputType.TYPE_CLASS_TEXT);
        treatmentInput = input("Treatment administered optional", InputType.TYPE_CLASS_TEXT);
        actionButton("Append health record offline", v -> appendHealth());

        section("4. Sync and AURA");
        actionButton("Run sync now", v -> runManualSync());
        auraInput = input("Ask AURA using backend endpoint", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE);
        actionButton("Ask AURA", v -> askAura());

        section("5. Local animal list");
        actionButton("Refresh local list", v -> renderHome());
        renderAnimalList();
    }

    private void login() {
        String email = text(emailInput);
        String password = text(passwordInput);
        if (email.isEmpty() || password.isEmpty()) { toast("Email and password are required"); return; }
        runInBackground("Logging in...", () -> {
            LoginResponse response = remoteRepository.login(email, password);
            runOnUiThread(() -> { toast("Login OK: " + response.resolvedEmail()); renderHome(); });
        });
    }

    private void loadFarms() {
        runInBackground("Loading farms...", () -> {
            List<FarmDto> farms = remoteRepository.fetchFarms();
            runOnUiThread(() -> {
                if (farms.isEmpty()) { toast("No farms returned by backend"); return; }
                FarmDto first = farms.get(0);
                session.saveFarm(first.id, first.name);
                toast("Farm selected: " + first.name);
                renderHome();
            });
        });
    }

    private void askAura() {
        String prompt = text(auraInput);
        if (prompt.isEmpty()) { toast("Write a question for AURA"); return; }
        runInBackground("Asking AURA...", () -> {
            AuraResponse response = remoteRepository.askAura(prompt);
            runOnUiThread(() -> showMessage("AURA", response.message()));
        });
    }

    private void runManualSync() {
        runInBackground("Syncing...", () -> {
            boolean ok = syncRepository.dispatchPendingRows();
            runOnUiThread(() -> { toast(ok ? "Sync finished. Check Logcat: FincAppSync" : "Sync failed. WorkManager will retry."); renderHome(); });
        });
    }

    private void saveAnimal() {
        String type = text(typeInput);
        String tag = text(tagInput);
        String status = text(statusInput).isEmpty() ? "healthy" : text(statusInput);
        if (type.isEmpty() || tag.isEmpty()) { toast("Type and identification tag are required."); return; }
        String farmId = session.getFarmId().isEmpty() ? text(farmIdInput) : session.getFarmId();
        long id = repository.createAnimal(farmId, type, tag, text(birthDateInput), status);
        toast("Animal saved offline. local id=" + id + ", sync_status=pending");
        SyncScheduler.scheduleOneTimeSync(this);
        renderHome();
    }

    private void appendWeight() {
        Long animalId = parseLong(text(animalIdInput));
        Double kg = parseDouble(text(weightInput));
        if (animalId == null || kg == null || kg <= 0) { toast("Valid animal id and weight are required."); return; }
        try {
            long id = repository.appendWeight(animalId, kg);
            toast("Weight log appended offline. id=" + id + ", sync_status=pending");
            SyncScheduler.scheduleOneTimeSync(this);
            renderHome();
        } catch (Exception e) { toast(e.getMessage()); }
    }

    private void appendHealth() {
        Long animalId = parseLong(text(animalIdInput));
        String symptoms = text(symptomsInput);
        if (animalId == null || symptoms.isEmpty()) { toast("Valid animal id and symptoms are required."); return; }
        try {
            long id = repository.appendHealth(animalId, symptoms, text(diagnosisInput), text(treatmentInput));
            toast("Health record appended offline. id=" + id + ", sync_status=pending");
            SyncScheduler.scheduleOneTimeSync(this);
            renderHome();
        } catch (Exception e) { toast(e.getMessage()); }
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
            Button healthy = smallButton("Healthy");
            healthy.setOnClickListener(v -> { repository.updateStatus(animal.id, "healthy"); renderHome(); });
            Button inactive = smallButton("Inactive");
            inactive.setOnClickListener(v -> { repository.updateStatus(animal.id, "inactive"); renderHome(); });
            Button delete = smallButton("Delete");
            delete.setOnClickListener(v -> { repository.deleteAnimal(animal.id); renderHome(); });
            row.addView(healthy); row.addView(inactive); row.addView(delete);
            root.addView(row);

            for (WeightLog w : repository.getWeightLogs(animal.id)) subtitle("   Weight: " + w.weightKg + " kg | " + w.logDate + " | " + w.syncStatus);
            for (HealthRecord h : repository.getHealthRecords(animal.id)) subtitle("   Health: " + h.symptomsDescription + " | " + h.recordedAt + " | " + h.syncStatus);
        }
    }

    private interface ThrowingRunnable { void run() throws Exception; }
    private void runInBackground(String loading, ThrowingRunnable task) {
        toast(loading);
        new Thread(() -> {
            try { task.run(); }
            catch (Exception e) { runOnUiThread(() -> showMessage("Operation failed", e.getMessage() == null ? e.toString() : e.getMessage())); }
        }).start();
    }

    private void showMessage(String title, String message) {
        new android.app.AlertDialog.Builder(this).setTitle(title).setMessage(message).setPositiveButton("OK", null).show();
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
    private String safe(String s) { return s == null || s.isEmpty() ? "local-only" : s; }
    private String empty(String s, String fallback) { return s == null || s.isEmpty() ? fallback : s; }
    private Long parseLong(String s) { try { return Long.parseLong(s); } catch (Exception e) { return null; } }
    private Double parseDouble(String s) { try { return Double.parseDouble(s); } catch (Exception e) { return null; } }
    private int dp(int value) { return (int) (value * getResources().getDisplayMetrics().density); }
    private void toast(String msg) { Toast.makeText(this, msg, Toast.LENGTH_LONG).show(); }
}
