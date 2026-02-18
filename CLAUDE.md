# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

AI-native connected worker platform for SMBs. Ingests company SOPs, manuals, and training docs, builds a searchable knowledge base via RAG, and delivers contextual AI assistance to frontline workers.

**Tech Stack**: Next.js 16 (App Router) | PostgreSQL + pgvector (Neon) | Prisma 7 | NextAuth.js v5 | OpenAI (gpt-4o + text-embedding-3-small) | Vercel Blob | shadcn/ui + Tailwind CSS

## Commands

- `npm run dev` - Start dev server
- `npm run build` - Production build
- `npm run lint` - ESLint
- `npm run db:migrate` - Run Prisma migrations
- `npm run db:seed` - Seed database with test data
- `npm run db:studio` - Open Prisma Studio
- `npm run db:setup` - Migrate + seed in one command

## Architecture

### Multi-Tenant Model

Each `Organization` owns its `User`s (ADMIN or WORKER role), `Document`s, and `Invite`s. Chat sessions and document access are fully org-scoped. Role-based routing is enforced in `src/middleware.ts` — admins land at `/admin`, workers at `/chat`.

### RAG Pipeline

Document ingestion flow (`src/lib/ai/process-document.ts`):
```
Upload → Vercel Blob → Parse text (parser by MIME type) → Chunk (3200 chars, 800 overlap) → Embed (text-embedding-3-small, 1536 dims) → Store in pgvector
```

Chat query flow (`src/lib/ai/chat.ts`):
```
User message → Embed query → Cosine similarity search (top 5 chunks) → Build system prompt with chunks + last 6 messages → Stream GPT-4o response
```

System prompt enforces: "Answer ONLY from provided context." Temperature is 0.2.

Source chunks are passed back via a response header (`X-Source-Chunks`) encoded with `encodeURIComponent` (see HTTP Headers gotcha below).

### File Parsers (`src/lib/parsers/`)

| File type | Parser |
|---|---|
| PDF | pdfjs-dist directly (NOT pdf-parse — see gotcha) |
| DOCX | mammoth |
| Images | OpenAI Vision API |
| Audio/Video | OpenAI Whisper API |

### Database Schema (key models)

- `Document` — tracks upload status (`PENDING → PROCESSING → READY / FAILED`), links to org
- `DocumentChunk` — text + `embedding vector(1536)` (pgvector), references parent document
- `ChatSession` / `ChatMessage` — per-user chat history; messages store `sourceChunkIds: String[]`
- `Invite` — pending worker invitations scoped to org

## Project Structure

- `src/app/(auth)/` — Login/signup pages
- `src/app/(dashboard)/admin/` — Admin dashboard (docs, workers)
- `src/app/(dashboard)/chat/` — Worker Q&A chat (mobile-first)
- `src/app/api/` — API routes (auth, documents, chat, workers)
- `src/lib/ai/` — RAG pipeline (embeddings, chat, document processing)
- `src/lib/parsers/` — File parsers (PDF, DOCX, image, audio, video)
- `src/components/` — React components (chat, documents, workers, layout)
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

### Vercel Deployment

- Environment variables must be set in Vercel Dashboard (Settings > Environment Variables), NOT in `.env` files
- Required env vars: `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `OPENAI_API_KEY`, `BLOB_READ_WRITE_TOKEN`
- `postinstall: "prisma generate"` in package.json ensures the Prisma client is generated before build (since `src/generated/prisma/` is gitignored)

### Prisma Migrate: Non-Interactive Mode

`prisma migrate dev` prompts interactively for a migration name. In non-interactive shells (CI, AI agents), use:
```bash
npx prisma migrate dev --name init
```

## Test Credentials (Seed Data)

- **Admin:** admin@acme.com / admin123
- **Worker:** worker@acme.com / worker123
- **Organization:** Acme Manufacturing
