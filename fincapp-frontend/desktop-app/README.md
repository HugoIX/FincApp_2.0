# FincApp 2.0 — Administrator Dashboard MVP

This folder contains the integrated web frontend for **US-16 — Administrator Dashboard MVP**.

It reuses the previous FincApp SPA structure and adapts it to the new FincApp 2.0 / AURA narrative.

## Main integration changes

- Rebranded UI to **FincApp 2.0 — Powered by AURA**.
- Added administrator dashboard with KPI cards.
- Added farm selector.
- Added API, localStorage, and demo fallback for dashboard data.
- Kept existing modules: Inventory, Health, Activities, Weights, Reports, Settings, and Admin.
- Kept offline-first queue.
- Kept AURA voice button.

## How to run

From this folder:

```bash
python -m http.server 8080
```

Open:

```text
http://localhost:8080
```

## Demo login

If the Node backend is unavailable, the frontend keeps the existing demo accounts:

```text
admin@farm.com / admin123
worker@farm.com / worker123
```

## Backend expected URL

```text
http://localhost:3000/api
```

You can change it from browser console if needed:

```js
localStorage.setItem('fincapp_api_base_url', 'http://localhost:3000/api')
```

## Acceptance criteria covered

- Dashboard page exists.
- KPI cards exist.
- Data source is connected or simulated.
- Multiple farm selector exists.
- Health alerts are highlighted.
- Empty state exists.
- UI follows FincApp colors and identity.
- Dashboard is presentation-ready.
