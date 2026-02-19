# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

AI-native connected worker platform for SMBs. Ingests company SOPs, manuals, training docs, and expert walkthrough videos, builds a searchable knowledge base via RAG, and delivers contextual AI assistance to frontline workers.

**Tech Stack**: Next.js 16 (App Router) | PostgreSQL + pgvector (Neon) | Prisma 7 | NextAuth.js v5 | OpenAI (gpt-4o + text-embedding-3-small) | Google Gemini 2.0 Flash | Anthropic Claude Sonnet 4.5 | Vercel Blob | shadcn/ui + Tailwind CSS

## Implemented Features

- **Document Ingestion (STANDARD)**: Upload PDFs, DOCX, images, audio, video → parsed → chunked → embedded → RAG-queryable
- **Expert Captures**: Upload expert walkthrough videos → Gemini 2.0 Flash analyzes visual + audio → Claude Sonnet 4.5 synthesizes structured knowledge → semantic pre-chunks → RAG-queryable (same chat interface as documents)
- **Worker Chat**: Streaming GPT-4o chat with RAG context, source chunk attribution, chat history
- **Admin Dashboard**: Document management, worker management (invite/resend/revoke), expert capture management with status polling and detail sheet (Q&As, procedures, safety notes, summary tabs)
- **Mobile PWA (iOS-first)**: Installable PWA via `public/manifest.json` + Serwist service worker. Camera capture via `<input capture>` (iOS-safe). Voice Q&A via `MediaRecorder` → Whisper transcription. GPT-4o Vision for image+RAG answers. Offline fallback page.

## Commands

- `npm run dev` - Start dev server (Turbopack — service worker disabled in dev)
- `npm run build` - Production build (**uses `next build --webpack`** — serwist requires webpack, not Turbopack)
- `npm run lint` - ESLint
- `npm run db:migrate` - Run Prisma migrations
- `npm run db:seed` - Seed database with test data
- `npm run db:studio` - Open Prisma Studio
- `npm run db:setup` - Migrate + seed in one command

## Architecture

### Multi-Tenant Model

Each `Organization` owns its `User`s (ADMIN or WORKER role), `Document`s, and `Invite`s. Chat sessions and document access are fully org-scoped. Role-based routing is enforced in `src/middleware.ts` — admins land at `/admin`, workers at `/chat`.

### RAG Pipeline

**Standard document ingestion** (`src/lib/ai/process-document.ts`):
```
Upload → Vercel Blob → Parse text (parser by MIME type) → Chunk (3200 chars, 800 overlap) → Embed (text-embedding-3-small, 1536 dims) → Store in pgvector
```

**Expert capture ingestion** (`src/lib/ai/process-expert-capture.ts`):
```
Upload → Vercel Blob → uploadVideoToGemini (Files API, polls until ACTIVE) → analyzeExpertVideo (Gemini 2.0 Flash, JSON schema) → synthesizeExpertCapture (Claude Sonnet 4.5) → generateExpertCaptureChunks (semantic: overview, equipment, per-procedure, safety, per-Q&A, transcript segments) → Embed + Store in pgvector
```

Processing takes 3–8 min (Gemini upload/analysis + Claude synthesis + embedding). Runs fire-and-forget in the same process (works locally/VPS; on Vercel serverless, background work is killed — use QStash for production).

**Chat query flow** (`src/lib/ai/chat.ts`):
```
User message (+ optional image) → Embed query → Cosine similarity search (top 5 chunks, all docTypes) → Build system prompt with chunks + last 6 messages → Stream GPT-4o response
```

