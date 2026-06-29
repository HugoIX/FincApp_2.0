# FincApp — Database Connection Strings
**Issued by:** José Miguel (US-01-JOSEMIGUEL)  
**Environment:** Staging  
**Date:** 2025-06-16  

> ⚠️ This document contains sensitive credentials. Do not commit to public repositories or share outside the development team.

---

## Supabase Project Info

| Field          | Value                          |
|----------------|--------------------------------|
| Project Name   | fincapp-db                     |
| Region         | South America (São Paulo)      |
| Project URL    | https://XXXXXXXXXXXX.supabase.co |

---

## Sergio — C# .NET Core / Entity Framework Core

Connection string format for `appsettings.json`:

```json
{
  "ConnectionStrings": {
    "FincAppDb": "Host=db.XXXXXXXXXXXX.supabase.co;Port=5432;Database=postgres;Username=postgres;Password=YOUR_PASSWORD;SSL Mode=Require;"
  }
}
```

**Individual parameters:**

| Parameter | Value                                  |
|-----------|----------------------------------------|
| Host      | db.XXXXXXXXXXXX.supabase.co            |
| Port      | 5432                                   |
| Database  | postgres                               |
| Username  | postgres                               |
| Password  | YOUR_PASSWORD                          |
| SSL Mode  | Require                                |

---

## Juan Pablo — n8n Workflow Platform

Use these values when configuring the **Postgres node** in n8n:

| Field    | Value                           |
|----------|---------------------------------|
| Host     | db.XXXXXXXXXXXX.supabase.co     |
| Port     | 5432                            |
| Database | postgres                        |
| User     | postgres                        |
| Password | YOUR_PASSWORD                   |
| SSL      | Enable (Require)                |

**API access (for HTTP Request nodes):**

| Field           | Value                              |
|-----------------|------------------------------------|
| Project URL     | https://XXXXXXXXXXXX.supabase.co   |
| Anon Key        | YOUR_ANON_KEY                      |

---

## Key Tables & Views Available

| Object                      | Type  | Description                                      |
|-----------------------------|-------|--------------------------------------------------|
| `users`                     | Table | Platform users and roles                         |
| `farms`                     | Table | Farm registry per owner                          |
| `farm_assignments`          | Table | Worker-to-farm assignments                       |
| `production_modules`        | Table | Active production sectors per farm               |
| `vw_active_modules_summary` | View  | Active modules aggregated by owner, farm and type |
| `vw_farm_operational_status`| View  | Operational status summary per farm              |

---

## Security Notes

- Row Level Security (RLS) is **enabled** on all base tables.
- Queries must be scoped by `owner_id` to respect tenant isolation.
- The `service_role` key bypasses RLS — use only for admin operations, never in client-facing code.
- Rotate credentials immediately if exposed.