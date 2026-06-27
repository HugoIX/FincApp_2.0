# AURA Offline Command Validation Matrix

**Project:** FincApp 2.0 — Powered by AURA  
**User Story:** US-08 — Mobile Offline QA Command Matrix  
**Assignee:** Hugo  
**Target module:** `fincapp-ai-data/edge-intelligence/`  
**Deliverable:** `aura_command_test_matrix.md`  
**Version:** 1.0  
**Language standard:** English technical documentation with Spanish voice command examples.

---

## 1. Purpose

This document defines the official QA validation matrix for AURA offline voice commands.

The goal is to help the team validate that voice commands are recognized by the Android voice input, parsed correctly by the local AURA parser, transformed into the expected structured output, saved correctly into SQLite when required, and confirmed or rejected by AURA with a clear voice response.

This matrix reduces the testing burden on the Android developer by providing predefined test cases for valid, incomplete, invalid, and demo-safe commands.

---

## 2. Testing Scope

| Operation Type | Parser Intent | SQLite Behavior |
| --- | --- | --- |
| Animal registration | register_animal | Insert into local_animals with sync_status = pending |
| Weight log registration | register_weight | Insert into local_weight_logs with sync_status = pending |
| Health record registration | register_health_record | Insert into local_health_records with sync_status = pending |
| Field task registration | register_task | Insert into local_tasks or keep as future-ready operation |
| Incomplete command | Detected intent with missing_fields | Do not save until required fields are provided |
| Invalid command | unknown | Do not save anything |
| Small talk / assistant question | assistant_response or unknown | Do not save anything |

---

## 3. Expected Parser Output Contract

Each command should return a structure compatible with this contract:

```json
{
  "intent": "register_animal | register_weight | register_health_record | register_task | assistant_response | unknown",
  "animal_type": "cattle | swine | poultry | null",
  "identification_tag": "string | null",
  "weight_kg": "decimal | null",
  "symptoms_description": "string | null",
  "task_description": "string | null",
  "severity": "low | medium | high | null",
  "confidence": "low | medium | high",
  "missing_fields": [],
  "raw_text": "original recognized speech text"
}
```

---

## 4. SQLite Behavior Rules

| Parser Result | SQLite Action |
| --- | --- |
| Valid register_animal | Save record in local_animals |
| Valid register_weight | Save record in local_weight_logs only if animal exists |
| Valid register_health_record | Save record in local_health_records only if animal exists |
| Valid register_task | Save record in local_tasks if implemented; otherwise mark as future-ready |
| Missing required field | Do not save; AURA must ask for the missing value |
| Unknown command | Do not save; AURA must ask the user to repeat |
| Assistant question | Do not save; AURA answers conversationally |

All locally saved records must use:

```text
sync_status = pending
```

---

## 5. Demo Priority Labels

| Priority | Meaning |
| --- | --- |
| DEMO_CRITICAL | Must work for the final demo |
| DEMO_SAFE | Good candidate for demo if stable |
| QA_REQUIRED | Must be tested but not necessarily shown |
| EDGE_CASE | Useful for parser resilience |
| ROADMAP | Future behavior, not required for the MVP |

---

## 6. Command Validation Matrix

