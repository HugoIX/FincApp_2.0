# FincApp Administrator Dashboard MVP

**User Story:** US-16 — Administrator Dashboard MVP  
**Assignee:** Hugo  
**Priority:** High  
**Story Points:** 13

## Purpose

This module provides a presentation-ready administrator dashboard for FincApp 2.0. It displays synchronized livestock KPIs using a stable demo dataset while remaining ready to connect later to the backend API, Supabase views, or analytical SQL outputs.

## Location

```text
fincapp-frontend/desktop-app/admin-dashboard/
```

## Included Files

```text
index.html
styles.css
dashboard-data.js
app.js
README.md
```

## MVP KPIs

- Total animals
- Animals by production line
- Average weight
- Health alerts
- Pending synchronization records
- Recent synchronized activity
- AURA operational insight

## How to Run

Open `index.html` directly in a browser, or use VS Code Live Server.

Recommended:

```text
Right click index.html > Open with Live Server
```

## Data Source

Current implementation uses `dashboard-data.js` as a stable demo dataset.

This can later be replaced by:

1. Backend API response.
2. Supabase analytical views.
3. Static JSON exported from SQL views for demo fallback.

## Acceptance Criteria Coverage

- KPI cards show current values using demo synchronized data.
- Farm selector filters data by selected farm.
- Health alerts are highlighted.
- Empty state is available through the “Finca Demo Empty State” option.
- Visual identity follows FincApp colors: blue, green, and white.

## Suggested Branch

```text
feature/us-16-admin-dashboard
```

## Suggested Commit

```text
feat(dashboard): add administrator livestock kpi dashboard
```

## Definition of Done Checklist

- [x] Dashboard page exists.
- [x] KPI cards exist.
- [x] Data source is connected or simulated.
- [x] Farm selector filters data.
- [x] Health alerts are highlighted.
- [x] Empty state exists.
- [x] UI follows FincApp colors and identity.
- [ ] Dashboard is included in final demo.
