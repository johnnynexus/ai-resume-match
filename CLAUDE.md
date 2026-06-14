# CLAUDE.md

This file gives Claude Code the context it needs to work effectively in this repo. Keep it updated as the project evolves.

---

## Project Overview

**ResumeMatch** — a full-stack app that analyzes how well a resume matches a job description. A user uploads a resume (PDF) and pastes a job description; the app parses the resume, sends both to Claude with a forced JSON schema, and returns a structured analysis: an overall match score, matched skills with evidence, missing keywords, section-level feedback, and concrete before/after rewrite suggestions. Authenticated users keep a history of past analyses.

This is a portfolio project. Code should be clean, well-typed, tested where it matters, and explainable in an interview. Favor clarity over cleverness.

---

## Tech Stack

- **Frontend:** Next.js (App Router) + TypeScript + Tailwind CSS — deployed to **Vercel**
- **Backend API:** Node + Fastify + TypeScript, containerized with **Docker** — deployed to **Railway** (or Render/Fly.io)
- **Database:** PostgreSQL (**Neon**) accessed via **Prisma**
- **Auth:** Auth.js (NextAuth) — or Clerk if preferred
- **AI:** Anthropic Messages API (`@anthropic-ai/sdk`)
- **Testing:** Vitest (unit) + Playwright (one e2e flow)
- **CI/CD:** GitHub Actions (lint, typecheck, test, build, push Docker image)

### Important architecture constraint
**Vercel does not run Docker containers.** That is intentional in this design, not a bug. The split is:
- Next.js frontend → Vercel (auto-deploys on push to `main`)
- Dockerized Node API → Railway/Render/Fly (deploys from the Dockerfile)

The Node API exists for two concrete reasons worth being able to explain: (1) it sidesteps Vercel serverless function timeout limits during PDF parsing + streaming Claude calls, and (2) it isolates the Anthropic API key and file handling entirely server-side in a service that never ships to the client. Do not move the Claude calls or PDF parsing into Next.js route handlers without a deliberate reason.

---

## Repository Structure

```
/
├── apps/
│   ├── web/                 # Next.js frontend (deploys to Vercel)
│   │   ├── app/             # App Router routes
│   │   ├── components/
│   │   └── lib/             # client-side API helpers, auth
│   └── api/                 # Fastify backend (Docker → Railway)
│       ├── src/
│       │   ├── routes/      # HTTP route handlers
│       │   ├── services/    # claude.ts, pdf.ts, keywords.ts
│       │   ├── lib/         # prisma client, config, logger
│       │   └── index.ts     # server entry
│       ├── Dockerfile
│       └── package.json
├── packages/
│   └── shared/              # shared TS types (analysis schema, DTOs)
├── prisma/
│   └── schema.prisma
└── CLAUDE.md
```

Shared types (especially the analysis result shape) live in `packages/shared` so the frontend and backend never drift out of sync. When you change the Claude output schema, update it there.

---

## Commands

Run these from the repo root unless noted. (Adjust to your package manager — pnpm assumed.)

- `pnpm dev` — run web + api together in watch mode
- `pnpm --filter web dev` — frontend only
- `pnpm --filter api dev` — backend only
- `pnpm test` — run Vitest across the workspace
- `pnpm test:e2e` — run Playwright
- `pnpm lint` — ESLint
- `pnpm typecheck` — `tsc --noEmit` everywhere
- `pnpm prisma migrate dev` — apply a new migration locally
- `pnpm prisma studio` — inspect the DB
- `docker build -t resumematch-api ./apps/api` — build the API image

Always run `pnpm lint && pnpm typecheck && pnpm test` before considering a change done.

---

## Data Model (Prisma)

```prisma
model User {
  id        String     @id @default(cuid())
  email     String     @unique
  analyses  Analysis[]
  createdAt DateTime   @default(now())
}

model Resume {
  id         String   @id @default(cuid())
  userId     String
  fileName   String
  parsedText String   @db.Text
  createdAt  DateTime @default(now())
}

model JobDescription {
  id        String   @id @default(cuid())
  userId    String
  title     String?
  company   String?
  rawText   String   @db.Text
  createdAt DateTime @default(now())
}

model Analysis {
  id               String   @id @default(cuid())
  userId           String
  resumeId         String
  jobDescriptionId String
  overallScore     Int      // pulled out as a real column for sorting/filtering
  resultJson       Json     // full Claude output; evolve shape without migrations
  inputHash        String   // sha256 of (parsedText + jobText) for caching
  createdAt        DateTime @default(now())

  user User @relation(fields: [userId], references: [id])

  @@index([userId, createdAt])
  @@index([inputHash])
}
```