When an image is attached, the user message becomes a multimodal content array:
```ts
[
  { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}`, detail: "high" } },
  { type: "text", text: message || "Describe what you see using the documentation." }
]
```

System prompt enforces: "Answer ONLY from provided context." Temperature is 0.2.

Source chunks are passed back via a response header (`X-Source-Chunks`) encoded with `encodeURIComponent` (see HTTP Headers gotcha below).

### File Parsers (`src/lib/parsers/`)

Used only for **STANDARD** document uploads:

| File type | Parser |
|---|---|
| PDF | pdfjs-dist directly (NOT pdf-parse — see gotcha) |
| DOCX | mammoth |
| Images | OpenAI Vision API |
| Audio/Video | OpenAI Whisper API |

**Expert Captures** bypass this parser entirely — Gemini 2.0 Flash handles both visual analysis and transcription directly.

### Database Schema (key models)

- `Document` — tracks upload status (`PENDING → PROCESSING → READY / FAILED`), links to org. Key fields:
  - `docType: DocType` enum (`STANDARD` | `EXPERT_CAPTURE`, default `STANDARD`)
  - `title: String?`, `description: String?` — user-provided metadata for expert captures
  - `expertCaptureData: Json?` — stores full `ExpertKnowledgeDocument` struct (procedures, Q&As, safety notes, equipment, tools, summary, transcript)
  - `extractedText: String?` — full transcript (expert captures) or parsed text (standard docs)
- `DocumentChunk` — text + `embedding vector(1536)` (pgvector), references parent document
- `ChatSession` / `ChatMessage` — per-user chat history; messages store `sourceChunkIds: String[]`
- `Invite` — pending worker invitations scoped to org

## Project Structure

- `src/app/(auth)/` — Login/signup pages
- `src/app/(dashboard)/admin/` — Admin dashboard (docs, workers, expert captures)
- `src/app/(dashboard)/chat/` — Worker Q&A chat (mobile-first)
- `src/app/api/` — API routes (auth, documents, chat, workers, expert-captures, transcribe)
- `src/app/offline/` — Offline fallback page (served by service worker when network unavailable)
- `src/app/sw.ts` — Serwist service worker source (compiled to `public/sw.js` at build time)
- `src/lib/ai/` — RAG pipeline: `chat.ts`, `process-document.ts`, `process-expert-capture.ts`, `expert-capture-synthesis.ts`, `expert-capture-text.ts`, `gemini.ts`, `embeddings.ts`
- `src/lib/parsers/` — File parsers for STANDARD docs (PDF, DOCX, image, audio, video)
- `src/components/chat/` — Chat components including `image-capture.tsx` (camera) and `voice-recorder.tsx` (mic)
- `src/components/` — React components (chat, documents, workers, expert-captures, layout)
- `public/manifest.json` — PWA Web App Manifest
- `public/icons/` — PWA icons (192×192, 512×512, 180×180) — currently placeholder; replace with branded PNGs
- `prisma/` — Schema and migrations (excluded from tsconfig)
- `src/generated/prisma/` — Generated Prisma client (gitignored; regenerated via `postinstall`)

## Known Issues & Learnings

### Prisma v7 + Neon: Driver Adapter Required

Prisma v7's `prisma-client` TypeScript generator uses a WASM-based engine that requires a driver adapter. You CANNOT use `new PrismaClient()` alone.

**Correct pattern (Prisma 7 official):**
```typescript
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@/generated/prisma/client";

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });
```

**Key details:**
- Use `PrismaNeon` with `{ connectionString }` object — handles HTTP/WebSocket internally
- No need for `PrismaNeonHttp`, `Pool`, or `ws` setup
- No `as any` casts needed with this pattern
- The generated Prisma client is at `src/generated/prisma/` and is gitignored - use `postinstall: "prisma generate"` in package.json

### Prisma AI Safety: Destructive Operations

When running destructive Prisma commands (e.g., `prisma migrate reset`) from an AI agent, Prisma blocks execution and requires explicit user consent via:
```bash
PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="yes,reset the database" npx prisma migrate reset --force
```

### NextAuth v5: basePath Required

Auth.js v5 changed the default `basePath` from `/api/auth` to `/auth`. Since routes are mounted at `/api/auth/[...nextauth]`, you MUST explicitly set:
```typescript
export const authConfig: NextAuthConfig = {
  basePath: "/api/auth",
  // ...
};
```
Without this, you get: `UnknownAction: Cannot parse action at /api/auth/session`

### PDF Parsing: Use pdfjs-dist Directly

`pdf-parse` has multiple compatibility issues with Next.js 16 + Turbopack:
- `import * as pdfParse` gives a namespace object, not a callable function
- `import pdfParse from "pdf-parse"` fails because the ESM build has no default export
- CJS require via `createRequire` triggers `DOMMatrix is not defined` (browser API in Node.js)

**Solution:** Use `pdfjs-dist` directly (already installed as transitive dep of pdf-parse):
```typescript
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";

GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/legacy/build/pdf.worker.mjs",
  import.meta.url
).href;

