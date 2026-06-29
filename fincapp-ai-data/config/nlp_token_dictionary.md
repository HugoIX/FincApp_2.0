# 📖 Edge NLP Lexical Token Dictionary & Intent Mapping

**Version:** 1.0.0  
**Author:** Hugo Perez (Lead Data Analyst)  
**Target Architecture:** Offline Natural Language Processing (Mobile Engine)  

---

## 1. Core Semantic Mapping Matrix

This matrix maps agricultural Spanish slang and common field vocal expressions into strongly-typed relational database columns.

| Target Database Table | Target Column | Input Token Keywords (Spanish Slang) | Data Type Constraint | Parsing & Extraction Rule Specification |
| :--- | :--- | :--- | :--- | :--- |
| `animals` | `identification_tag` | `arete`, `tag`, `código`, `número`, `marquilla`, `id`, `chapa` | `VARCHAR(50)` | **Rule 1 (Alphanumeric Capture):** Extract the immediate alphanumeric token following the keyword. Strip leading vowels or prepositions (e.g., "arete el **405B**" -> `"405B"`). |
| `weight_logs` | `weight_kg` | `peso`, `pesó`, `kilos`, `kg`, `pesando`, `masa` | `NUMERIC(6,2)` | **Rule 2 (Numeric Normalization):** Capture adjacent numeric value. If values are spoken as text (e.g., "cuatrocientos"), translate to digits before casting to float. Drop text units. |
| `health_records` | `symptoms_description`| `síntomas`, `enfermo`, `visto con`, `observación`, `nota`, `detalles` | `TEXT` | **Rule 3 (Greedy String Capture):** Isolate the trigger token and capture 100% of the trailing text characters until the audio recording stream terminates. |

---

## 2. Token Normalization Dictionary (Spanish text-to-number)

To support Santiago's local NER (Named Entity Recognition) pipeline, the following exact text-to-digit translations must be enforced by the local compiler:

* `"cero"` -> `0`
* `"uno"`, `"una"` -> `1`
* `"dos"` -> `2`
* `"tres"` -> `3`
* `"cuatro"` -> `4`
* `"cinco"` -> `5`
* `"seis"` -> `6`
* `"siete"` -> `7`
* `"ocho"` -> `8`
* `"nueve"` -> `9`
* `"diez"` -> `10`
* `"cien"`, `"ciento"` -> `100`
* `"quinientos"` -> `500`

---

## 3. Contextual Parsing Examples (Test Cases for QA)

1.  **Input:** *"Bovino con arete 105A pesó cuatrocientos cincuenta kilos"* **Output:** `{"identification_tag": "105A", "weight_kg": 450.00}`
2.  **Input:** *"Observación el animal del tag 24 tiene síntomas de tos severa y decaimiento"* **Output:** `{"identification_tag": "24", "symptoms_description": "tos severa y decaimiento"}`