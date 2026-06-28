# FincApp Mobile - US-01-JUANCARLOS

Base Android en Java para la historia:

**US-01-JUANCARLOS | Mobile APK Scaffolding, SQLite Offline Schema & Accessible Layout Base**

## Qué incluye

- APK Android base en Java.
- Pantalla Home accesible con botones grandes basados en íconos para:
  - Cattle
  - Swine
  - Poultry
- Selector de finca activa.
- SQLite local inicializada en el primer arranque.
- Funcionamiento sin internet / modo avión.
- Tablas locales:
  - `local_users`
  - `local_farms`
  - `local_production_modules`
  - `sync_queue`
- Cambios de entidad guardados localmente con `sync_status = 'pending'`.
- Cada selección de módulo crea registro en `local_production_modules` y en `sync_queue`.

## Cómo ejecutar

Abrir esta carpeta en Android Studio:

```text
fincapp-frontend/mobile-app
```

Luego ejecutar el módulo `app` en emulador o celular físico.

## Suggested acceptance test

1. Activar modo avión.
2. Abrir la app.
3. Verificar que no se cierra.
4. Seleccionar una finca activa.
5. Presionar Cattle, Swine o Poultry.
6. Confirmar que aparece mensaje `sync_status = pending`.