const pdf = await getDocument({ data: new Uint8Array(buffer) }).promise;
```

**Critical details:**
- Pass `new Uint8Array(buffer)` not `Buffer` directly - pdfjs-dist rejects `Buffer`
- `workerSrc` must be a string URL, not a module import
- Setting `workerSrc = ""` causes "No GlobalWorkerOptions.workerSrc specified" error
- Use `new URL("...", import.meta.url).href` to resolve to a file:// URL

### HTTP Headers: No Unicode Characters

HTTP headers only support Latin-1 characters (code points 0-255). If you put document text (which may contain Unicode like mathematical symbols) in a response header, you get:
```
TypeError: Cannot convert argument to a ByteString because the character at index N has a value greater than 255
```

**Solution:** Use `encodeURIComponent()` on the server and `decodeURIComponent()` on the client:
```typescript
// Server (route.ts)
"X-Source-Chunks": encodeURIComponent(JSON.stringify(chunks))

// Client (chat-interface.tsx)
sources = JSON.parse(decodeURIComponent(sourcesHeader));
```

### tsconfig.json: Exclude prisma/ Directory

The default `"include": ["**/*.ts"]` picks up `prisma/seed.ts` during `next build` type checking. Since the seed script is a standalone Node.js script (not part of the app), exclude it:
```json
"exclude": ["node_modules", "prisma"]
```

### Google Generative AI SDK: Correct Imports

The `@google/generative-ai` package (v0.24.x) exports `GoogleGenerativeAI` — not `GoogleGenAI` (that name belongs to the newer `@google/genai` package). Using the wrong name causes a runtime crash.

`GoogleAIFileManager` is **not** in the main module — import it from the subpath:
```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server"; // subpath!
```

`GoogleAIFileManager.uploadFile()` requires a **file path string**, not a buffer. Write to a temp file first, then clean up in a `finally` block.

### AI Client Initialization: Lazy Module-Level Singletons

AI SDK clients (`OpenAI`, `GoogleGenerativeAI`, `GoogleAIFileManager`, `Anthropic`) should be lazily initialized at module level — not recreated on every function call. Each serverless invocation gets its own module scope, so a module-level singleton is reused across calls within the same invocation.

**Pattern used throughout this codebase:**
```typescript
let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
    _client = new Anthropic({ apiKey });
  }
  return _client;
}
```

### Zod v4: `.issues` Not `.errors`

Zod v4 changed `ZodError.errors` to `ZodError.issues`. Using `.errors` will throw at runtime:
```typescript
// ❌ Zod v3
metaResult.error.errors[0].message

// ✅ Zod v4
metaResult.error.issues[0].message
```

### Next.js 16: Dynamic Route Params Are Promises

In Next.js 16 App Router, route segment params are now async:
```typescript
// ❌ Next.js 14/15
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { id } = params;
}

