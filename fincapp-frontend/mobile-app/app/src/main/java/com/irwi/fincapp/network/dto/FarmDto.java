package com.irwi.fincapp.network.dto;

import com.google.gson.annotations.SerializedName;

public class FarmDto {
    public String id;
    @SerializedName("ownerId") public String ownerId;
    public String name;
    public String location;
    @SerializedName("createdAt") public String createdAt;

    @Override public String toString() { return name == null ? id : name + " (" + id + ")"; }
}
