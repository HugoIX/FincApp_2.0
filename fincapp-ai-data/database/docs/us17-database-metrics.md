# FincApp | Database Metrics for AURA Recommendation Context
**Sub-task:** US-17 — Sub-task 4 (Provide database metrics)  
**Author:** José Miguel  
**Consumer:** Juan Pablo (AURA Cloud Recommendation Workflow)  
**Date:** 2026-06-27  

> This document defines the database metrics that must be injected into
> the AURA recommendation prompt as context. All values are sourced from
> the analytical views available in Supabase. Juan Pablo must query these
> views or receive their output from the backend before building the prompt.

---

## Source Views

| View | Purpose |
|---|---|
| `view_farm_inventory_analytics` | Animal headcount by farm, production line and health status |
| `view_animal_weight_performance` | Average and maximum weight per animal |
| `view_health_alert_summary` | Health record counts by farm and severity |

---

## 1. Inventory Metrics

**Source:** `view_farm_inventory_analytics`  
**Query:**
```sql
SELECT farm_name, production_line, health_status, total_headcount
FROM view_farm_inventory_analytics
WHERE farm_id = '<target_farm_id>';
```

**Sample output:**
```json
{
  "inventory": [
    { "production_line": "cattle", "health_status": "healthy", "total_headcount": 12 },
    { "production_line": "cattle", "health_status": "sick",    "total_headcount": 2  },
    { "production_line": "swine",  "health_status": "healthy", "total_headcount": 8  }
  ]
}
```

**Prompt context field:** `farm_inventory`

---

## 2. Weight Performance Metrics

**Source:** `view_animal_weight_performance`  
**Query:**
```sql
SELECT production_line, AVG(lifetime_average_weight) AS fleet_avg_weight,
       MAX(maximum_recorded_weight) AS fleet_max_weight,
       SUM(total_weighing_sessions) AS total_sessions
FROM view_animal_weight_performance
WHERE farm_id = '<target_farm_id>'
GROUP BY production_line;
```

**Sample output:**
```json
{
  "weight_performance": [
    {
      "production_line": "cattle",
      "fleet_avg_weight": 420.50,
      "fleet_max_weight": 510.00,
      "total_sessions": 24
    },
    {
      "production_line": "swine",
      "fleet_avg_weight": 118.75,
      "fleet_max_weight": 145.00,
      "total_sessions": 16
    }
  ]
}
```

**Prompt context field:** `weight_performance`

---

## 3. Health Alert Metrics

**Source:** `view_health_alert_summary`  
**Query:**
```sql
SELECT severity, total_health_records, last_recorded_at
FROM view_health_alert_summary
WHERE farm_id = '<target_farm_id>'
ORDER BY total_health_records DESC;
```

**Sample output:**
```json
{
  "health_alerts": [
    {
      "severity": "sick",
      "total_health_records": 3,
      "last_recorded_at": "2026-06-26T09:15:00"
    },
    {
      "severity": "quarantine",
      "total_health_records": 1,
      "last_recorded_at": "2026-06-25T14:30:00"
    }
  ]
}
```

**Prompt context field:** `health_alerts`

---

## 4. Full Prompt Context Object

This is the complete context object Juan Pablo must inject into the AURA
recommendation prompt:

```json
{
  "farm_name": "Finca El Roble",
  "farm_inventory": [
    { "production_line": "cattle", "health_status": "healthy", "total_headcount": 12 },
    { "production_line": "cattle", "health_status": "sick",    "total_headcount": 2  },
    { "production_line": "swine",  "health_status": "healthy", "total_headcount": 8  }
  ],
  "weight_performance": [
    {
      "production_line": "cattle",
      "fleet_avg_weight": 420.50,
      "fleet_max_weight": 510.00,
      "total_sessions": 24
    }
  ],
  "health_alerts": [
    {
      "severity": "sick",
      "total_health_records": 3,
      "last_recorded_at": "2026-06-26T09:15:00"
    }
  ]
}
```

---

## 5. Safety Note for Prompt Design

When health alerts are present, the prompt must instruct AURA to:
- Prioritize animal welfare in the recommendation.
- Never replace veterinary advice.
- Suggest contacting a veterinarian for `sick` or `quarantine` severities.

---

## Notes

- Replace `<target_farm_id>` with the authenticated owner's farm UUID.
- All views enforce tenant isolation — no cross-farm data will be returned.
- If no health alerts exist, `health_alerts` array will be empty — handle
  this case in the prompt to avoid hallucinated alerts.