// ✅ Next.js 16
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
}
```

### Vercel Blob Dev Mock: Buffer Before Upload

In dev without a real `BLOB_READ_WRITE_TOKEN`, `@vercel/blob` uses an in-memory mock. The mock's URLs are **not accessible** via HTTP (`fetch(doc.fileUrl)`) after the request completes. Any background processor that tries to re-download the file will fail with `Failed to download video from Blob storage`.

**Fix:** Buffer the file in the upload route handler and pass it directly to the processor:
```typescript
// In the upload API route
const videoBuffer = Buffer.from(await file.arrayBuffer());
const blob = await uploadFile(file);
const document = await prisma.document.create({ ... });
processExpertCapture(document.id, videoBuffer).catch(...); // skip re-download
```

The processor accepts an optional `videoBuffer?: Buffer` param; if omitted, it falls back to downloading from blob URL (works in production with real Vercel Blob).

### Next.js Middleware: Body Size Limit for Large Uploads

When middleware (`src/middleware.ts`) intercepts a request, Next.js buffers the **entire** request body in memory before forwarding it. The default limit is 10MB; uploading a video larger than that causes:
```
Request body exceeded 10MB for /api/expert-captures
TypeError: Failed to parse body as FormData
```

**Fix in `next.config.ts`:**
```typescript
const nextConfig: NextConfig = {
  experimental: {
    middlewareClientMaxBodySize: "500mb",
  },
};
```

This applies only to local dev and self-hosted. On Vercel serverless, use direct-to-Blob presigned URLs for large files.

### Gemini Rate Limiting: Two Distinct 429 Types

Two different 429 errors from Gemini require different handling:

1. **Billing disabled** — `limit: 0` in the error message (`generate_content_free_tier_requests, limit: 0`). Not retryable; enable billing at aistudio.google.com.

2. **Transient rate limit** — `"Resource exhausted. Please try again later"`. Retryable with exponential backoff.

The `withRetry` helper in `src/lib/ai/gemini.ts` handles only the transient case (checks for `"429"` or `"resource exhausted"` in message). Hard billing failures propagate immediately and set the document status to `FAILED`.

### Serwist + Next.js 16: Turbopack Incompatibility

`@serwist/next` injects webpack plugins. Next.js 16 enables Turbopack by default for both `next dev` **and** `next build`, causing:
```
Error: This build is using Turbopack, with a webpack config and no turbopack config
```

**Fix (two-part):**
1. In `next.config.ts`, pass `disable: process.env.NODE_ENV !== "production"` to `withSerwistInit` — this skips the webpack plugin entirely in dev (Turbopack mode).
2. Change the build script in `package.json` to `next build --webpack` — forces webpack for the production build where Serwist's service worker must be compiled.

The service worker is not needed during local development anyway.

### iOS PWA: Camera — Use `<input capture>` Not `getUserMedia`

`navigator.mediaDevices.getUserMedia({ video: true })` in a **standalone PWA** on iOS has a WebKit bug ([#185448](https://bugs.webkit.org/show_bug.cgi?id=185448)) that causes repeated permission prompts and silently returns no stream.

**Fix:** Use a hidden file input with the `capture` attribute:
```tsx
<input type="file" accept="image/*" capture="environment" ref={inputRef} onChange={handleChange} />
```
This opens the native iOS Camera sheet with no permission overhead and returns the same `File` object. No live viewfinder — that requires React Native (`expo-camera`).

**Audio-only `getUserMedia` does NOT have this bug** — only video/camera does. The mic can use `getUserMedia({ audio: true, video: false })` safely from a standalone PWA.

### iOS PWA: Audio Recording — `audio/mp4` MIME Type Required

`MediaRecorder` on iOS Safari 16+ only supports `audio/mp4`. Using `audio/webm` (the Chrome default) causes `MediaRecorder` to throw.

**Runtime detection pattern:**
```ts
function getBestMimeType(): string {
  const candidates = [
    "audio/mp4",              // iOS Safari 16+
    "audio/webm;codecs=opus", // Chrome Android
    "audio/webm",             // Chrome fallback
    "audio/ogg;codecs=opus",  // Firefox
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}
```

**Fallback for iOS < 16** (no `MediaRecorder`): render `<input type="file" accept="audio/*">` instead. Detect with `typeof window !== "undefined" && !window.MediaRecorder`.

### Service Worker TypeScript: `self` Type Conflict

In `src/app/sw.ts`, declaring `declare const self: ServiceWorkerGlobalScope` conflicts with the `dom` lib's global `self: Window & typeof globalThis`. TypeScript errors with `Cannot find name 'ServiceWorkerGlobalScope'` or duplicate declarations.

**Fix:** Extend the existing `WorkerGlobalScope` interface and cast `self`:
```ts
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
const swSelf = self as unknown as WorkerGlobalScope;
```

### Vercel Deployment

- Environment variables must be set in Vercel Dashboard (Settings > Environment Variables), NOT in `.env` files (`.env*` is gitignored)
- **Without `NEXTAUTH_SECRET`**, NextAuth v5 throws `MissingSecret` in the Edge middleware on every request — this silently breaks all client-side `<Link>` navigation (clicks appear to do nothing)
- Required env vars: `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `OPENAI_API_KEY`, `BLOB_READ_WRITE_TOKEN`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`
- `NEXTAUTH_URL` must be set to the actual Vercel deployment URL (e.g. `https://forgeai-chi.vercel.app`), not `localhost`
- `postinstall: "prisma generate"` in package.json ensures the Prisma client is generated before build (since `src/generated/prisma/` is gitignored)
- To import all env vars at once: Vercel Dashboard → project → Settings → Environment Variables → "Import .env file"

### Prisma Migrate: Non-Interactive Mode

`prisma migrate dev` prompts interactively for a migration name. In non-interactive shells (CI, AI agents), use:
```bash
npx prisma migrate dev --name init
```

## Test Credentials (Seed Data)

- **Admin:** admin@acme.com / admin123
- **Worker:** worker@acme.com / worker123
- **Organization:** Acme Manufacturing
