# ForgeAI — AI-Native Connected Worker Platform

> Turn your SOPs, manuals, and expert knowledge into an on-demand AI assistant for every frontline worker.

ForgeAI is an AI-native knowledge platform built for SMBs. It ingests company SOPs, equipment manuals, training documents, and expert walkthrough videos, builds a searchable knowledge base via Retrieval-Augmented Generation (RAG), and delivers contextual AI assistance to frontline workers — right on their mobile device, hands-free, at the moment of need.

---

## The Problem

Frontline workers in environments like datacenters, RF testing labs, and manufacturing floors constantly face the same challenge: critical knowledge is locked in binders, trapped in tribal expertise, or in the heads of senior staff who aren't always available. Mistakes happen, rework is costly, and onboarding new technicians takes months.

## The Solution

ForgeAI converts your existing documentation and expert knowledge into an intelligent, always-available AI assistant:

- **Upload** PDFs, DOCX files, images, audio, and expert walkthrough videos
- **AI processes** documents and videos into a semantic knowledge base (RAG)
- **Workers query** via natural language chat — typed or voice — on mobile
- **Guided procedures** walk workers step-by-step through complex tasks with built-in safety warnings and contextual AI answers

---

## Core Features

| Feature | Description |
|---|---|
| **Document Ingestion** | Upload PDFs, DOCX, images, audio/video → AI-parsed → embedded → RAG-queryable |
| **Expert Capture** | Record expert walkthroughs → Gemini 2.0 Flash analyzes video + audio → Claude Sonnet synthesizes structured knowledge |
| **Worker Chat** | Streaming GPT-4o chat with RAG context, source attribution, full chat history |
| **Guided Procedures** | Step-by-step interactive walkthroughs with safety warnings, audio TTS, voice navigation, and in-step AI chat |
| **Voice Q&A** | Whisper transcription + GPT-4o answers — ask questions without putting down your tools |
| **Camera Capture** | Photograph equipment for AI-assisted identification and guidance from company docs |
| **Admin Dashboard** | Document management, worker invites, expert capture status, Q&A and procedure review |
| **Mobile PWA** | iOS-first installable PWA with offline fallback — works in server rooms and RF chambers |
| **Multi-Tenant** | Full org isolation — documents, workers, and chat history are scoped per organization |

---

## User Stories

### Datacenter Operations

**As a datacenter technician,** I want to access step-by-step guided procedures for server rack installation on my mobile device, so I can follow along hands-free while working in the server room without stopping to consult a paper manual.

**As a datacenter admin,** I want to upload expert walkthrough videos of critical procedures — such as hot-swap drive replacement, structured cabling runs, and UPS load transfers — so the AI can extract structured knowledge and make it available to all shift technicians automatically.

**As a datacenter technician,** I want to ask voice questions mid-procedure (e.g., "What torque spec should I use for this rail kit?") and get immediate AI answers grounded in company SOPs, so I can resolve uncertainty without leaving the rack or calling a senior engineer.

**As a datacenter manager,** I want to track which guided procedures each worker has completed and how far they have progressed, so I can ensure compliance, maintain audit trails, and identify training gaps before they become incidents.

**As a new datacenter employee,** I want to browse a searchable library of guided procedures — server provisioning, network switch configuration, cooling unit maintenance — so I can find the correct procedure for any task on my first day without supervisor hand-holding.

**As a datacenter technician,** I want to receive contextual safety warnings during critical steps — ESD precautions before touching memory DIMMs, live-circuit advisories before working near PDUs, lockout-tagout reminders for power systems — so the platform actively helps me avoid equipment damage or personal injury.

**As a datacenter admin,** I want to upload OEM equipment manuals and vendor datasheets as standard documents, so technicians can instantly query specifications, part numbers, compatibility matrices, and troubleshooting steps via AI chat rather than hunting through hundred-page PDFs.

**As a datacenter technician,** I want to photograph an unfamiliar component or cable with my phone camera and get AI-assisted identification and guidance drawn from company documentation, so I can correctly handle equipment I haven't encountered before.

**As a datacenter manager,** I want to invite technicians to the platform via email with role-based access control, so only authorized personnel can access sensitive infrastructure procedures and proprietary configuration documentation.

**As a datacenter technician,** I want to resume an interrupted guidance session from the exact step where I left off — after a priority incident pulls me away mid-task — so I can return to the procedure without losing my place or rechecking completed steps.