| ID | Category | Spanish Voice Command | Expected Intent | Expected Parser Output Summary | Expected AURA Voice Response | Expected SQLite Behavior | Demo Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CMD-001 | Valid animal registration | registra una vaca con arete 302 | register_animal | animal_type=cattle; identification_tag=302; confidence=high | Animal registered locally. Tag 302 was saved as cattle. | Insert into local_animals; sync_status=pending | DEMO_CRITICAL |
| CMD-002 | Valid animal registration | agrega una res número 45 | register_animal | animal_type=cattle; identification_tag=45; confidence=high | Animal registered locally. Tag 45 was saved as cattle. | Insert into local_animals; sync_status=pending | DEMO_SAFE |
| CMD-003 | Valid animal registration | nuevo toro con código T20 | register_animal | animal_type=cattle; identification_tag=T20; confidence=high | Animal registered locally. Tag T20 was saved as cattle. | Insert into local_animals; sync_status=pending | QA_REQUIRED |
| CMD-004 | Valid animal registration | registra un ternero con marquilla B15 | register_animal | animal_type=cattle; identification_tag=B15; confidence=high | Animal registered locally. Tag B15 was saved as cattle. | Insert into local_animals; sync_status=pending | QA_REQUIRED |
| CMD-005 | Valid animal registration | registra un cerdo con arete 12 | register_animal | animal_type=swine; identification_tag=12; confidence=high | Animal registered locally. Tag 12 was saved as swine. | Insert into local_animals; sync_status=pending | DEMO_SAFE |
| CMD-006 | Valid animal registration | agrega un marrano número 88 | register_animal | animal_type=swine; identification_tag=88; confidence=high | Animal registered locally. Tag 88 was saved as swine. | Insert into local_animals; sync_status=pending | QA_REQUIRED |
| CMD-007 | Valid animal registration | registra una gallina tag G15 | register_animal | animal_type=poultry; identification_tag=G15; confidence=high | Animal registered locally. Tag G15 was saved as poultry. | Insert into local_animals; sync_status=pending | DEMO_SAFE |
| CMD-008 | Valid animal registration | registra un pollo código P9 | register_animal | animal_type=poultry; identification_tag=P9; confidence=high | Animal registered locally. Tag P9 was saved as poultry. | Insert into local_animals; sync_status=pending | QA_REQUIRED |
| CMD-009 | Valid weight log | la vaca arete 302 pesó 520 kilos | register_weight | animal_type=cattle; identification_tag=302; weight_kg=520.0; confidence=high | Weight saved locally for tag 302 with 520 kilograms. | Insert into local_weight_logs if animal exists; sync_status=pending | DEMO_CRITICAL |
| CMD-010 | Valid weight log | res número 45 pesa 410 kg | register_weight | animal_type=cattle; identification_tag=45; weight_kg=410.0; confidence=high | Weight saved locally for tag 45 with 410 kilograms. | Insert into local_weight_logs if animal exists; sync_status=pending | DEMO_SAFE |
| CMD-011 | Valid weight log | cerdo arete 12 peso de 95 kilos | register_weight | animal_type=swine; identification_tag=12; weight_kg=95.0; confidence=high | Weight saved locally for tag 12 with 95 kilograms. | Insert into local_weight_logs if animal exists; sync_status=pending | QA_REQUIRED |
| CMD-012 | Valid weight log | pollo código P9 pesó 2,5 kilos | register_weight | animal_type=poultry; identification_tag=P9; weight_kg=2.5; confidence=high | Weight saved locally for tag P9 with 2.5 kilograms. | Insert into local_weight_logs if animal exists; sync_status=pending | QA_REQUIRED |
| CMD-013 | Edge weight log | gallina tag G15 pesa dos kilos | register_weight | animal_type=poultry; identification_tag=G15; weight_kg=2.0 if textual numbers are supported; confidence=medium | Weight saved locally for tag G15 with 2 kilograms, or ask for numeric value. | Insert if textual numbers are supported; otherwise do not save | EDGE_CASE |
| CMD-014 | Valid health record | la vaca arete 302 tiene fiebre | register_health_record | animal_type=cattle; identification_tag=302; symptoms_description=tiene fiebre; severity=high | Health alert saved for tag 302. Fever was detected as high priority. | Insert into local_health_records; sync_status=pending | DEMO_CRITICAL |
| CMD-015 | Valid health record | cerdo número 12 no quiere comer | register_health_record | animal_type=swine; identification_tag=12; symptoms_description=no quiere comer; severity=high | Health alert saved for tag 12. Loss of appetite was detected. | Insert into local_health_records; sync_status=pending | DEMO_SAFE |
| CMD-016 | Valid health record | gallina tag G15 tiene tos | register_health_record | animal_type=poultry; identification_tag=G15; symptoms_description=tiene tos; severity=medium | Health observation saved for tag G15. | Insert into local_health_records; sync_status=pending | QA_REQUIRED |
| CMD-017 | Valid health record | res arete 44 está coja | register_health_record | animal_type=cattle; identification_tag=44; symptoms_description=está coja; severity=medium | Health observation saved for tag 44. Mobility issue detected. | Insert into local_health_records; sync_status=pending | QA_REQUIRED |
| CMD-018 | Valid health record | toro código T20 tiene una herida profunda | register_health_record | animal_type=cattle; identification_tag=T20; symptoms_description=tiene una herida profunda; severity=high | Health alert saved for tag T20. A severe wound was detected. | Insert into local_health_records; sync_status=pending | DEMO_SAFE |
| CMD-019 | Valid task | se arregló la cerca del corral dos | register_task | task_description=se arregló la cerca del corral dos; confidence=high | Task saved locally: fence repaired in corral two. | Insert into local_tasks if implemented; otherwise mark as future-ready | ROADMAP |
| CMD-020 | Valid task | se bañó el ganado del lote tres | register_task | task_description=se bañó el ganado del lote tres; animal_type=cattle; confidence=high | Task saved locally: cattle bath in lot three. | Insert into local_tasks if implemented; otherwise mark as future-ready | ROADMAP |
| CMD-021 | Valid task | vacuné los pollos del galpón uno | register_task | task_description=vacuné los pollos del galpón uno; animal_type=poultry; confidence=high | Task saved locally: poultry vaccination in shed one. | Insert into local_tasks if implemented; otherwise mark as future-ready | ROADMAP |
| CMD-022 | Valid task | hice limpieza del corral principal | register_task | task_description=hice limpieza del corral principal; confidence=high | Task saved locally: main corral cleaning. | Insert into local_tasks if implemented; otherwise mark as future-ready | ROADMAP |
| CMD-023 | Incomplete animal registration | registra una vaca | register_animal | animal_type=cattle; identification_tag=null; missing_fields=[identification_tag] | Please tell me the animal tag number. | Do not save | DEMO_SAFE |
| CMD-024 | Incomplete animal registration | agrega un cerdo | register_animal | animal_type=swine; identification_tag=null; missing_fields=[identification_tag] | Please tell me the animal tag number. | Do not save | QA_REQUIRED |
| CMD-025 | Incomplete animal registration | registra arete 302 | register_animal or unknown | animal_type=null; identification_tag=302; missing_fields=[animal_type] | Please tell me if the animal is cattle, swine, or poultry. | Do not save | QA_REQUIRED |
| CMD-026 | Incomplete weight log | pesó 350 kilos | register_weight | identification_tag=null; weight_kg=350.0; missing_fields=[identification_tag] | Please tell me the animal tag number. | Do not save | DEMO_SAFE |
| CMD-027 | Incomplete weight log | la vaca arete 302 fue pesada | register_weight | identification_tag=302; weight_kg=null; missing_fields=[weight_kg] | Please tell me the weight value in kilograms. | Do not save | QA_REQUIRED |
| CMD-028 | Incomplete health record | tiene fiebre | register_health_record | identification_tag=null; symptoms_description=tiene fiebre; missing_fields=[identification_tag] | Please tell me the affected animal tag number. | Do not save | DEMO_SAFE |
| CMD-029 | Incomplete health record | la vaca arete 302 está enferma | register_health_record | identification_tag=302; symptoms_description=null or generic; missing_fields=[symptoms_description] | Please describe the symptoms observed in the animal. | Do not save until symptoms are clear | QA_REQUIRED |
| CMD-030 | Invalid command | quiero ver el clima | unknown | intent=unknown; confidence=low | I can help with farm records. Please repeat a livestock operation. | Do not save | QA_REQUIRED |
| CMD-031 | Invalid command | pon música | unknown | intent=unknown; confidence=low | I can help with farm records. Please repeat a livestock operation. | Do not save | QA_REQUIRED |
| CMD-032 | Assistant question | quién eres | assistant_response | No database fields expected | I am AURA, the intelligent livestock operations agent of FincApp. | Do not save | DEMO_CRITICAL |
| CMD-033 | Assistant question | puedes trabajar sin internet | assistant_response | No database fields expected | Yes. I can help register data locally and synchronize it when connectivity returns. | Do not save | DEMO_CRITICAL |
| CMD-034 | Ambiguous command | registra el animal | unknown or register_animal with missing fields | missing_fields=[animal_type, identification_tag] | Please tell me the animal type and tag number. | Do not save | EDGE_CASE |
| CMD-035 | Ambiguous command | anota eso | unknown | intent=unknown; confidence=low | Please tell me the farm operation you want to register. | Do not save | EDGE_CASE |

