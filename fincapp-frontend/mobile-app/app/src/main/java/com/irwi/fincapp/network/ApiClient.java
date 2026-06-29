package com.irwi.fincapp.network;

import android.content.Context;

import com.irwi.fincapp.storage.SessionManager;

import java.util.concurrent.TimeUnit;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import retrofit2.Retrofit;
import retrofit2.converter.gson.GsonConverterFactory;

public class ApiClient {
    private final FincAppApiService service;

    public ApiClient(Context context) {
        SessionManager session = new SessionManager(context);
        OkHttpClient client = new OkHttpClient.Builder()
                .connectTimeout(20, TimeUnit.SECONDS)
                .readTimeout(30, TimeUnit.SECONDS)
                .writeTimeout(30, TimeUnit.SECONDS)
                .addInterceptor(chain -> {
                    Request original = chain.request();
                    Request.Builder builder = original.newBuilder()
                            .header("Accept", "application/json")
                            .header("Content-Type", "application/json");
                    String token = session.getToken();
                    if (token != null && !token.isEmpty()) {
                        builder.header("Authorization", "Bearer " + token);
                    }
                    String farmId = session.getFarmId();
                    if (farmId != null && !farmId.isEmpty()) {
                        builder.header("X-Farm-Id", farmId);
                    }
                    return chain.proceed(builder.build());
                })
                .build();

        Retrofit retrofit = new Retrofit.Builder()
                .baseUrl(session.getBaseUrl())
                .client(client)
                .addConverterFactory(GsonConverterFactory.create())
                .build();
        service = retrofit.create(FincAppApiService.class);
    }

    public FincAppApiService service() { return service; }
}
