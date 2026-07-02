package com.irwi.fincapp.ui;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import com.irwi.fincapp.network.ApiConfig;
import com.irwi.fincapp.session.SessionManager;

public class SettingsActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        SessionManager session = new SessionManager(this);
        LinearLayout layout = BaseUi.root(this);
        layout.addView(BaseUi.title(this, "Settings"));
        layout.addView(BaseUi.subtitle(this, "Only change this if the backend URL changes."));

        EditText url = BaseUi.input(this, "Backend API URL");
        url.setText(session.baseUrl());
        Button save = BaseUi.button(this, "Save backend URL");
        Button reset = BaseUi.secondaryButton(this, "Reset to VPS URL");
        Button logout = BaseUi.secondaryButton(this, "Logout");

        layout.addView(url);
        layout.addView(save);
        layout.addView(reset);
        layout.addView(logout);

        save.setOnClickListener(v -> {
            session.setBaseUrl(url.getText().toString().trim());
            BaseUi.toast(this, "Backend URL saved.");
            finish();
        });
        reset.setOnClickListener(v -> {
            session.setBaseUrl(ApiConfig.DEFAULT_BASE_URL);
            url.setText(ApiConfig.DEFAULT_BASE_URL);
            BaseUi.toast(this, "VPS backend restored.");
        });
        logout.setOnClickListener(v -> {
            session.logout();
            Intent intent = new Intent(this, LoginActivity.class);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
            startActivity(intent);
        });
    }
}
