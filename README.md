# FincApp Ecosystem: Multi-Tenant Intelligent Livestock Management

## 📌 Project Overview & Core Vision
FincApp is an enterprise-grade, cross-platform intelligent management ecosystem tailored for multi-tenant agricultural operations. Modern farm management suffers from critical data loss due to a dependency on manual paper tracking, non-existent connectivity in rural areas, and overly complex software interfaces that do not align with the educational backgrounds of field workers. 

FincApp addresses these friction points by implementing a robust **Offline-First transactional architecture** paired with an accessible **Edge-to-Cloud AI Interaction Layer (GanaBot)**. Field operators can record inventory, health, and logistical data using their voices naturally without cellular signal. When a connection becomes available, the system synchronizes automatically and triggers advanced analytical workflows, notifications, and cloud intelligence.

---

## 🎯 The Core Problem & Business Justification
*   **The Isolation Factor:** Rural deep-field enclosures lack stable internet. Traditional cloud-dependent SaaS solutions fail entirely in these environments.
*   **Multi-Business Complexity:** Agricultural entrepreneurs frequently operate multiple physical properties (farms) and diverse livestock segments (Cattle, Swine, Poultry) simultaneously. Existing market solutions lack flexible logical multi-tenancy.
*   **Operational Friction:** Traditional software demands heavy textual input. Field workers require a hands-free, high-accessibility UI driven by natural speech so they can focus on their physical tasks.

---

## 🏗️ Architectural Framework & Data Flow
FincApp relies on a split-plane structural design to achieve dependable offline tracking and intelligent cloud analytics:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                          EDGE LAYER (Offline)                          │
│                                                                        │
│  ┌─────────────────┐      ┌──────────────────┐      ┌──────────────┐   │
│  │ Native Java APK │ ───> │ Local NLP Engine │ ───> │ SQLite Cache │   │
│  └─────────────────┘      └──────────────────┘      └──────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                       (Internet Signal Detected)
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         CLOUD LAYER (Online)                          │
│                                                                        │
│  ┌──────────────────┐     ┌──────────────────┐     ┌────────────────┐  │
│  │ n8n Orchestration│ ──> │ Advanced LLMs    │ ──> │ PostgreSQL     │  │
│  │ (Ingestion Node) │     │ (Gemini/DeepSeek)│     │ (Supabase DB)  │  │
│  └──────────────────┘     └──────────────────┘     └────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘

```

1. **Edge Layer (Client-Side / Local Corral):** Written natively, hosting an embedded SQLite database. Audio inputs are processed locally through lightweight speech-to-text parsers to extract inventory properties without hitting external networks.
2. **Cloud Layer (Server-Side / Synchronization):** When internet is restored, a local synchronization queue fires state changes to a centralized C# REST API. Concurrently, **n8n** intercepts operational data packets, utilizing cloud LLMs to process complex veterinarian symptoms, evaluate images, and send business alerts to owners via automated communication channels.

---

## 📁 Repository Directory Structure

The repository is managed as a unified workspace partitioned strictly by route specialization to support parallel development workflows:

```text
fincapp-ecosystem/
│
├── fincapp-backend/               # REST API Framework (.NET Core / C# Route)
│   ├── src/                       
│   │   ├── FincApp.API/           # HTTP Request Controllers & Endpoints
│   │   ├── FincApp.Core/          # Multi-tenant Business Rules & Domain Entities
│   │   └── FincApp.Infrastructure/# EF Core DB Context & Migrations Data Access
│   └── Dockerfile                 # Container setup for reproducible cloud deployment
│
├── fincapp-frontend/              # Presentation Interfaces
│   └── mobile-app/                # Client APK Environment (Native Java Route)
│       └── app/src/main/          # Accessible UIs & Offline SQLite database engines
│
├── fincapp-ai-data/               # Intelligent Sub-Systems & Data Pipelines
│   ├── database/                  # Data Engineering & Physical Schema definitions
│   │   ├── schema.sql             # Relational Baseline Structure (PostgreSQL DDL)
│   │   └── analytical-views.sql   # Aggregate Reporting SQL Views
│   ├── edge-intelligence/         # Local NLP Models & Audio processing tools
│   └── cloud-automation/          # n8n Automated Workflows & LLM Prompts
└── README.md

```

---

## 👥 Strategic Team Roles & Responsibilities

The project is executed in parallel by an agile engineering team under a strict Scrum framework:

* **Hugo (Scrum Master & Lead Data Analyst):** Manages project governance, GitFlow branch protections, and conceptual multi-tenant relational modeling.
* **José Miguel (Data Engineer & Analyst):** Deploys physical cloud architecture in Supabase, manages database constraints, and structures analytical data views.
* **Sergio (Backend Developer & DevOps):** Engineers the C# .NET Core REST API, builds database migrations, and containerizes environments via Docker.
* **Juan Carlos (Mobile Developer & QA):** Directs native Android Java implementation, coordinates offline SQLite storage caches, and manages UI accessibility benchmarks.
* **Santiago (AI Edge Developer):** Builds local audio processing layers and offline NLP intent extraction modules for remote field usage.
* **Juan Pablo (AI Cloud Orchestrator):** Configures n8n workflows, prompt engineering frameworks, and connects external LLM and messaging gateways.

---

## 🛠️ Technological Stack

* **Database Foundations:** PostgreSQL (Cloud Instance hosted via Supabase), SQLite (Local Mobile Client Storage Cache).
* **Backend Server Infrastructure:** C# .NET Core Web API with Entity Framework Core ORM.
* **Client Architecture:** Native Java Android SDK.
* **Automation & Artificial Intelligence:** n8n Workflow Automation, Google Gemini/DeepSeek API Gateways, Vosk/Edge-Whisper local speech components.
* **DevOps & Governance:** Docker, Docker Compose, GitFlow Workflow Strategy, Jira Software.

---

## 📈 Applicability & Target Market Impact

FincApp scales dynamically across small, medium, and industrial livestock sectors:

* **Independent Farmers:** Gain access to enterprise tracking tools using an interface that requires no technical background.
* **Multi-Property Administrators:** Oversee distinct, geographically separate operations from a single application session while enforcing strict logical data isolation.
* **Veterinary & Asset Auditing:** Automate the auditing of historical weight gains, healthcare records, and stock inventory valuation through AI-driven cloud summaries.

---

## ⚙️ GitFlow & Contribution Rules (For Developers)

As enforced by Scrum Governance, contributors must follow these execution policies:

1. **Branch Restrictions:** Direct pushes to `main` and `develop` are blocked. Feature implementations must run on explicit branches: `feature/us-[ticket_id]-[scope]`.
2. **Commit Message Conventions:** All commit text must be written 100% in English following standard prefix conventions:
* `feat(scope):` For new application behaviors.
* `fix(scope):` For code corrections.
* `docs(scope):` For documentation adjustments.


3. **Peer Validation:** A Pull Request requires at least one peer validation check before integration into the `develop` trunk.

```
---