package com.irwi.fincapp.network;

import java.util.List;
import java.util.Map;
import retrofit2.Call;
import retrofit2.http.Body;
import retrofit2.http.GET;
import retrofit2.http.Header;
import retrofit2.http.POST;
import retrofit2.http.Path;

public interface ApiService {
    @POST("v1/auth/login")
    Call<Map<String, Object>> login(@Body Map<String, String> body);

    @POST("v1/auth/register")
    Call<Map<String, Object>> register(@Body Map<String, String> body);

    @GET("v1/farms")
    Call<List<Map<String, Object>>> farms();

    @POST("v1/farms/{farmId}/sync")
    Call<Map<String, Object>> sync(
            @Header("X-Farm-Id") String farmIdHeader,
            @Path("farmId") String farmId,
            @Body Map<String, Object> body
    );

    @POST("aura/tool-agent")
    Call<Map<String, Object>> auraToolAgent(@Body Map<String, String> body);
}
