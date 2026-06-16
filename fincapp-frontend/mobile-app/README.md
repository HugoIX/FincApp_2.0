# FincApp Base - Java + SQLite

Base mínima para la historia US-01-JUANCARLOS.

## Incluye

- Proyecto Android en Java.
- Pantalla Home con botones grandes para Cattle, Swine y Poultry.
- SQLite local usando SQLiteOpenHelper.
- Tablas locales:
  - local_users
  - local_farms
  - local_production_modules
  - sync_queue
- Cada selección de módulo se guarda localmente con sync_status = pending.

## Cómo abrir

1. Android Studio > Open.
2. Selecciona la carpeta FincAppBase.
3. Espera la sincronización de Gradle.
4. Ejecuta en emulador o dispositivo.
5. Prueba en modo avión.
