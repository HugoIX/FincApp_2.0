package com.irwi.fincapp.config;

public final class ApiConfig {
    private ApiConfig() {}

    // Android emulator -> local backend on your PC.
    public static final String EMULATOR_BASE_URL = "http://10.0.2.2:5211/api/";

    // Physical phone -> replace with your PC IPv4 when backend runs locally.
    public static final String PHONE_LOCAL_TEMPLATE = "http://192.168.1.15:5211/api/";

    // VPS / production -> replace when backend is deployed.
    public static final String PRODUCTION_TEMPLATE = "https://your-vps-or-domain.com/api/";

    public static final String DEFAULT_BASE_URL = EMULATOR_BASE_URL;
}
