package com.irwi.fincapp.network;
import retrofit2.Retrofit;import retrofit2.converter.gson.GsonConverterFactory;
public class ApiClient{ public static ApiService service(String baseUrl){ if(!baseUrl.endsWith("/")) baseUrl+="/"; return new Retrofit.Builder().baseUrl(baseUrl).addConverterFactory(GsonConverterFactory.create()).build().create(ApiService.class);} }
