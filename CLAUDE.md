# ForgeAI - Project Guide

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

## Project Structure

- `src/app/(auth)/` - Login/signup pages
- `src/app/(dashboard)/admin/` - Admin dashboard (docs, workers)
- `src/app/(dashboard)/chat/` - Worker Q&A chat (mobile-first)
- `src/app/api/` - API routes (auth, documents, chat, workers)
- `src/lib/ai/` - RAG pipeline (embeddings, chat, document processing)
- `src/lib/parsers/` - File parsers (PDF, DOCX, image)
- `src/components/` - React components (chat, documents, workers, layout)
- `prisma/` - Schema and migrations (excluded from tsconfig)

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
