package com.irwi.fincapp.models;

public class Animal {
    public long id;
    public String cloudId;
    public String farmCloudId;
    public String type;
    public String identificationTag;
    public String birthDate;
    public String status;
    public String createdAt;
    public String syncStatus;

    public Animal(long id, String cloudId, String farmCloudId, String type, String identificationTag,
                  String birthDate, String status, String createdAt, String syncStatus) {
        this.id = id;
        this.cloudId = cloudId;
        this.farmCloudId = farmCloudId;
        this.type = type;
        this.identificationTag = identificationTag;
        this.birthDate = birthDate;
        this.status = status;
        this.createdAt = createdAt;
        this.syncStatus = syncStatus;
    }
}