**As a datacenter site reliability engineer,** I want to upload incident post-mortems and runbooks as knowledge documents, so the AI can surface relevant prior incident context when technicians describe similar symptoms during future troubleshooting sessions.

**As a datacenter operations lead,** I want workers to capture photos of rack configurations and cable patching during installation, so the AI can compare the physical state against documented standards and flag discrepancies before sign-off.

---

### RF Testing & Lab Operations

**As an RF test engineer,** I want to upload expert videos of experienced engineers performing complex test setups — S-parameter measurements, antenna pattern sweeps, conducted emissions scans — so the AI can generate searchable, step-by-step guided procedures that junior technicians can follow independently.

**As an RF technician,** I want to follow AI-guided procedures for equipment calibration — VNA SOLT calibration, spectrum analyzer reference level setup, power sensor calibration — with safety warnings for high-power RF environments, so I can perform tests correctly and avoid damaging sensitive equipment.

**As an RF lab manager,** I want to upload compliance testing standards — FCC Part 15, CE RED, ETSI EN 300 328 — as knowledge base documents, so technicians can ask natural language questions about test limits, measurement bandwidths, and required setups rather than hunting through dense regulatory text.

**As an RF technician,** I want to ask voice questions during an active test procedure — "What is the reference impedance for this two-port measurement?" or "Should I apply a correction factor here?" — without setting down my test cable or breaking my RF connection, so I can get answers with minimal measurement disruption.

**As an RF engineer,** I want to query uploaded calibration certificates and historical test reports via AI chat, so I can rapidly cross-reference prior measurements and equipment uncertainty budgets when diagnosing unexpected test results.

**As an RF technician working in an anechoic chamber,** I want to access guided procedures on a mobile PWA that works offline, so I can follow the device positioning and test setup procedure even inside a shielded room where network connectivity is unreliable.

**As an RF test lab admin,** I want to organize knowledge documents and guided procedures by project, test type, or regulatory standard, so the knowledge base remains navigable and searchable as the library of test procedures and documentation grows over time.

**As an RF technician,** I want to photograph my bench test setup with the in-app camera and get AI validation against the documented connection diagram — checking cable routing, port assignments, and attenuator placement — so I can verify my setup before committing to a long-running test sweep.

**As an RF engineer onboarding a new technician,** I want to record a walkthrough video of a novel antenna measurement fixture and have the platform automatically generate a structured guided procedure from it, so I only have to demonstrate the process once and it becomes permanently available to all future technicians.

**As an RF lab manager,** I want to track technician progress through multi-session, multi-day testing procedures — pre-compliance screening, formal certification testing, regression suites — so I can maintain accurate audit logs and demonstrate procedural compliance to certification bodies and customers.

**As an RF test engineer,** I want to upload audio recordings of verbal expert commentary during complex test setups, so the AI can transcribe and index the spoken knowledge and make it queryable by technicians who were not present for the original session.

**As a defense RF systems integrator,** I want to upload equipment integration guides and interference mitigation procedures, so field technicians on deployment can access AI-guided troubleshooting for RF frequency conflicts without needing connectivity to a central office.

### Automotive Manufacturing

**As an assembly line team member,** I want to access the current standardized work sheet for my station on my mobile device, so I can instantly verify the correct operation sequence, torque specifications, and quality checkpoints without leaving my station to find a binder or ask my team leader.

**As a maintenance technician,** I want to look up the exact lockout/tagout procedure for a specific machine by equipment ID, so I can safely isolate all energy sources — electrical, pneumatic, hydraulic — before performing repairs, without memorizing hundreds of unique LOTO sequences across the plant.

**As a body shop quality inspector,** I want to photograph a suspect weld and ask the AI whether it meets the OEM weld standard, so I can make an accept/reject decision within my 55-second inspection window without waiting for a quality engineer to walk over.

**As a plant maintenance technician,** I want to query uploaded FANUC, KUKA, or ABB robot manuals by fault code number, so I can immediately understand the root cause and corrective action for a robot alarm at 2:00 AM without waiting for a specialist to arrive.

**As an assembly team leader,** I want to receive AI-summarized engineering change notices and query which VINs are affected by a specific ECN, so I can brief my team at shift startup and ensure the correct procedure is applied to every vehicle from the effective changeover point.

**As a paint shop PDR operator,** I want to photograph a paint defect on a vehicle and ask the AI for the accept/reject criteria by panel location, so I can determine whether to buff out, spot-repair, or escalate to a full respray — without consulting a separate reference binder.

