# HU-01-AURA | Awaken AURA - Intelligent Agent Initialization

## Goal
Allow the user to start the FincApp assistant experience from the Android APK by pressing **Despertar AURA**.

## Current implementation scope
This first version is intentionally offline and deterministic. It does not call OpenAI, Gemini, DeepSeek, n8n, or any external service.

## User flow
1. User opens the FincApp APK.
2. User presses **Despertar AURA**.
3. AURA starts an animation and introduces itself through Android TextToSpeech.
4. User can ask demo questions by text or quick buttons.
5. AURA responds to:
   - ¿Quién eres?
   - ¿Puedes trabajar sin internet?
   - Quiero registrar un animal.
   - Health/vaccination-related questions.
   - Dashboard/report questions.

## Android files
- `app/src/main/java/com/irwi/fincapp/ui/AuraActivity.java`
- `app/src/main/java/com/irwi/fincapp/aura/AuraScriptEngine.java`
- `app/src/main/res/layout/activity_aura.xml`
- `app/src/main/res/drawable/aura_orb_bg.xml`
- `app/src/main/res/drawable/aura_card_bg.xml`
- `app/src/main/res/drawable/aura_button_bg.xml`

## Acceptance Criteria
- AURA can be opened from the current main screen.
- AURA introduces itself by voice.
- AURA can answer the question "¿Quién eres?".
- AURA explains the offline-first behavior.
- No internet connection is required for this story.

## Next story
HU-02 should convert livestock phrases into structured JSON, for example:

```json
{
  "animal_type": "cattle",
  "identification_tag": "302",
  "weight_kg": 520.0,
  "sync_status": "pending"
}
```
