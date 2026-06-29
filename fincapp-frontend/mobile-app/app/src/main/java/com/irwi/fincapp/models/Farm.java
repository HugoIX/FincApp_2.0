package com.irwi.fincapp.models;

public class Farm {
    private final long id;
    private final String name;

    public Farm(long id, String name) {
        this.id = id;
        this.name = name;
    }

    public long getId() { return id; }
    public String getName() { return name; }

    @Override
    public String toString() { return name; }
}
