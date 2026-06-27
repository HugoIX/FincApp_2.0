# FincApp | SQLite ↔ Cloud Data Contract
**Ticket:** US-09-JOSEMIGUEL  
**Author:** José Miguel  
**Version:** 1.0.0  
**Date:** 2026-06-26  
**Status:** Pending review by Juan Carlos (Android) and Sergio (Backend)

> This document defines the field-by-field mapping between the local Android
> SQLite schema and the cloud PostgreSQL schema hosted on Supabase.
> Its purpose is to guarantee zero data loss during synchronization and to
> serve as the single source of truth for both the Android persistence layer
> and the C# backend sync endpoints.

---

## Important Notes on Local-Only Fields

Local SQLite tables contain fields that exist **only for offline operation**
and must **never be sent** to the cloud sync payload:

| Local Field | Present In | Reason |
|---|---|---|
| `id` | all tables | Auto-increment integer, has no meaning in the cloud |
| `animal_id` | `weight_logs`, `health_records` | Local integer reference only |

These fields must be excluded or translated before the payload reaches
Sergio's sync endpoint.

---

## 1. animals → animals

**Sub-task 1 — Completed by José Miguel**

| Local SQLite Column | Cloud PostgreSQL Column | Type (local) | Type (cloud) | Sync Rule |
|---|---|---|---|---|
| `id` | — | INTEGER | — | Excluded from payload. Local reference only. |
| `cloud_id` | `id` | TEXT | UUID | Sent as `id`. NULL on first sync — backend assigns and returns UUID. |
| `farm_cloud_id` | `farm_id` | TEXT | UUID | Direct mapping. Must exist in cloud `farms` table before sync. |
| `type` | `type` | TEXT | production_type ENUM | Direct mapping. Values: `cattle`, `swine`, `poultry`. |
| `identification_tag` | `identification_tag` | TEXT COLLATE NOCASE | VARCHAR(50) | Direct mapping. Preserve original casing from device. |
| `birth_date` | `birth_date` | TEXT (ISO 8601) | DATE | Convert TEXT to DATE format before sending. |
| `status` | `status` | TEXT | VARCHAR(50) | Direct mapping. Values: `healthy`, `sick`, `quarantine`, `sold`. |
| `created_at` | `created_at` | TEXT (ISO 8601) | TIMESTAMP | Convert TEXT to TIMESTAMP before sending. |

**Sync payload example:**
```json
{
  "id": null,
  "farm_id": "b0000000-0000-0000-0000-000000000001",
  "type": "cattle",
  "identification_tag": "105A",
  "birth_date": "2023-04-15",
  "status": "healthy",
  "created_at": "2026-06-26T10:00:00"
}
```

---

## 2. weight_logs → weight_logs

**Sub-task 2 — Completed by José Miguel**

| Local SQLite Column | Cloud PostgreSQL Column | Type (local) | Type (cloud) | Sync Rule |
|---|---|---|---|---|
| `id` | — | INTEGER | — | Excluded from payload. Local reference only. |
| `cloud_id` | `id` | TEXT | UUID | Sent as `id`. NULL on first sync — backend assigns and returns UUID. |
| `animal_id` | — | INTEGER | — | Excluded from payload. Local integer reference only. |
| `animal_cloud_id` | `animal_id` | TEXT | UUID | Sent as `animal_id`. Must be resolved before sync — use `animals.cloud_id`. |
| `weight_kg` | `weight_kg` | REAL | NUMERIC(6,2) | Direct mapping. Precision preserved up to 2 decimal places. |
| `log_date` | `log_date` | TEXT (ISO 8601) | TIMESTAMP | Convert TEXT to TIMESTAMP before sending. |

**Sync payload example:**
```json
{
  "id": null,
  "animal_id": "uuid-cloud-animal-001",
  "weight_kg": 450.00,
  "log_date": "2026-06-26T08:30:00"
}
```

---

## 3. health_records → health_records

**Sub-task 3 — Completed by José Miguel**

| Local SQLite Column | Cloud PostgreSQL Column | Type (local) | Type (cloud) | Sync Rule |
|---|---|---|---|---|
| `id` | — | INTEGER | — | Excluded from payload. Local reference only. |
| `cloud_id` | `id` | TEXT | UUID | Sent as `id`. NULL on first sync — backend assigns and returns UUID. |
| `animal_id` | — | INTEGER | — | Excluded from payload. Local integer reference only. |
| `animal_cloud_id` | `animal_id` | TEXT | UUID | Sent as `animal_id`. Must be resolved before sync — use `animals.cloud_id`. |
| `symptoms_description` | `symptoms_description` | TEXT | TEXT | Direct mapping. Raw NLP voice capture output. |
| `diagnosis` | `diagnosis` | TEXT | VARCHAR(150) | Direct mapping. Nullable. Truncate if exceeds 150 characters. |
| `treatment_administered` | `treatment_administered` | TEXT | VARCHAR(255) | Direct mapping. Nullable. Truncate if exceeds 255 characters. |
| `recorded_at` | `recorded_at` | TEXT (ISO 8601) | TIMESTAMP | Convert TEXT to TIMESTAMP before sending. |

**Sync payload example:**
```json
{
  "id": null,
  "animal_id": "uuid-cloud-animal-001",
  "symptoms_description": "tos severa y decaimiento",
  "diagnosis": null,
  "treatment_administered": null,
  "recorded_at": "2026-06-26T09:15:00"
}
```

---

## 4. Sync Resolution Order

The following order must be respected during every sync operation
to avoid foreign key violations on the cloud:

```
1. animals        ← must sync first (weight_logs and health_records depend on cloud UUID)
2. weight_logs    ← sync after animals.cloud_id is resolved
3. health_records ← sync after animals.cloud_id is resolved
```

---

## 5. Pending Approvals

| Sub-task | Assignee | Status |
|---|---|---|
| Map local_animals to animals | José Miguel | ✅ Completed |
| Map local_weight_logs to weight_logs | José Miguel | ✅ Completed |
| Map local_health_records to health_records | José Miguel | ✅ Completed |
| Review Android local fields | Juan Carlos | ⏳ Pending |
| Review backend DTO expectations | Sergio | ⏳ Pending |

> **Note to Juan Carlos:** The local SQLite column names defined in this
> contract were established in US-04 (feature/us-04-josemiguel-data).
> Please confirm that your Android Room implementation uses these exact
> column names or flag any discrepancies for alignment.

> **Note to Sergio:** Sync payloads follow the structure defined in the
> examples above. Local-only fields (`id`, `animal_id`) are excluded.
> `cloud_id` is sent as `id` and will be NULL on first sync.
> Please confirm DTO compatibility.
