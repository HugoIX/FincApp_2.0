package com.irwi.fincapp.network;
import java.util.Map;import retrofit2.Call;import retrofit2.http.*;
public interface ApiService{
 @POST("v1/auth/login") Call<Map<String,Object>> login(@Body Map<String,String> body);
 @GET("v1/farms") Call<Object> farms();
 @POST("v1/farms/{farmId}/sync") Call<Object> sync(@Path("farmId") String farmId,@Body Map<String,Object> body);
 @POST("aura/ask") Call<Map<String,Object>> askAura(@Body Map<String,String> body);
}
