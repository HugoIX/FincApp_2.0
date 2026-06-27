# FincApp | Sample Data for Weekly Email Report
**Sub-task:** US-18 — Sub-task 4 (Provide sample data)  
**Author:** José Miguel  
**Consumer:** Juan Pablo (Weekly Email Report Workflow)  
**Date:** 2026-06-27  

> This document provides seed values for the weekly farm report preview.
> Juan Pablo must use these values to build and validate the n8n report
> template before connecting it to live database queries.

---

## Report Data Structure

The weekly report must include four sections. Each section maps to one
analytical view available in Supabase.

| Report Section | Source View |
|---|---|
| Inventory Summary | `view_farm_inventory_analytics` |
| Weight Performance | `view_animal_weight_performance` |
| Health Alerts | `view_health_alert_summary` |
| AURA Recommendation | `view_health_alert_summary` + prompt |

---

## 1. Inventory Summary

**Sample values:**

| Production Line | Health Status | Total Animals |
|---|---|---|
| Cattle | Healthy | 12 |
| Cattle | Sick | 2 |
| Swine | Healthy | 8 |
| Poultry | Healthy | 35 |

**Empty state message:**
> "No inventory records available for this period."

---

## 2. Weight Performance

**Sample values:**

| Production Line | Fleet Average Weight | Max Recorded Weight | Total Sessions |
|---|---|---|---|
| Cattle | 420.50 kg | 510.00 kg | 24 |
| Swine | 118.75 kg | 145.00 kg | 16 |
| Poultry | 2.80 kg | 3.50 kg | 40 |

**Empty state message:**
> "No weight records available for this period."

---

## 3. Health Alerts

**Sample values:**

| Severity | Total Records | Last Recorded |
|---|---|---|
| Sick | 3 | 2026-06-26 09:15 |
| Quarantine | 1 | 2026-06-25 14:30 |

**Empty state message:**
> "No health alerts recorded for this period."

---

## 4. AURA Recommendation

**Sample recommendation (healthy farm):**
> "Your farm shows stable inventory levels and consistent weight progression
> across all production lines. No critical health alerts were detected this
> week. Consider scheduling a routine weight check for cattle in the next
> 7 days to maintain tracking accuracy."

**Sample recommendation (alerts present):**
> "Health alerts were detected on your farm this week. 3 animals are
> currently marked as sick and 1 is under quarantine. Animal welfare
> should be prioritized. Please consult a veterinarian for proper
> diagnosis and treatment. AURA does not replace professional
> veterinary advice."

**Fallback recommendation (no data):**
> "Not enough farm data is available to generate a recommendation
> this week. Please ensure that animal records, weight logs, and
> health observations are being registered regularly."

---

## 5. Full Sample Report Payload

This is the complete data object Juan Pablo must use to populate
the report template:

```json
{
  "report_date": "2026-06-27",
  "farm_name": "Finca El Roble",
  "period": "2026-06-20 to 2026-06-27",
  "inventory": [
    { "production_line": "cattle",  "health_status": "healthy", "total_headcount": 12 },
    { "production_line": "cattle",  "health_status": "sick",    "total_headcount": 2  },
    { "production_line": "swine",   "health_status": "healthy", "total_headcount": 8  },
    { "production_line": "poultry", "health_status": "healthy", "total_headcount": 35 }
  ],
  "weight_performance": [
    { "production_line": "cattle",  "fleet_avg_weight": 420.50, "fleet_max_weight": 510.00, "total_sessions": 24 },
    { "production_line": "swine",   "fleet_avg_weight": 118.75, "fleet_max_weight": 145.00, "total_sessions": 16 },
    { "production_line": "poultry", "fleet_avg_weight": 2.80,   "fleet_max_weight": 3.50,   "total_sessions": 40 }
  ],
  "health_alerts": [
    { "severity": "sick",       "total_health_records": 3, "last_recorded_at": "2026-06-26T09:15:00" },
    { "severity": "quarantine", "total_health_records": 1, "last_recorded_at": "2026-06-25T14:30:00" }
  ],
  "aura_recommendation": "Health alerts were detected on your farm this week. 3 animals are currently marked as sick and 1 is under quarantine. Animal welfare should be prioritized. Please consult a veterinarian for proper diagnosis and treatment. AURA does not replace professional veterinary advice."
}
```

---

## Notes

- All sample values are based on the seed data committed in US-10.
- Replace sample values with live Supabase view queries before production.
- If any section returns no data, use the empty state messages defined above.
- Report period defaults to the last 7 days from the trigger date.
