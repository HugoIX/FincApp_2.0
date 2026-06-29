# FincApp Mobile Final

Cliente Android nativo en Java para FincApp.

## Flujo incluido

1. Splash / presentación
2. Login demo o login básico
3. Selección de finca
4. Home con módulos Cattle, Swine, Poultry y AURA
5. CRUD offline de animales
6. Registro offline de pesos y salud
7. SQLite local con `sync_status = pending/synced`
8. WorkManager para sincronización automática
9. Retrofit preparado para backend .NET
10. Pantalla de Settings para cambiar URL del backend sin mostrarla en el Home

## URL del backend

Para emulador Android:

```text
http://10.0.2.2:5211/api/
```

Para celular físico:

```text
http://IP_DE_TU_PC:5211/api/
```

Cuando el backend esté en VPS:

```text
https://TU_DOMINIO_O_IP/api/
```

## Importante

No incluir API keys en Android. Gemini, ElevenLabs y Supabase deben quedarse solo en backend.

## Abrir

Abrir exactamente esta carpeta en Android Studio:

```text
fincapp-frontend/mobile-app
```
