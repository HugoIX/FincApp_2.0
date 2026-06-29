# AURA Livestock Lexical Dictionary

**Project:** FincApp 2.0 — Powered by AURA  
**User Story:** US-03 — AURA Livestock Lexical Dictionary  
**Owner:** Hugo  
**Target module:** `fincapp-ai-data/edge-intelligence/`  
**Version:** 1.0  
**Language standard:** English architecture definitions mapping Spanish rural livestock expressions.

---

## 1. Purpose

This document defines the official lexical dictionary that AURA will use to map rural Spanish livestock expressions into standardized system fields.

The dictionary is designed for the local intent parser that runs on the Android application. Its goal is to help AURA understand field commands without depending on cloud AI or internet connectivity.

The dictionary must be used by:

- **Santiago:** to implement the local parser and rule-based NLP extraction.
- **Juan Carlos:** to validate Android voice behavior and local persistence.
- **Hugo:** to validate data consistency and command examples.
- **Sergio / José Miguel:** to confirm compatibility with backend and database fields.

---

## 2. Standard Output Contract

The parser must convert recognized speech into this normalized structure:

```json
{
  "intent": "register_animal | register_weight | register_health_record | register_task | unknown",
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

## 3. Target Database Field Mapping

| Business Meaning | Parser Output Field | Cloud Database Table | Cloud Database Column | Local SQLite Target | Data Type |
|---|---|---|---|---|---|
| Animal production line | `animal_type` | `animals` | `type` | `local_animals.type` | TEXT / ENUM |
| Animal identification | `identification_tag` | `animals` | `identification_tag` | `local_animals.identification_tag` | TEXT |
| Weight value | `weight_kg` | `weight_logs` | `weight_kg` | `local_weight_logs.weight_kg` | DECIMAL / REAL |
| Health symptoms | `symptoms_description` | `health_records` | `symptoms_description` | `local_health_records.symptoms_description` | TEXT |
| Field task | `task_description` | `field_tasks` or future task table | `description` | `local_tasks.description` | TEXT |
| Medical urgency | `severity` | `health_records` | `severity` or future field | `local_health_records.severity` | TEXT |
| Synchronization state | `sync_status` | Not required in parser output | Not persisted directly in cloud | Local tables / sync queue | TEXT |

---

## 4. Intent Dictionary

| Intent | Meaning | Main Trigger Words | Required Fields | Optional Fields |
|---|---|---|---|---|
| `register_animal` | Register a new animal | registrar, registra, agregar, agrega, crear, nuevo, nueva, añadir | `animal_type`, `identification_tag` | `status` |
| `register_weight` | Register an animal weight log | peso, pesa, pesó, pesado, pesar, kilos, kg | `identification_tag`, `weight_kg` | `animal_type` |
| `register_health_record` | Register a health observation | enfermo, enferma, síntoma, sintomas, síntomas, fiebre, herida, cojo, cojera, tos | `identification_tag`, `symptoms_description` | `severity`, `animal_type` |
| `register_task` | Register a field operation or completed task | tarea, actividad, trabajo, hizo, se hizo, arregló, baño, bañó, vacunó, limpieza | `task_description` | `animal_type`, `identification_tag` |
| `unknown` | Command not recognized | N/A | N/A | N/A |

---

## 5. Animal Type Synonym Matrix

### 5.1 Cattle

Normalized output value: `cattle`

| Spanish / Rural Term | Normalized Value | Notes |
|---|---|---|
| ganado | cattle | General cattle reference |
| res | cattle | Common field term |
| vaca | cattle | Female cattle |
| toro | cattle | Male cattle |
| ternero | cattle | Calf |
| ternera | cattle | Female calf |
| novillo | cattle | Young male cattle |
| novilla | cattle | Young female cattle |
| bovino | cattle | Technical term |
| bovina | cattle | Technical term |
| becerro | cattle | Calf / young animal |
| becerra | cattle | Female calf |

### 5.2 Swine

Normalized output value: `swine`

| Spanish / Rural Term | Normalized Value | Notes |
|---|---|---|
| cerdo | swine | Standard term |
| cerda | swine | Female pig |
| porcino | swine | Technical term |
| porcina | swine | Technical term |
| puerco | swine | Common rural term |
| puerca | swine | Common rural term |
| marrano | swine | Common Colombian rural term |
| marrana | swine | Common Colombian rural term |
| lechón | swine | Young pig |
| lechona | swine | Young female pig |

### 5.3 Poultry

Normalized output value: `poultry`

| Spanish / Rural Term | Normalized Value | Notes |
|---|---|---|
| pollo | poultry | Chicken / broiler |
| pollos | poultry | Plural |
| gallina | poultry | Hen |
| gallinas | poultry | Plural |
| gallo | poultry | Rooster |
| aves | poultry | General poultry reference |
| ave | poultry | Singular |
| ponedora | poultry | Laying hen |
| ponedoras | poultry | Laying hens |
| corral de aves | poultry | Group reference |

---

## 6. Identification Tag Synonyms

Target output field: `identification_tag`

| Spanish / Field Term | Target Field | Parsing Rule |
|---|---|---|
| arete | `identification_tag` | Extract the alphanumeric token immediately after the keyword |
| número | `identification_tag` | Extract the next numeric or alphanumeric token |
| numero | `identification_tag` | Same as `número` without accent |
| código | `identification_tag` | Extract the next token |
| codigo | `identification_tag` | Same as `código` without accent |
| tag | `identification_tag` | Extract the next token |
| id | `identification_tag` | Extract the next token |
| identificación | `identification_tag` | Extract the next token |
| identificacion | `identification_tag` | Same as `identificación` without accent |
| placa | `identification_tag` | Extract the next token |
| marquilla | `identification_tag` | Extract the next token |
| chapeta | `identification_tag` | Extract the next token |
| serial | `identification_tag` | Extract the next token |

### Identification Parsing Examples

| Input Fragment | Expected Output |
|---|---|
| arete 302 | `identification_tag = "302"` |
| número 15 | `identification_tag = "15"` |
| codigo A45 | `identification_tag = "A45"` |
| tag COW-20 | `identification_tag = "COW-20"` |
| marquilla 88B | `identification_tag = "88B"` |

---

## 7. Weight Recognition Terms

Target output field: `weight_kg`

| Spanish / Field Term | Target Field | Parsing Rule |
|---|---|---|
| peso | `weight_kg` | Capture the nearest numeric value |
| pesa | `weight_kg` | Capture the nearest numeric value |
| pesó | `weight_kg` | Capture the nearest numeric value |
| peso de | `weight_kg` | Capture the following numeric value |
| pesando | `weight_kg` | Capture the nearest numeric value |
| kilos | `weight_kg` | Capture the nearest numeric value before the unit |
| kilo | `weight_kg` | Capture the nearest numeric value before the unit |
| kg | `weight_kg` | Capture the nearest numeric value before the unit |
| kilogramos | `weight_kg` | Capture the nearest numeric value before the unit |
| pesada | `weight_kg` | Detect weighing event; ask for value if missing |
| pesaje | `weight_kg` | Detect weighing event; ask for value if missing |

### Weight Parsing Rules

1. Prefer numbers located after weight verbs: `pesó 520 kilos`.
2. If no number appears after the verb, search before the unit: `520 kg`.
3. Accept integer values: `520`.
4. Accept decimal values with dot or comma: `520.5`, `520,5`.
5. Normalize comma decimals to dot decimals.
6. Remove unit words before storing the value.
7. Store all values as kilograms.

### Weight Parsing Examples

| Input Fragment | Expected Output |
|---|---|
| pesó 520 kilos | `weight_kg = 520.0` |
| pesa 410 kg | `weight_kg = 410.0` |
| peso de 380 | `weight_kg = 380.0` |
| 450 kilos | `weight_kg = 450.0` |
| pesó 312,5 kilos | `weight_kg = 312.5` |

---

## 8. Health Symptom Dictionary

Target output field: `symptoms_description`  
Optional output field: `severity`

### 8.1 General Health Triggers

| Spanish / Field Term | Intent | Target Field |
|---|---|---|
| enfermo | `register_health_record` | `symptoms_description` |
| enferma | `register_health_record` | `symptoms_description` |
| síntoma | `register_health_record` | `symptoms_description` |
| sintomas | `register_health_record` | `symptoms_description` |
| síntomas | `register_health_record` | `symptoms_description` |
| observado | `register_health_record` | `symptoms_description` |
| observación | `register_health_record` | `symptoms_description` |
| observacion | `register_health_record` | `symptoms_description` |
| revisión | `register_health_record` | `symptoms_description` |
| revision | `register_health_record` | `symptoms_description` |
| diagnóstico | `register_health_record` | `symptoms_description` |
| diagnostico | `register_health_record` | `symptoms_description` |

### 8.2 Symptom Terms by Severity

| Symptom Term | Suggested Severity | Notes |
|---|---|---|
| fiebre | high | Requires attention |
| sangre | high | Possible injury or serious condition |
| sangrado | high | Possible injury |
| herida profunda | high | Urgent health observation |
| no come | high | Loss of appetite |
| no quiere comer | high | Loss of appetite |
| dificultad para respirar | high | Respiratory alert |
| diarrea | medium | Health issue |
| vómito | medium | Health issue |
| vomito | medium | Health issue |
| tos | medium | Respiratory symptom |
| cojo | medium | Mobility issue |
| coja | medium | Mobility issue |
| cojera | medium | Mobility issue |
| inflamado | medium | Inflammation |
| inflamación | medium | Inflammation |
| inflamacion | medium | Inflammation |
| decaído | medium | Low activity |
| decaido | medium | Low activity |
| débil | medium | Weakness |
| debil | medium | Weakness |
| rasguño | low | Minor injury |
| golpe | low | Minor trauma |
| irritación | low | Minor health observation |
| irritacion | low | Minor health observation |

### Health Parsing Rule

When a health trigger is detected, the parser should capture the remaining meaningful sentence as `symptoms_description`, excluding the identification keyword and tag when possible.

Example:

Input:
`la vaca arete 302 tiene fiebre y no quiere comer`

Expected output:
```json
{
  "intent": "register_health_record",
  "animal_type": "cattle",
  "identification_tag": "302",
  "symptoms_description": "tiene fiebre y no quiere comer",
  "severity": "high"
}
```

---

## 9. Field Task Dictionary

Target output field: `task_description`

| Spanish / Field Term | Intent | Target Field |
|---|---|---|
| tarea | `register_task` | `task_description` |
| actividad | `register_task` | `task_description` |
| trabajo | `register_task` | `task_description` |
| se hizo | `register_task` | `task_description` |
| hice | `register_task` | `task_description` |
| completé | `register_task` | `task_description` |
| complete | `register_task` | `task_description` |
| arreglé | `register_task` | `task_description` |
| arregle | `register_task` | `task_description` |
| reparé | `register_task` | `task_description` |
| repare | `register_task` | `task_description` |
| bañé | `register_task` | `task_description` |
| bañe | `register_task` | `task_description` |
| bañó | `register_task` | `task_description` |
| baño | `register_task` | `task_description` |
| vacuné | `register_task` | `task_description` |
| vacune | `register_task` | `task_description` |
| vacunó | `register_task` | `task_description` |
| limpieza | `register_task` | `task_description` |
| cerca | `register_task` | `task_description` |
| corral | `register_task` | `task_description` |
| alimento | `register_task` | `task_description` |

### Task Parsing Examples

| Input Phrase | Expected Output |
|---|---|
| se arregló la cerca del corral dos | `task_description = "se arregló la cerca del corral dos"` |
| se bañó el ganado del lote tres | `task_description = "se bañó el ganado del lote tres"` |
| vacuné los pollos del galpón uno | `task_description = "vacuné los pollos del galpón uno"` |
| hice limpieza del corral principal | `task_description = "hice limpieza del corral principal"` |

---

## 10. Parser Priority Rules

When a phrase contains multiple triggers, the parser must resolve the intent using this priority order:

1. `register_health_record` if a health symptom or disease trigger is detected.
2. `register_weight` if a weight value or weight trigger is detected.
3. `register_animal` if a registration trigger and animal type are detected.
4. `register_task` if a task/action trigger is detected and no animal-specific operation dominates.
5. `unknown` if no meaningful operation is detected.

### Example

Input:
`registra la vaca arete 302 con fiebre y peso 520 kilos`

Recommended output:
```json
{
  "intent": "register_health_record",
  "animal_type": "cattle",
  "identification_tag": "302",
  "weight_kg": 520.0,
  "symptoms_description": "fiebre",
  "severity": "high",
  "confidence": "high"
}
```

Reason: Health alerts must have priority because they may represent animal welfare risk.

---

## 11. Required Fields by Intent

| Intent | Required Fields | Recovery Question if Missing |
|---|---|---|
| `register_animal` | `animal_type`, `identification_tag` | “Please tell me the animal type and tag number.” |
| `register_weight` | `identification_tag`, `weight_kg` | “Please tell me the animal tag and weight.” |
| `register_health_record` | `identification_tag`, `symptoms_description` | “Please tell me the affected animal tag and symptoms.” |
| `register_task` | `task_description` | “Please describe the task completed in the farm.” |

---

## 12. Minimum Demo Command Matrix

The following phrases must be supported or used as parser test cases.

| # | Spanish Voice Command | Expected Intent | Expected Main Fields |
|---|---|---|---|
| 1 | registra una vaca con arete 302 | `register_animal` | `animal_type=cattle`, `identification_tag=302` |
| 2 | agrega una res número 45 | `register_animal` | `animal_type=cattle`, `identification_tag=45` |
| 3 | nuevo toro con código T20 | `register_animal` | `animal_type=cattle`, `identification_tag=T20` |
| 4 | registra un cerdo con arete 12 | `register_animal` | `animal_type=swine`, `identification_tag=12` |
| 5 | agrega un marrano número 88 | `register_animal` | `animal_type=swine`, `identification_tag=88` |
| 6 | registra una gallina tag G15 | `register_animal` | `animal_type=poultry`, `identification_tag=G15` |
| 7 | registra un pollo código P9 | `register_animal` | `animal_type=poultry`, `identification_tag=P9` |
| 8 | la vaca arete 302 pesó 520 kilos | `register_weight` | `identification_tag=302`, `weight_kg=520.0` |
| 9 | res número 45 pesa 410 kg | `register_weight` | `identification_tag=45`, `weight_kg=410.0` |
| 10 | cerdo arete 12 peso de 95 kilos | `register_weight` | `identification_tag=12`, `weight_kg=95.0` |
| 11 | pollo código P9 pesó 2,5 kilos | `register_weight` | `identification_tag=P9`, `weight_kg=2.5` |
| 12 | la vaca arete 302 tiene fiebre | `register_health_record` | `identification_tag=302`, `severity=high` |
| 13 | cerdo número 12 no quiere comer | `register_health_record` | `identification_tag=12`, `severity=high` |
| 14 | gallina tag G15 tiene tos | `register_health_record` | `identification_tag=G15`, `severity=medium` |
| 15 | res arete 44 está coja | `register_health_record` | `identification_tag=44`, `severity=medium` |
| 16 | toro código T20 tiene una herida profunda | `register_health_record` | `identification_tag=T20`, `severity=high` |
| 17 | se arregló la cerca del corral dos | `register_task` | `task_description=se arregló la cerca del corral dos` |
| 18 | se bañó el ganado del lote tres | `register_task` | `task_description=se bañó el ganado del lote tres` |
| 19 | vacuné los pollos del galpón uno | `register_task` | `task_description=vacuné los pollos del galpón uno` |
| 20 | hice limpieza del corral principal | `register_task` | `task_description=hice limpieza del corral principal` |
| 21 | registra una vaca | `register_animal` with missing field | `missing_fields=[identification_tag]` |
| 22 | pesó 350 kilos | `register_weight` with missing field | `missing_fields=[identification_tag]`, `weight_kg=350.0` |
| 23 | tiene fiebre | `register_health_record` with missing field | `missing_fields=[identification_tag]` |
| 24 | quiero ver el clima | `unknown` | `intent=unknown` |
| 25 | hola aura cómo estás | `unknown` or assistant small talk | No livestock operation |

---

## 13. Normalization Rules

Before parsing, the text must be normalized:

1. Convert to lowercase.
2. Remove punctuation that does not affect values.
3. Normalize accents when useful:
   - `código` -> `codigo`
   - `número` -> `numero`
   - `síntoma` -> `sintoma`
4. Normalize decimal comma to decimal dot:
   - `2,5` -> `2.5`
5. Trim duplicated spaces.
6. Preserve alphanumeric tags:
   - `T20`
   - `G15`
   - `COW-302`
7. Do not translate stored symptom descriptions unless required by a later cloud AI workflow.

---

## 14. Parser Feasibility Notes for Santiago

Recommended first implementation strategy:

1. Normalize input text.
2. Detect intent using keyword groups.
3. Extract animal type using synonym lookup.
4. Extract identification tag using regex after tag keywords.
5. Extract weight using regex near weight keywords or unit keywords.
6. Extract health symptoms using trigger-based substring capture.
7. Extract task description from task/action triggers.
8. Validate required fields by intent.
9. Return structured output with `missing_fields` and `confidence`.

### Suggested Regex Concepts

Identification tag:
```regex
(?:arete|numero|número|codigo|código|tag|id|marquilla|chapeta|placa)\\s+([A-Za-z0-9\\-]+)
```

Weight:
```regex
(\\d+(?:[\\.,]\\d+)?)\\s*(?:kilos|kg|kilogramos|kilo)
```

Alternative weight after verb:
```regex
(?:peso|pesa|pesó|peso de|pesando)\\s+(\\d+(?:[\\.,]\\d+)?)
```

---

## 15. Definition of Done Checklist

- [x] Dictionary file exists.
- [x] Terms are mapped to database columns.
- [x] Animal type synonyms include cattle, swine, and poultry.
- [x] Identification synonyms include arete, número, codigo, código, tag, id, and similar expressions.
- [x] Weight terms include peso, pesó, pesa, kilos, kg, and related terms.
- [x] Health terms include common symptoms and severity-related expressions.
- [x] At least 20 example phrases are included.
- [x] File is written in English.
- [ ] Santiago confirms that the dictionary can be converted into parser rules.