**As a press operator,** I want to query the first-off inspection requirements after a die change — dimensions, tolerances, acceptance criteria — so I can complete the first-off form correctly and release production without waiting for a quality technician to locate the control plan.

**As a new assembly line worker,** I want to watch expert capture videos of experienced assemblers performing each station's operations, so I can build correct muscle memory before going live on the line — reducing the risk of quality escapes during the first days on a new station.

**As a skilled trades electrician,** I want to ask voice questions mid-repair about a specific machine's wiring diagram or hydraulic schematic, so I can confirm the correct circuit or valve sequence without putting down tools or climbing out of a pit to access a terminal.

**As a quality technician conducting layered process audits,** I want to query the AI for the critical characteristic fasteners at a given station and their required torque values, so I can ask targeted LPA questions and immediately identify whether workers know the CC from standard fasteners.

**As an assembly plant training coordinator,** I want to upload expert walkthrough videos of veteran assemblers performing complex multi-variant procedures, so the AI extracts structured knowledge that remains accessible after the expert retires or transfers — preventing the loss of tribal knowledge.

**As a worker at a chassis assembly station,** I want to ask the AI "which procedure applies to this vehicle?" by scanning the build sheet or VIN barcode, so I can instantly pull the correct torque specs and operation sequence for the specific powertrain, trim level, and option content — without misapplying an old-model or wrong-variant procedure.

**As a maintenance planner,** I want to upload OEM equipment manuals for stamping presses, conveyors, and robotic weld cells so technicians can query PM task lists, lubrication specifications, and calibration intervals by equipment ID, reducing reliance on aging paper binders and printed lube charts.

**As a new model introduction (NMI) launch coordinator,** I want to upload draft work instructions and have workers query the AI for the latest procedure for each station, so that during the daily ECN churn of a vehicle launch — when procedures change multiple times per week — workers always access the current version rather than a superseded one.

**As a worker in a paint shop adhesive application area,** I want to instantly retrieve the safety data sheet for any chemical container by scanning its label or asking by product name, so I can access first aid measures, required PPE, and spill containment steps within seconds of an exposure — meeting OSHA SDS access requirements without hunting for a binder.

**As an end-of-line test technician,** I want to query the alignment specification, headlamp aiming tolerance, or ADAS calibration target distance for the specific vehicle model and trim currently on my station, so I can confirm pass/fail criteria without consulting a separate spec book for each model variant.

**As a body shop team leader,** I want to upload weld standards and visual defect reference documents so workers can query defect descriptions — expulsion, insufficient nugget, burn-through — with accept/reject criteria and reaction plans, enabling faster inline quality decisions without waiting for a quality engineer.

**As an assembly plant operations manager,** I want frontline workers to capture photos of completed work at safety-critical stations — torque verification, seal application, brake line routing — so the AI can compare against the documented standard and flag non-conformances before the vehicle advances to the next station.

**As a material handler,** I want to ask the AI which part number should be loaded at a given station for the current vehicle build, so I can verify I've pulled the correct component after an engineering change or part supersession — preventing quality escapes caused by loading a superseded part.

**As an assembly line worker returning after summer shutdown,** I want to access guided procedures for my restaffed station that highlight what changed from the previous model year — new torque values, revised sequences, different fastener types — so I can quickly internalize the changes before production restarts without relying solely on a brief team leader briefing.

---

## Tech Stack

- **Frontend**: Next.js 16 (App Router) + shadcn/ui + Tailwind CSS
- **AI**: OpenAI GPT-4o (chat + vision), Whisper (voice), text-embedding-3-small (RAG) | Google Gemini 2.0 Flash (video analysis) | Anthropic Claude Sonnet (knowledge synthesis)
- **Database**: PostgreSQL + pgvector (Neon) via Prisma 7
- **Auth**: NextAuth.js v5
- **Storage**: Vercel Blob
- **PWA**: Serwist service worker (iOS-first)

---

## Getting Started

```bash
npm install
npm run db:setup   # migrate + seed
npm run dev        # starts dev server (Turbopack)
```

Test credentials (seed data):
- **Admin**: admin@acme.com / admin123
- **Worker**: worker@acme.com / worker123
- **Org**: Acme Manufacturing

See [CLAUDE.md](./CLAUDE.md) for full architecture documentation, known issues, and deployment notes.
