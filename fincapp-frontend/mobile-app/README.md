# FincApp Mobile - US-03 Complete

Android Java project for **US-03-JUANCARLOS | Background Sync Orchestration & SQLite Bulk-Queue Dispatcher**.

## Includes

- Java + Android SDK.
- SQLite local persistence inherited from US-02.
- Offline tables aligned with the SQLite ↔ Cloud contract:
  - `animals`
  - `weight_logs`
  - `health_records`
  - `sync_queue`
- `sync_status = 'pending'` when data is created offline.
- `sync_status = 'synced'` after successful background dispatch.
- Jetpack WorkManager in Java.
- WorkManager network constraint: runs only with network connectivity.
- Exponential backoff retry strategy.
- ConnectivityManager network callback.
- Network broadcast receiver as an additional trigger.
- Retrofit 2 interface prepared for the real API.
- Temporary mock API dispatch with Logcat output until Sergio's backend endpoint is available.

## Main packages

```text
com.irwi.fincapp
├── database
│   └── DatabaseHelper.java
├── models
│   ├── Animal.java
│   ├── HealthRecord.java
│   ├── SyncQueueItem.java
│   └── WeightLog.java
├── network
│   ├── ApiClient.java
│   └── SyncApiService.java
├── repository
│   ├── AssetRepository.java
│   └── SyncRepository.java
├── sync
│   ├── NetworkChangeReceiver.java
│   ├── SyncScheduler.java
│   └── SyncWorker.java
└── ui
    └── MainActivity.java
```

## How to test US-03

1. Run the app in Android Studio.
2. Enable Airplane Mode.
3. Create animals, weights, and health records.
4. Disable Airplane Mode or connect to Wi-Fi.
5. Open Logcat and filter by:

```text
FincAppSync
```

Expected logs:

```text
ConnectivityManager detected network availability. Scheduling background sync.
SyncWorker started in background.
Pending queue rows found: X
MOCK API MODE: simulating bulk sync to Sergio's API.
Background sync completed. Rows marked as synced: X
```

## Replacing mock mode with real API

Open:

```text
app/src/main/java/com/irwi/fincapp/network/ApiClient.java
```

Change:

```java
apiClient = new ApiClient(true);
```

or update the constructor usage in `SyncRepository` after the real API is available.

Then replace the placeholder `BASE_URL` and implement the Retrofit payload inside `dispatchPendingRows`.

## Git note

Do not commit generated folders:

```text
.gradle/
build/
app/build/
local.properties
.idea/
```
