# FincApp Mobile - US-02 Complete Base

Android Java + SQLite implementation for:

**US-02-JUAN CARLOS | Offline Local CRUD Persistence & High-Accessibility Asset Management Layout**

## What this delivers

- Java / Android SDK project.
- SQLite local persistence using `SQLiteOpenHelper`.
- MVC-style separation: `ui`, `repository`, `database`, `models`.
- High-accessibility mobile layout:
  - high contrast,
  - heavy typography,
  - large inputs and buttons,
  - touch targets >= 48dp.
- Offline CRUD for livestock assets:
  - create animal,
  - list/read local animals,
  - update animal status,
  - delete local animal.
- Offline historical appending:
  - append weight logs,
  - append health symptom records.
- Local timestamps using device locale.
- `sync_queue` entries generated for future cloud sync.
- `sync_status = 'pending'` stored for offline-created records.

## SQLite tables aligned with US-09 contract

This project uses the table/column names shared by the US-09 SQLite ↔ Cloud contract:

### animals

`id, cloud_id, farm_cloud_id, type, identification_tag, birth_date, status, created_at`

Additional local sync column for US-02:

`sync_status`

### weight_logs

`id, cloud_id, animal_id, animal_cloud_id, weight_kg, log_date`

Additional local sync column for US-02:

`sync_status`

### health_records

`id, cloud_id, animal_id, animal_cloud_id, symptoms_description, diagnosis, treatment_administered, recorded_at`

Additional local sync column for US-02:

`sync_status`

### sync_queue

Tracks pending local changes for future cloud synchronization.

## Acceptance Criteria mapping

### Successful Offline Asset Persistence

The app initializes SQLite on first boot. New animals are inserted directly into the local `animals` table, receive a local auto-increment `id`, and are marked `sync_status = 'pending'`.

### High-Accessibility UI Form Validation

The UI uses large buttons, bold text, high contrast colors, and big form controls. Required fields are validated before saving.

### Historical Log Appending to Local Time-Series

Existing animals can receive weight logs and health records. New rows are appended to `weight_logs` and `health_records` with localized timestamps.

## How to run

Open this folder in Android Studio:

`fincapp-frontend/mobile-app`

Then run the `app` configuration on an emulator or physical Android device.

## Git notes

Do not commit generated files:

- `.gradle/`
- `.idea/`
- `local.properties`
- `build/`
- `app/build/`
