package com.irwi.fincapp.network.dto;

import com.google.gson.annotations.SerializedName;

public class LoginResponse {
    public String id;
    public String email;
    public String role;
    public String token;
    public UserDto user;

    public String resolvedUserId() { return user != null && user.id != null ? user.id : id; }
    public String resolvedEmail() { return user != null && user.email != null ? user.email : email; }

    public static class UserDto {
        public String id;
        public String email;
        @SerializedName("full_name") public String fullName;
        public String role;
        @SerializedName("farm_name") public String farmName;
    }
}