---

## 7. Stable Demo Command Set

| Demo Order | Command | Expected Result |
| --- | --- | --- |
| 1 | quién eres | AURA introduces itself |
| 2 | puedes trabajar sin internet | AURA explains offline-first behavior |
| 3 | registra una vaca con arete 302 | Saves local animal record |
| 4 | la vaca arete 302 pesó 520 kilos | Saves local weight log |
| 5 | la vaca arete 302 tiene fiebre | Saves local health record |
| 6 | pesó 350 kilos | AURA asks for missing animal tag |
| 7 | quiero ver el clima | AURA returns fallback and does not save |

Minimum stable demo flow:

1. Awaken AURA.
2. Ask: `quién eres`.
3. Put the device in airplane mode.
4. Say: `registra una vaca con arete 302`.
5. Say: `la vaca arete 302 pesó 520 kilos`.
6. Say: `la vaca arete 302 tiene fiebre`.
7. Show that records remain pending locally.
8. Restore internet and synchronize if backend is ready.

---

## 8. Manual Android QA Checklist

### Device Setup

- [ ] Android device connected or APK installed.
- [ ] Microphone permission granted.
- [ ] Text-To-Speech enabled.
- [ ] Spanish voice recognition working.
- [ ] Airplane mode tested.
- [ ] Local database initialized.

