package com.irwi.fincapp.ui;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.os.Bundle;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import com.irwi.fincapp.network.ApiClient;
import com.irwi.fincapp.repository.FarmRepository;
import com.irwi.fincapp.session.SessionManager;
import java.util.List;
import java.util.Map;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class FarmActivity extends Activity {
    private LinearLayout farmList;
    private TextView status;
    private FarmRepository repository;
    private SessionManager session;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        repository = new FarmRepository(this);
        session = new SessionManager(this);

        LinearLayout layout = BaseUi.root(this);
        layout.addView(BaseUi.title(this, "Select farm"));
        layout.addView(BaseUi.subtitle(this, "Choose the farm that will receive offline records and synchronization."));

        Button refresh = BaseUi.button(this, "Load farms from backend");
        Button settings = BaseUi.secondaryButton(this, "Settings / logout");
        status = BaseUi.text(this, "User: " + session.email(), 16);
        farmList = new LinearLayout(this);
        farmList.setOrientation(LinearLayout.VERTICAL);

        layout.addView(refresh);
        layout.addView(settings);
        layout.addView(status);
        layout.addView(BaseUi.divider(this));
        layout.addView(farmList);

        refresh.setOnClickListener(v -> loadRemoteFarms());
        settings.setOnClickListener(v -> startActivity(new Intent(this, SettingsActivity.class)));

        renderLocalFarms();
        loadRemoteFarms();
    }

    private void loadRemoteFarms() {
        status.setText("Loading farms from backend...");
        ApiClient.service(session.baseUrl()).farms().enqueue(new Callback<List<Map<String, Object>>>() {
            @Override
            public void onResponse(Call<List<Map<String, Object>>> call, Response<List<Map<String, Object>>> response) {
                if (!response.isSuccessful() || response.body() == null) {
                    status.setText("Could not load farms. HTTP " + response.code() + ". Showing local cache.");
                    renderLocalFarms();
                    return;
                }

                int saved = 0;
                for (Map<String, Object> farm : response.body()) {
                    String id = value(farm.get("id"));
                    String ownerId = value(farm.get("ownerId"));
                    String name = value(farm.get("name"));
                    String location = value(farm.get("location"));
                    String createdAt = value(farm.get("createdAt"));
                    if (!id.isEmpty() && !name.isEmpty()) {
                        repository.saveFarm(id, ownerId, name, location, createdAt);
                        saved++;
                    }
                }
                status.setText("Farms loaded: " + saved + ". Select one to continue.");
                renderLocalFarms();
            }

            @Override
            public void onFailure(Call<List<Map<String, Object>>> call, Throwable t) {
                status.setText("Offline or backend unavailable. Showing local farms. " + t.getMessage());
                renderLocalFarms();
            }
        });
    }

    private void renderLocalFarms() {
        farmList.removeAllViews();
        Cursor cursor = repository.localFarms();
        int count = 0;
        try {
            while (cursor.moveToNext()) {
                count++;
                String id = cursor.getString(0);
                String name = cursor.getString(1);
                String location = cursor.getString(2);
                Button button = BaseUi.secondaryButton(this, "🏡 " + name + "\n" + location);
                farmList.addView(button);
                button.setOnClickListener(v -> {
                    session.saveFarm(id, name);
                    startActivity(new Intent(this, HomeActivity.class));
                    finish();
                });
            }
        } finally {
            cursor.close();
        }
        if (count == 0) {
            farmList.addView(BaseUi.text(this, "No farms found. Ask the backend/admin team to create a farm for your user, then press Load farms from backend.", 17));
        }
    }

    private String value(Object object) {
        return object == null ? "" : String.valueOf(object);
    }
}
