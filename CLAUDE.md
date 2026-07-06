# CLAUDE.md

This file gives Claude Code the context it needs to work effectively in this repo. Keep it updated as the project evolves.

---

## Project Overview

**ResumeMatch** — a full-stack app that analyzes how well a resume matches a job description. A user uploads a resume (PDF) and pastes a job description; the app parses the resume, sends both to an LLM (Gemini by default, Claude optional) with a forced JSON schema, and returns a structured analysis: an overall match score, matched skills with evidence, missing keywords, section-level feedback, and concrete before/after rewrite suggestions. Authenticated users keep a history of past analyses.

This is a portfolio project. Code should be clean, well-typed, tested where it matters, and explainable in an interview. Favor clarity over cleverness.

---

## Tech Stack

- **Frontend:** Next.js (App Router) + TypeScript + Tailwind CSS — deployed to **Vercel**
- **Backend API:** Node + Fastify + TypeScript, containerized with **Docker** — deployed to **Railway** (or Render/Fly.io)
- **Database:** PostgreSQL (**Neon**) accessed via **Prisma**
- **Auth:** Auth.js (NextAuth) — or Clerk if preferred
- **AI:** Google Gemini (`@google/genai`, default) or Anthropic Claude (`@anthropic-ai/sdk`), swappable via `LLM_PROVIDER`
- **Testing:** Vitest (unit) + Playwright (one e2e flow)
- **CI/CD:** GitHub Actions (lint, typecheck, test, build, push Docker image)

### Important architecture constraint
**Vercel does not run Docker containers.** That is intentional in this design, not a bug. The split is:
- Next.js frontend → Vercel (auto-deploys on push to `main`)
- Dockerized Node API → Railway/Render/Fly (deploys from the Dockerfile)

The Node API exists for two concrete reasons worth being able to explain: (1) it sidesteps Vercel serverless function timeout limits during PDF parsing + streaming LLM calls, and (2) it isolates the LLM API key and file handling entirely server-side in a service that never ships to the client. Do not move the LLM calls or PDF parsing into Next.js route handlers without a deliberate reason.

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
│       │   ├── services/    # llm/, pdf.ts, keywords.ts
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

## LLM Integration (the core of the app)

Provider abstraction lives in `apps/api/src/services/llm/`. Set `LLM_PROVIDER=gemini` (default) or `LLM_PROVIDER=claude`.

**Default model:** `gemini-2.5-flash` (Gemini) or `claude-sonnet-4-6` (Claude). Override with `LLM_MODEL`. Always use exact versioned model strings — never unversioned aliases.

**Two non-negotiable design choices:**

1. **Deterministic keyword baseline first.** Before calling the LLM, `services/keywords.ts` extracts candidate keywords from the job description in plain code (tokenize, strip stopwords, optional known-skills dictionary). The LLM then does the *semantic* matching and rewriting on top of that baseline. This is classical + AI working together, not a thin LLM wrapper — keep both halves.

2. **Force structured output.** The analysis result shape lives in `packages/shared` as both a Zod schema and a JSON Schema (`ANALYSIS_JSON_SCHEMA`). Gemini uses native structured output (`responseJsonSchema`); Claude uses forced tool use (`tool_choice`). Either way, parse structured data — not free text — and validate with Zod before persisting.

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

**Caching:** hash `parsedText + jobText` (sha256 → `inputHash`). If an Analysis with that hash exists for the user, return it instead of re-calling the LLM. Saves cost and latency on repeat runs.

**Error handling:** if a PDF parses to empty/near-empty text it's likely a scanned/image-only file. Detect this and return a clear, user-facing error rather than sending empty text to the LLM. (OCR is a documented stretch goal, not currently built.)

---

## Conventions

- **TypeScript strict mode** everywhere. No `any` without a comment justifying it.
- **No secrets in the frontend.** LLM API keys live only in the Node API's environment. The web app talks to the API, never to Gemini or Anthropic directly.
- **Validate inputs at the boundary** with Zod — both incoming HTTP requests and LLM parsed output (don't trust the model blindly; validate against the schema before persisting).
- **Errors:** API returns structured `{ error: { code, message } }` JSON with appropriate status codes. Log server-side with the request id; never leak stack traces to the client.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`).
- **Components:** keep them small and presentational; data fetching lives in `lib/`.
- **Don't add dependencies** for things the standard library or an existing dep already does. Prefer the lean option.

---

## Testing Expectations

- **Unit (Vitest):** the keyword extractor (`keywords.ts`) and the Zod validation of LLM output are the highest-value targets — pure logic, easy to test, demonstrates rigor.
- **E2E (Playwright):** one happy-path flow — sign in → upload resume → paste JD → see an analysis render.
- Don't chase coverage numbers; cover the parts that would actually break.

---

## Environment Variables

Backend API (`apps/api`):
- `GEMINI_API_KEY` (required when `LLM_PROVIDER=gemini`, the default)
- `ANTHROPIC_API_KEY` (required when `LLM_PROVIDER=claude`)
- `LLM_PROVIDER` (`gemini` | `claude`, default `gemini`)
- `LLM_MODEL` (optional override; defaults to `gemini-2.5-flash` or `claude-sonnet-4-6`)
- `DATABASE_URL` (Neon connection string)
- `PORT`
- `ALLOWED_ORIGIN` (the Vercel frontend URL, for CORS)
- `INTERNAL_API_SECRET` (shared with the web BFF; when set, `/api/analyze` requires trusted headers)

Frontend (`apps/web`):
- `NEXT_PUBLIC_API_URL` (the Railway API URL)
- `API_URL` (server-side BFF proxy target, usually same as above)
- `INTERNAL_API_SECRET` (shared with the API; must match)
- `DATABASE_URL` (Neon — required for sign-in user upsert and history)
- `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` (Auth.js + Google)
- `AUTH_TEST_MODE` (optional; enables Credentials provider for Playwright only)

Keep a `.env.example` in each app committed; never commit real `.env` files.

---

## When Working in This Repo

- Prefer editing existing files over creating new ones; match the surrounding style.
- If you change the analysis schema, update it in `packages/shared` **and** the Prisma `resultJson` consumers **and** the rendering components — they're coupled by design.
- If you're unsure whether something belongs in the frontend or the API, default to the API for anything touching the LLM API key, PDF bytes, or the database.
- Build order that de-risks the project: get the structured-output LLM call returning clean, validated data against hardcoded text **first** — before UI, DB, or auth. That's the risky, impressive core; everything else is familiar plumbing.
