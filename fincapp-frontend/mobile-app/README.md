# FincApp Mobile - Backend Connected

Android native mobile app in Java connected to the deployed FincApp backend:

```text
http://167.233.35.176/api/
```

## Main flow

Splash → Login → Farm selection → Home → Cattle/Swine/Poultry forms → AURA → Background sync.

## What it does

- Validates login against `POST /api/v1/auth/login`.
- Loads farms from `GET /api/v1/farms` and caches them locally in SQLite.
- Registers animals offline in SQLite.
- Adds weight logs and health records offline.
- Sends pending records to `POST /api/v1/farms/{farmId}/sync` using Retrofit.
- Sends the required `X-Farm-Id` header.
- Uses WorkManager with network constraints and exponential backoff.
- Connects AURA to `POST /api/aura/tool-agent`.
- Keeps API keys out of Android. The app only talks to the backend.

## Important

If you already installed an older FincApp APK on the same phone, uninstall it before testing this version. This avoids old SQLite schemas from previous builds.

## How to open

Open exactly this folder in Android Studio:

```text
fincapp-frontend/mobile-app
```

Do not open only the `app` folder.

## Backend URL

Default URL is configured in:

```text
app/src/main/java/com/irwi/fincapp/network/ApiConfig.java
```

```java
public static final String DEFAULT_BASE_URL = "http://167.233.35.176/api/";
```

There is also a Settings screen inside the app to change it for testing.
