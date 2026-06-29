package com.irwi.fincapp.repository;

import android.content.Context;

import com.irwi.fincapp.database.DatabaseHelper;
import com.irwi.fincapp.network.ApiClient;
import com.irwi.fincapp.network.dto.*;
import com.irwi.fincapp.storage.SessionManager;

import java.io.IOException;
import java.util.List;

import retrofit2.Response;

public class RemoteRepository {
    private final Context context;
    private final SessionManager session;
    private final DatabaseHelper db;

    public RemoteRepository(Context context) {
        this.context = context.getApplicationContext();
        this.session = new SessionManager(this.context);
        this.db = new DatabaseHelper(this.context);
    }

    public LoginResponse login(String email, String password) throws IOException {
        Response<LoginResponse> response = new ApiClient(context).service().login(new LoginRequest(email, password)).execute();
        if (!response.isSuccessful() || response.body() == null) throw new IOException("Login failed: HTTP " + response.code());
        LoginResponse body = response.body();
        session.saveLogin(body.token, body.resolvedUserId(), body.resolvedEmail());
        return body;
    }

    public List<FarmDto> fetchFarms() throws IOException {
        Response<List<FarmDto>> response = new ApiClient(context).service().getFarms().execute();
        if (!response.isSuccessful() || response.body() == null) throw new IOException("Farms failed: HTTP " + response.code());
        for (FarmDto farm : response.body()) db.upsertFarm(farm.id, farm.name, farm.location);
        return response.body();
    }

    public AuraResponse askAura(String text) throws IOException {
        String farmId = session.getFarmId();
        Response<AuraResponse> response = new ApiClient(context).service().askAura(new AuraRequest(text, session.getDeviceUuid(), farmId)).execute();
        if (!response.isSuccessful() || response.body() == null) throw new IOException("AURA failed: HTTP " + response.code());
        return response.body();
    }
}
