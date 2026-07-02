package com.irwi.fincapp.session;

import android.content.Context;
import android.content.SharedPreferences;
import com.irwi.fincapp.network.ApiConfig;

public class SessionManager {
    private final SharedPreferences preferences;

    public SessionManager(Context context) {
        preferences = context.getSharedPreferences("fincapp_session", Context.MODE_PRIVATE);
    }

    public boolean isLogged() {
        return preferences.getBoolean("logged", false) && !userId().isEmpty();
    }

    public void saveLogin(String userId, String email, String role, String token) {
        preferences.edit()
                .putBoolean("logged", true)
                .putString("user_id", safe(userId))
                .putString("email", safe(email))
                .putString("role", safe(role))
                .putString("token", safe(token))
                .apply();
    }

    public void saveFarm(String farmId, String farmName) {
        preferences.edit()
                .putString("farm_id", safe(farmId))
                .putString("farm_name", safe(farmName))
                .apply();
    }

    public void setBaseUrl(String url) {
        preferences.edit().putString("base_url", safe(url)).apply();
    }

    public String baseUrl() {
        return preferences.getString("base_url", ApiConfig.DEFAULT_BASE_URL);
    }

    public String userId() { return preferences.getString("user_id", ""); }
    public String email() { return preferences.getString("email", ""); }
    public String role() { return preferences.getString("role", "worker"); }
    public String token() { return preferences.getString("token", ""); }
    public String farmId() { return preferences.getString("farm_id", ""); }
    public String farmName() { return preferences.getString("farm_name", "No farm selected"); }

    public void logout() {
        String currentBaseUrl = baseUrl();
        preferences.edit().clear().putString("base_url", currentBaseUrl).apply();
    }

    private String safe(String value) { return value == null ? "" : value; }
}
