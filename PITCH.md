# ForgeAI — AI Guidance for Physical Work

## One-liner

ForgeAI turns expert walkthrough videos into real-time, voice-guided procedures that coach frontline workers step-by-step through any physical task.

---

## What do you make?

ForgeAI is an AI-native connected worker platform. Companies upload expert walkthrough videos and documentation. Our AI extracts structured step-by-step procedures, safety warnings, equipment lists, and Q&A pairs — then delivers that knowledge to workers as real-time voice-guided coaching on their phone.

A senior technician records themselves doing a UPS maintenance procedure once. ForgeAI watches the video (Gemini 2.0 Flash for visual+audio analysis), synthesizes it into a structured knowledge document (Claude Sonnet 4.5), and instantly makes it available as:

1. **A voice-guided walkthrough** — the worker hears "Step 3: Check battery terminal voltage. Use a multimeter set to DC volts. Normal range is 13.5 to 14.2 volts per battery" while looking at their hands, not a manual.
2. **Hands-free voice commands** — "next", "repeat", "pause", "go back" — no touching the phone.
3. **Contextual Q&A** — the worker asks "what if the voltage reads 11?" mid-step and gets an answer grounded in the expert's knowledge, read aloud.
4. **A searchable knowledge base** — every document, every procedure, every Q&A pair is RAG-indexed and available through natural language chat with source attribution.

---

## Why now?

Three things converged, exactly as David Lieb describes:

**Multimodal models can now see and reason about real-world work.** Gemini 2.0 Flash watches a 45-minute expert walkthrough video and extracts structured procedures with exact specs (torque values, temperature ranges, part numbers, visual indicators). Claude synthesizes this into training-quality documentation that previously took weeks of technical writing. This wasn't possible 18 months ago.

**The hardware is already in every worker's pocket.** ForgeAI is a PWA — installable on any iPhone or Android. We use the Web Speech API for text-to-speech and speech recognition. No special hardware required today. When smart glasses become mainstream, we're the software layer that powers them.

**Skilled labor shortages make this economically urgent.** 2.1 million manufacturing jobs will go unfilled by 2030 (Deloitte). The average age of an electrician is 55. Companies are desperate to transfer decades of institutional knowledge from retiring experts to new hires — and they can't do it fast enough with traditional training.

---

## How it works

### For the expert (one-time capture)
1. Record a walkthrough video showing the procedure (phone camera, GoPro, anything)
2. Upload to ForgeAI
3. AI processes the video in 3-8 minutes:
   - Gemini 2.0 Flash analyzes visual scenes + audio narration
   - Claude Sonnet 4.5 synthesizes into structured `ExpertKnowledgeDocument`: procedures with safety levels, equipment lists, Q&A pairs, timestamps
   - Semantic chunking + vector embeddings (text-embedding-3-small, pgvector)
4. Procedure is immediately available to all workers in the organization

### For the worker (every time)
1. Open ForgeAI on phone → browse Guide Library → tap "Start Guide"
2. Step 1 is read aloud automatically with safety warnings
3. Worker performs the step, says "next" when done
4. If confused: asks "what torque should I use?" — gets a specific answer from the expert's knowledge, read aloud
5. Completes all steps → session logged → progress tracked

### For the manager
- Upload documents (PDFs, Word docs, images) and expert videos
- Invite workers by email with role-based access
- Track which procedures workers have completed
- All knowledge stays within the organization (multi-tenant isolation)

---

## What we've built (live today)

| Capability | Status |
|---|---|
| Expert video capture → structured procedures (Gemini + Claude pipeline) | Shipped |
| Voice-guided step-by-step procedures with auto-play TTS | Shipped |
| Hands-free voice commands (next, back, repeat, pause, play + 20 synonyms) | Shipped |
| Voice questions → contextual RAG answers → spoken response | Shipped |
| Document upload + RAG chat with source attribution | Shipped |
| Camera capture → GPT-4o Vision analysis (show the AI what you see) | Shipped |
| Voice recording → Whisper transcription → chat | Shipped |
| PWA (installable, offline fallback, iOS + Android) | Shipped |
| Multi-tenant auth with role-based access (admin/worker) | Shipped |
| Session persistence (resume procedures where you left off) | Shipped |
| Safety-aware guidance (CRITICAL/WARNING badges, TTS prefixes) | Shipped |

**Tech stack:** Next.js 16, React 19, TypeScript, Prisma 7, PostgreSQL + pgvector (Neon), OpenAI (GPT-4o, Whisper, text-embedding-3-small), Google Gemini 2.0 Flash, Anthropic Claude Sonnet 4.5, Vercel Blob, Serwist PWA.

---

## The path to smart glasses

Our architecture is hardware-agnostic by design. Today: phone in pocket, AirPods in ears, voice commands. Tomorrow:

**Near-term (now):** Phone + earbuds. Worker launches procedure, listens to steps, uses voice commands. Camera capture for "show me what you see" queries.

**Mid-term (6-12 months):** Integrate with smart glasses (Meta Ray-Ban, XREAL, Vuzix). Same backend, same procedures — now overlaid on the worker's field of view. The guided procedure becomes an AR overlay.

**Long-term:** Continuous visual monitoring. The AI watches through the glasses, detects what step the worker is on, and proactively warns about safety hazards or mistakes before they happen.

The value compounds: every expert video captured today becomes AR-ready content tomorrow without any rework.

---

## Market

**Target:** SMBs with 10-500 frontline workers in field services, manufacturing, facilities management, healthcare, and construction.

**Why SMBs?** Large enterprises have $500K+ connected worker platforms (PTC Vuforia, Honeywell Forge). SMBs have binders, tribal knowledge, and retiring experts. ForgeAI gives them enterprise-grade knowledge capture and delivery at SMB pricing.

**Wedge:** Companies already trying to document their experts' knowledge. They're recording walkthrough videos and storing them in SharePoint or Google Drive where nobody watches them. ForgeAI turns those unwatched videos into live coaching.

**Sizing:**
- 12.8M manufacturing workers in the US alone
- Field services market: $5.2B by 2028
- Connected worker platform market: $28.4B by 2032 (Fortune Business Insights)
- Even capturing 0.1% of frontline workers at $50/worker/month = $77M ARR

---

## Business model

**Per-worker SaaS pricing:**
- Workers: $25-50/worker/month (access to guides, chat, voice features)
- Admin seats: included
- Expert capture processing: usage-based (per video minute processed)
- Free tier: 3 workers, 5 documents, 2 expert captures

---

## Team

[Your team details here]

---

## Ask

We're applying to YC to:
1. **Get design partners** in field services, manufacturing, and facilities management to validate the guided procedure experience with real workers on real jobs
2. **Build the glasses integration** — the phone is the wedge, glasses are the endgame
3. **Scale the expert capture pipeline** — every company has decades of knowledge trapped in the heads of their best people. We want to capture all of it.

---

## Demo

Live at: [your-deployment-url]

Try it: Upload an expert walkthrough video → watch AI extract procedures → walk through them step-by-step with voice guidance.
