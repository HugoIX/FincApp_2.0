# FincApp Mobile - Integrated Android Client

Proyecto Android nativo en Java que conserva US-01, US-02 y US-03, y agrega integración real con el backend .NET usado por la interfaz web.

## Qué incluye

- SQLite offline para `animals`, `weight_logs`, `health_records` y `sync_queue`.
- UUID local en `cloud_id` para que el backend reciba GUIDs válidos.
- WorkManager con constraint de red y backoff exponencial.
- Retrofit conectado al contrato real del backend:
  - `POST /api/v1/auth/login`
  - `GET /api/v1/farms`
  - `POST /api/v1/farms/{farmId}/sync`
  - `POST /api/aura/tool-agent`
- Header `X-Farm-Id` requerido por `TenantProvider` del backend.
- Configuración editable de `BASE_URL` desde la pantalla inicial.
- Sin API keys en Android. Gemini, ElevenLabs y Supabase siguen viviendo en el backend.

## URL del backend

### Emulador Android

Si el backend corre en tu PC por HTTP en el puerto 5211:

```text
http://10.0.2.2:5211/api/
```

### Celular físico

Busca la IPv4 de tu PC con:

```cmd
ipconfig
```

Ejemplo:

```text
http://192.168.1.15:5211/api/
```

El celular y la PC deben estar en la misma red WiFi. El firewall de Windows debe permitir conexiones al puerto del backend.

### VPS / Producción

Cuando el backend esté desplegado:

```text
https://tu-dominio-o-ip/api/
```

## Nota importante sobre HTTPS local

Android no confía automáticamente en certificados HTTPS de desarrollo de .NET. Para pruebas locales, usa el perfil HTTP del backend o configura un certificado confiable. El manifest permite HTTP local con `android:usesCleartextTraffic="true"`.

## Flujo de prueba recomendado

1. Ejecuta el backend .NET.
2. Abre la app Android.
3. Configura la URL base.
4. Haz login con un usuario existente.
5. Carga fincas y selecciona una.
6. Activa modo avión.
7. Crea animales, pesos y registros de salud.
8. Desactiva modo avión o conecta WiFi.
9. WorkManager sincroniza automáticamente.
10. Revisa Logcat con el tag:

```text
FincAppSync
```

## Archivos que no deben subirse

```text
.gradle/
.idea/
build/
app/build/
local.properties
```
