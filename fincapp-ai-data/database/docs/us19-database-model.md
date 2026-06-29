# FincApp | Database Model Documentation
**Sub-task:** US-19 — Sub-task 3 (Document database model)  
**Author:** José Miguel  
**Consumer:** Hugo (Technical Documentation and Architecture Diagrams)  
**Date:** 2026-06-27  

> This document explains the FincApp 2.0 cloud database model hosted on
> Supabase PostgreSQL. It covers all tables, views, relationships, indexes,
> and security policies implemented across Sprint 1.

---

## 1. Database Platform

| Parameter | Value |
|---|---|
| Engine | PostgreSQL (Supabase managed) |
| Region | South America — São Paulo |
| Project | fincapp-db |
| Schema | public |

---

## 2. Entity Relationship Overview

```
users
  └── farms (owner_id)
        ├── farm_assignments (farm_id) ←── users (user_id)
        ├── production_modules (farm_id)
        ├── animals (farm_id)
        │     ├── weight_logs (animal_id)
        │     └── health_records (animal_id)
        └── sync_telemetry_logs (farm_id) ←── users (user_id)
```

All relationships use `ON DELETE CASCADE` — removing a farm automatically
removes all its animals, weight logs, health records, and telemetry logs.

---

## 3. Tables

### 3.1 users
Root entity. Every farm owner and field worker is registered here.

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK, default gen_random_uuid() |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL |
| `password_hash` | VARCHAR(255) | NOT NULL |
| `role` | user_role ENUM | NOT NULL, default 'worker' |
| `created_at` | TIMESTAMP | NOT NULL, default CURRENT_TIMESTAMP |

**ENUM user_role:** `admin`, `worker`

---

### 3.2 farms
Represents a physical farm owned by a user.

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `owner_id` | UUID | FK → users.id, NOT NULL |
| `name` | VARCHAR(100) | NOT NULL |
| `location` | VARCHAR(255) | nullable |
| `created_at` | TIMESTAMP | NOT NULL |

---

### 3.3 farm_assignments
Bridge table — resolves many-to-many between users (workers) and farms.

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID | FK → users.id, NOT NULL |
| `farm_id` | UUID | FK → farms.id, NOT NULL |
| `assigned_at` | TIMESTAMP | NOT NULL |

**Unique constraint:** `(user_id, farm_id)` — one assignment per worker per farm.

---

### 3.4 production_modules
Tracks which production sectors are active on each farm.

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `farm_id` | UUID | FK → farms.id, NOT NULL |
| `type` | production_type ENUM | NOT NULL |
| `is_active` | BOOLEAN | NOT NULL, default TRUE |
| `created_at` | TIMESTAMP | NOT NULL |

**ENUM production_type:** `cattle`, `swine`, `poultry`  
**Unique constraint:** `(farm_id, type)` — one module per type per farm.

---

### 3.5 animals
Core livestock asset table. Directly linked to the farm tenant.

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `farm_id` | UUID | FK → farms.id, NOT NULL |
| `type` | production_type ENUM | NOT NULL |
| `identification_tag` | VARCHAR(50) | NOT NULL |
| `birth_date` | DATE | nullable |
| `status` | VARCHAR(50) | NOT NULL, default 'healthy' |
| `created_at` | TIMESTAMP | NOT NULL |

**Status values:** `healthy`, `sick`, `quarantine`, `sold`  
**Unique constraint:** `(farm_id, identification_tag)` — tags are unique per farm.

---

### 3.6 weight_logs
Time-series table. Every weighing event creates a new row — no overwrites.

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `animal_id` | UUID | FK → animals.id, NOT NULL |
| `weight_kg` | NUMERIC(6,2) | NOT NULL |
| `log_date` | TIMESTAMP | NOT NULL, default CURRENT_TIMESTAMP |

---

### 3.7 health_records
Stores clinical observations captured from AURA voice input.
Feeds Juan Pablo's n8n + LLM automation pipeline.

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `animal_id` | UUID | FK → animals.id, NOT NULL |
| `symptoms_description` | TEXT | NOT NULL |
| `diagnosis` | VARCHAR(150) | nullable |
| `treatment_administered` | VARCHAR(255) | nullable |
| `recorded_at` | TIMESTAMP | NOT NULL |

---

