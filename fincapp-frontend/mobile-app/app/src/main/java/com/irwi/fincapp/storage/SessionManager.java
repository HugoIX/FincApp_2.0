package com.irwi.fincapp.storage;

import android.content.Context;
import android.content.SharedPreferences;
import android.provider.Settings;

import com.irwi.fincapp.config.ApiConfig;

public class SessionManager {
    private static final String PREFS = "fincapp_session";
    private final SharedPreferences prefs;
    private final Context context;

    public SessionManager(Context context) {
        this.context = context.getApplicationContext();
        this.prefs = this.context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public String getBaseUrl() { return prefs.getString("base_url", ApiConfig.DEFAULT_BASE_URL); }
    public void setBaseUrl(String baseUrl) { prefs.edit().putString("base_url", ensureTrailingSlash(baseUrl)).apply(); }

    public String getToken() { return prefs.getString("token", ""); }
    public String getUserId() { return prefs.getString("user_id", ""); }
    public String getUserEmail() { return prefs.getString("user_email", ""); }
    public String getFarmId() { return prefs.getString("farm_id", ""); }
    public String getFarmName() { return prefs.getString("farm_name", ""); }

    public void saveLogin(String token, String userId, String email) {
        prefs.edit()
                .putString("token", token == null ? "" : token)
                .putString("user_id", userId == null ? "" : userId)
                .putString("user_email", email == null ? "" : email)
                .apply();
    }

    public void saveFarm(String farmId, String farmName) {
        prefs.edit()
                .putString("farm_id", farmId == null ? "" : farmId)
                .putString("farm_name", farmName == null ? "" : farmName)
                .apply();
    }

    public void clear() { prefs.edit().clear().apply(); }

    public boolean hasBackendSession() {
        return !getBaseUrl().isEmpty() && !getUserId().isEmpty() && !getFarmId().isEmpty();
    }

    public String getDeviceUuid() {
        String existing = prefs.getString("device_uuid", "");
        if (existing != null && !existing.isEmpty()) return existing;
        String androidId = Settings.Secure.getString(context.getContentResolver(), Settings.Secure.ANDROID_ID);
        String generated = "android-" + (androidId == null ? java.util.UUID.randomUUID().toString() : androidId);
        prefs.edit().putString("device_uuid", generated).apply();
        return generated;
    }

    private String ensureTrailingSlash(String url) {
        if (url == null || url.trim().isEmpty()) return ApiConfig.DEFAULT_BASE_URL;
        String cleaned = url.trim();
        return cleaned.endsWith("/") ? cleaned : cleaned + "/";
    }
}