`overallScore` is duplicated out of `resultJson` deliberately so history can be sorted/filtered in SQL. `inputHash` enables the caching behavior below.

---

## Claude Integration (the core of the app)

Read official docs before changing this — the structured-output area moves: https://docs.claude.com/en/docs_site_map.md

**Model:** default to `claude-sonnet-4-6`. It balances quality and cost well for structured extraction. Only reach for an Opus model if analysis quality is genuinely insufficient. Always use the exact versioned model string in code — never an unversioned alias.

**Two non-negotiable design choices:**

1. **Deterministic keyword baseline first.** Before calling Claude, `services/keywords.ts` extracts candidate keywords from the job description in plain code (tokenize, strip stopwords, optional known-skills dictionary). Claude then does the *semantic* matching and rewriting on top of that baseline. This is classical + AI working together, not a thin LLM wrapper — keep both halves.

2. **Force structured output via tool use.** Define a single tool whose `input_schema` is the analysis result shape, then set `tool_choice` to force that tool so Claude must return schema-conforming data. Parse the tool-use block, not free text. (Check current docs for any newer first-class structured-output option before reworking this.)

**Result schema** (lives in `packages/shared`):

```ts
type AnalysisResult = {
  overall_match_score: number;          // 0–100
  score_breakdown: {
    skills_match: number;
    experience_match: number;
    keyword_coverage: number;
  };
  summary: string;                       // one honest paragraph
  matched_skills: { skill: string; evidence: string }[];
  missing_keywords: {
    keyword: string;
    importance: "high" | "medium" | "low";
    where_to_add: string;
  }[];
  section_feedback: {
    section: string;
    feedback: string;
    severity: "high" | "medium" | "low";
  }[];
  rewrite_suggestions: {
    original: string;
    improved: string;
    reason: string;
  }[];
};
```

`rewrite_suggestions` is the headline feature — the UI renders each as an inline before/after diff. Stream the response so results fill in live.

**Caching:** hash `parsedText + jobText` (sha256 → `inputHash`). If an Analysis with that hash exists for the user, return it instead of re-calling Claude. Saves cost and latency on repeat runs.

**Error handling:** if a PDF parses to empty/near-empty text it's likely a scanned/image-only file. Detect this and return a clear, user-facing error rather than sending empty text to Claude. (OCR is a documented stretch goal, not currently built.)

---

## Conventions

- **TypeScript strict mode** everywhere. No `any` without a comment justifying it.
- **No secrets in the frontend.** The Anthropic key lives only in the Node API's environment. The web app talks to the API, never to Anthropic directly.
- **Validate inputs at the boundary** with Zod — both incoming HTTP requests and Claude's parsed output (don't trust the model blindly; validate against the schema before persisting).
- **Errors:** API returns structured `{ error: { code, message } }` JSON with appropriate status codes. Log server-side with the request id; never leak stack traces to the client.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`).
- **Components:** keep them small and presentational; data fetching lives in `lib/`.
- **Don't add dependencies** for things the standard library or an existing dep already does. Prefer the lean option.

---

## Testing Expectations

- **Unit (Vitest):** the keyword extractor (`keywords.ts`) and the Zod validation of Claude output are the highest-value targets — pure logic, easy to test, demonstrates rigor.
- **E2E (Playwright):** one happy-path flow — sign in → upload resume → paste JD → see an analysis render.
- Don't chase coverage numbers; cover the parts that would actually break.

---

## Environment Variables

Backend API (`apps/api`):
- `ANTHROPIC_API_KEY`
- `DATABASE_URL` (Neon connection string)
- `PORT`
- `ALLOWED_ORIGIN` (the Vercel frontend URL, for CORS)

Frontend (`apps/web`):
- `NEXT_PUBLIC_API_URL` (the Railway API URL)
- `AUTH_SECRET`, plus provider creds (Auth.js)

Keep a `.env.example` in each app committed; never commit real `.env` files.

---

## When Working in This Repo

- Prefer editing existing files over creating new ones; match the surrounding style.
- If you change the analysis schema, update it in `packages/shared` **and** the Prisma `resultJson` consumers **and** the rendering components — they're coupled by design.
- If you're unsure whether something belongs in the frontend or the API, default to the API for anything touching the Anthropic key, PDF bytes, or the database.
- Build order that de-risks the project: get the Claude tool-use call returning clean, validated structured data against hardcoded text **first** — before UI, DB, or auth. That's the risky, impressive core; everything else is familiar plumbing.