### 3.8 sync_telemetry_logs
Audit table for offline-to-cloud sync transactions from mobile devices.

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `device_uuid` | VARCHAR(100) | NOT NULL |
| `user_id` | UUID | FK → users.id |
| `farm_id` | UUID | FK → farms.id, NOT NULL |
| `status` | VARCHAR(30) | NOT NULL |
| `rows_synced` | INTEGER | NOT NULL, default 0 |
| `error_message` | TEXT | nullable |
| `synchronized_at` | TIMESTAMP | NOT NULL |

**Status values:** `success`, `failed`, `partial_conflict`

---

## 4. Analytical Views

### 4.1 vw_active_modules_summary
Summarizes active production modules per farm and production type.
Consumed by dashboard and n8n workflows.

**Key columns:** `owner_id`, `farm_id`, `farm_name`, `production_type`, `active_module_count`

---

### 4.2 vw_farm_operational_status
Shows whether each farm has at least one active production module.
Used for farm health monitoring.

**Key columns:** `farm_id`, `farm_name`, `owner_id`, `location`, `active_module_count`, `is_operational`

---

### 4.3 view_farm_inventory_analytics
Pre-calculates animal headcount by farm, production line and health status.
Consumed by dashboard inventory panel and AURA recommendation flow.

**Key columns:** `farm_id`, `farm_name`, `production_line`, `health_status`, `total_headcount`, `last_inventory_update`

---

### 4.4 view_animal_weight_performance
Extracts lifetime weight metrics per animal.
Consumed by dashboard growth tracking panel.

**Key columns:** `farm_id`, `animal_id`, `identification_tag`, `production_line`, `lifetime_average_weight`, `maximum_recorded_weight`, `total_weighing_sessions`

---

### 4.5 view_health_alert_summary
Returns health record counts grouped by farm and animal status severity.
Consumed by dashboard alert panel and Juan Pablo's LLM pipeline.

**Key columns:** `farm_id`, `farm_name`, `owner_id`, `severity`, `total_health_records`, `last_recorded_at`

---

## 5. Performance Indexes

| Index | Table | Columns | Purpose |
|---|---|---|---|
| `idx_farms_owner` | farms | `owner_id` | Filter farms by owner |
| `idx_modules_farm_type` | production_modules | `(farm_id, type)` | Filter modules by farm and type |
| `idx_animals_farm` | animals | `farm_id` | Filter animals by farm |
| `idx_animals_farm_animal` | animals | `(farm_id, id)` | Scoped analytical queries |
| `idx_weight_animal` | weight_logs | `animal_id` | Time-series weight lookups |
| `idx_health_animal` | health_records | `animal_id` | Health record lookups |
| `idx_sync_telemetry_farm` | sync_telemetry_logs | `farm_id` | Telemetry audit queries |

**Performance target:** all analytical queries under 200ms (validated with EXPLAIN ANALYZE in US-03).

---

## 6. Row Level Security (RLS)

RLS is enabled on all base tables. Every policy uses `auth.uid()` to
restrict visibility to the authenticated tenant's own data only.

| Table | Policy | Rule |
|---|---|---|
| `farms` | owner_sees_own_farms | `owner_id = auth.uid()` |
| `farm_assignments` | owner_or_worker_sees_assignments | `farm_id IN (owner's farms) OR user_id = auth.uid()` |
| `production_modules` | owner_sees_own_modules | `farm_id IN (owner's farms)` |
| `animals` | owner_sees_own_animals | `farm_id IN (owner's farms)` |
| `weight_logs` | owner_sees_own_weight_logs | `animal_id IN (owner's animals)` |
| `health_records` | owner_sees_own_health_records | `animal_id IN (owner's animals)` |
| `sync_telemetry_logs` | owner_sees_own_sync_logs | `farm_id IN (owner's farms)` |

---

## 7. Scripts in Repository

All scripts are located in `fincapp-ai-data/database/`:

| File | Purpose |
|---|---|
| `schema.sql` | Full DDL — tables, ENUMs, indexes (Hugo) |
| `analytical-views.sql` | All 5 analytical views |
| `rls-policies.sql` | Core RLS policies (US-01) |
| `us02-rls-and-indexes.sql` | Animal inventory RLS and composite index |
| `postgresql-livestock-schema.sql` | Consolidated deployment script |
| `sqlite/us04-local-schema.sql` | Local Android SQLite schema |
| `sqlite/us04-validation-queries.sql` | SQLite index validation queries |
| `docs/` | Connection strings, contracts, metrics, reports |
