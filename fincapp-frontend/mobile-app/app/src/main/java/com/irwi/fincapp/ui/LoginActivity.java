package com.irwi.fincapp.ui;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.text.InputType;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import com.irwi.fincapp.network.ApiClient;
import com.irwi.fincapp.session.SessionManager;
import java.util.HashMap;
import java.util.Map;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class LoginActivity extends Activity {
    private TextView status;
    private Button actionBtn;
    private Button toggleBtn;
    private EditText nameInput;
    private EditText emailInput;
    private EditText passwordInput;
    private boolean isRegisterMode = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        SessionManager session = new SessionManager(this);
        
        if (session.isLogged()) {
            startActivity(new Intent(this, FarmActivity.class));
            finish();
            return;
        }

        LinearLayout layout = BaseUi.root(this);

        layout.addView(BaseUi.title(this, "FincApp"));
        layout.addView(BaseUi.subtitle(this, "Connect to your farm management backend."));

        nameInput = BaseUi.input(this, "Full Name");
        nameInput.setVisibility(View.GONE);
        
        emailInput = BaseUi.input(this, "Email");
        passwordInput = BaseUi.input(this, "Password");
        passwordInput.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        
        actionBtn = BaseUi.button(this, "Sign in");
        toggleBtn = BaseUi.secondaryButton(this, "New user? Create account");
        Button settingsBtn = BaseUi.secondaryButton(this, "Backend settings");
        status = BaseUi.text(this, "Backend: " + session.baseUrl(), 14);

        layout.addView(nameInput);
        layout.addView(emailInput);
        layout.addView(passwordInput);
        layout.addView(actionBtn);
        layout.addView(toggleBtn);
        layout.addView(BaseUi.divider(this));
        layout.addView(settingsBtn);
        layout.addView(status);

        actionBtn.setOnClickListener(v -> {
            if (isRegisterMode) attemptRegister();
            else attemptLogin();
        });

        toggleBtn.setOnClickListener(v -> toggleMode());
        settingsBtn.setOnClickListener(v -> startActivity(new Intent(this, SettingsActivity.class)));
    }

    private void toggleMode() {
        isRegisterMode = !isRegisterMode;
        if (isRegisterMode) {
            nameInput.setVisibility(View.VISIBLE);
            actionBtn.setText("Create account");
            toggleBtn.setText("Already have an account? Sign in");
        } else {
            nameInput.setVisibility(View.GONE);
            actionBtn.setText("Sign in");
            toggleBtn.setText("New user? Create account");
        }
    }

    private boolean validateInputs() {
        String email = emailInput.getText().toString().trim();
        String password = passwordInput.getText().toString();

        if (isRegisterMode && nameInput.getText().toString().trim().isEmpty()) {
            BaseUi.toast(this, "Please enter your name.");
            return false;
        }

        if (email.isEmpty() || !android.util.Patterns.EMAIL_ADDRESS.matcher(email).matches()) {
            BaseUi.toast(this, "Please enter a valid email address.");
            return false;
        }

        if (password.length() < 6) {
            BaseUi.toast(this, "Password must be at least 6 characters.");
            return false;
        }

        return true;
    }

    private void attemptLogin() {
        if (!validateInputs()) return;

        String email = emailInput.getText().toString().trim();
        String password = passwordInput.getText().toString();

        actionBtn.setEnabled(false);
        status.setText("Connecting to backend...");

        Map<String, String> body = new HashMap<>();
        body.put("email", email);
        body.put("password", password);

        SessionManager session = new SessionManager(this);
        ApiClient.service(session.baseUrl()).login(body).enqueue(new Callback<Map<String, Object>>() {
            @Override
            public void onResponse(Call<Map<String, Object>> call, Response<Map<String, Object>> response) {
                actionBtn.setEnabled(true);
                if (response.isSuccessful() && response.body() != null) {
                    Map<String, Object> map = response.body();
                    session.saveLogin(
                        value(map.get("id")),
                        email,
                        value(map.get("role")),
                        value(map.get("token"))
                    );
                    BaseUi.toast(LoginActivity.this, "Welcome back!");
                    startActivity(new Intent(LoginActivity.this, FarmActivity.class));
                    finish();
                } else {
                    status.setText("Login failed: " + response.code() + ". Check credentials.");
                }
            }

            @Override
            public void onFailure(Call<Map<String, Object>> call, Throwable t) {
                actionBtn.setEnabled(true);
                status.setText("Connection error: " + t.getMessage());
            }
        });
    }

    private void attemptRegister() {
        if (!validateInputs()) return;

        String name = nameInput.getText().toString().trim();
        String email = emailInput.getText().toString().trim();
        String password = passwordInput.getText().toString();

        actionBtn.setEnabled(false);
        status.setText("Registering account...");

        Map<String, String> body = new HashMap<>();
        body.put("name", name);
        body.put("email", email);
        body.put("password", password);

        SessionManager session = new SessionManager(this);
        ApiClient.service(session.baseUrl()).register(body).enqueue(new Callback<Map<String, Object>>() {
            @Override
            public void onResponse(Call<Map<String, Object>> call, Response<Map<String, Object>> response) {
                actionBtn.setEnabled(true);
                if (response.isSuccessful()) {
                    BaseUi.toast(LoginActivity.this, "Account created! You can now sign in.");
                    toggleMode(); // Switch to login mode
                } else {
                    status.setText("Registration failed: " + response.code());
                }
            }

            @Override
            public void onFailure(Call<Map<String, Object>> call, Throwable t) {
                actionBtn.setEnabled(true);
                status.setText("Connection error: " + t.getMessage());
            }
        });
    }

    private String value(Object object) {
        return object == null ? "" : String.valueOf(object);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (status != null) status.setText("Backend: " + new SessionManager(this).baseUrl());
    }
}
