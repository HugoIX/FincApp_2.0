package com.irwi.fincapp.ui;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.widget.LinearLayout;
import com.irwi.fincapp.database.DatabaseHelper;
import com.irwi.fincapp.session.SessionManager;
import com.irwi.fincapp.sync.SyncScheduler;

public class SplashActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        LinearLayout layout = BaseUi.root(this);
        layout.addView(BaseUi.title(this, "🌱 FincApp"));
        layout.addView(BaseUi.subtitle(this, "Mobile offline livestock operations"));
        layout.addView(BaseUi.text(this, "Initializing local SQLite database and secure sync queue...", 18));

        new DatabaseHelper(this).getWritableDatabase();
        SyncScheduler.schedule(this);

        new Handler().postDelayed(() -> {
            Class<?> next = new SessionManager(this).isLogged() ? FarmActivity.class : LoginActivity.class;
            startActivity(new Intent(this, next));
            finish();
        }, 900);
    }
}