### AURA Voice Interaction

- [ ] AURA can be awakened.
- [ ] AURA introduces itself by voice.
- [ ] AURA listens through the microphone.
- [ ] AURA answers basic assistant questions.
- [ ] AURA does not display long spoken paragraphs.

### Parser Validation

- [ ] Valid animal registration commands are parsed correctly.
- [ ] Valid weight commands are parsed correctly.
- [ ] Valid health commands are parsed correctly.
- [ ] Incomplete commands return missing fields.
- [ ] Invalid commands return fallback behavior.

### SQLite Validation

- [ ] Valid animal records are saved locally.
- [ ] Valid weight logs are saved locally.
- [ ] Valid health records are saved locally.
- [ ] Incomplete commands are not saved.
- [ ] Invalid commands are not saved.
- [ ] Saved records use `sync_status = pending`.

---

## 9. Team Validation Responsibilities

| Team Member | Responsibility |
| --- | --- |
| Hugo | Owns this matrix, validates command coverage, and selects demo-safe commands |
| Santiago | Runs the matrix against the parser and confirms expected structured outputs |
| Juan Carlos | Tests selected commands on the Android physical device and validates SQLite behavior |
| José Miguel | Confirms local data fields are compatible with cloud database schema |
| Sergio | Confirms synchronized records will match backend DTO expectations |
| Juan Pablo | Validates AURA responses, tone, and safety language |

---

## 10. Definition of Done Checklist

- [x] Test matrix file exists.
- [x] At least 20 commands are documented.
- [x] Expected parser outputs are included.
- [x] Expected AURA responses are included.
- [x] Expected SQLite behavior is documented.
- [x] Incomplete commands include missing field behavior.
- [x] Invalid commands include fallback behavior.
- [x] At least 5 stable demo commands are clearly marked.
- [ ] Santiago validates parser outputs against the matrix.
- [ ] Juan Carlos validates Android device behavior.
- [ ] The team uses the matrix during final demo testing.

---

## 11. Notes for Jira Closure

This story can be moved to Done when:

1. The file is committed at:
   `fincapp-ai-data/edge-intelligence/aura_command_test_matrix.md`
2. The matrix contains at least 20 voice commands.
3. Santiago confirms the expected parser outputs are feasible.
4. Juan Carlos validates the selected demo commands on the Android app.
5. At least 5 commands are marked as demo-safe or demo-critical.
