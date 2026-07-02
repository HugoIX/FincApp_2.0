package com.irwi.fincapp.ui;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import com.irwi.fincapp.repository.AnimalRepository;
import com.irwi.fincapp.session.SessionManager;
import com.irwi.fincapp.sync.SyncScheduler;

public class HomeActivity extends Activity {
    private TextView pendingStatus;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        SessionManager session = new SessionManager(this);
        LinearLayout layout = BaseUi.root(this);

        layout.addView(BaseUi.title(this, "FincApp Mobile"));
        layout.addView(BaseUi.subtitle(this, "Active farm: " + session.farmName()));
        pendingStatus = BaseUi.text(this, "Pending sync: " + new AnimalRepository(this).pendingCount(), 18);
        layout.addView(pendingStatus);

        Button cattle = BaseUi.button(this, "🐄 Cattle module");
        Button swine = BaseUi.button(this, "🐖 Swine module");
        Button poultry = BaseUi.button(this, "🐔 Poultry module");
        Button aura = BaseUi.secondaryButton(this, "✨ AURA assistant");
        Button sync = BaseUi.secondaryButton(this, "Sync now");
        Button farms = BaseUi.secondaryButton(this, "Change farm");

        layout.addView(cattle);
        layout.addView(swine);
        layout.addView(poultry);
        layout.addView(aura);
        layout.addView(sync);
        layout.addView(farms);

        cattle.setOnClickListener(v -> openModule("Cattle"));
        swine.setOnClickListener(v -> openModule("Swine"));
        poultry.setOnClickListener(v -> openModule("Poultry"));
        aura.setOnClickListener(v -> startActivity(new Intent(this, AuraActivity.class)));
        sync.setOnClickListener(v -> {
            SyncScheduler.schedule(this);
            BaseUi.toast(this, "Synchronization scheduled. Check Logcat tag FincAppSync.");
        });
        farms.setOnClickListener(v -> startActivity(new Intent(this, FarmActivity.class)));
    }

    private void openModule(String type) {
        Intent intent = new Intent(this, AnimalActivity.class);
        intent.putExtra("type", type);
        startActivity(intent);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (pendingStatus != null) {
            pendingStatus.setText("Pending sync: " + new AnimalRepository(this).pendingCount());
        }
    }
}
