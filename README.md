# ResumeMatch

Analyze how well a resume matches a job description. Upload a resume (PDF) and
paste a job description; the app extracts a deterministic keyword baseline, then
asks an LLM to do the semantic matching and rewriting on top of it, returning a
structured analysis: overall match score, matched skills with evidence, missing
keywords, section-level feedback, and before/after rewrite suggestions.

See [CLAUDE.md](./CLAUDE.md) for the full architecture, design decisions, and
conventions.

## Stack

- **Web** (`apps/web`) — Next.js (App Router) + TypeScript + Tailwind → Vercel
- **API** (`apps/api`) — Fastify + TypeScript, Dockerized → Fly.io
- **Shared** (`packages/shared`) — analysis result schema + DTOs (Zod), shared
  by web and API so they never drift
- **DB** — PostgreSQL (Neon) via Prisma (`prisma/schema.prisma`)
- **AI** — Gemini (default, structured output) or Claude (forced tool use),
  swappable via `LLM_PROVIDER`

The Node API is deliberately separate from Next.js: it isolates the LLM API key
and PDF handling server-side, and sidesteps Vercel serverless timeouts during
PDF parsing + streaming model calls. See CLAUDE.md for details.

## Prerequisites

- Node >= 20
- pnpm (`corepack enable pnpm`)
- A PostgreSQL database URL (Neon) for DB-backed features
- A Google AI (Gemini) or Anthropic (Claude) API key
- A Neon `DATABASE_URL` (auth + persistence)
- Google OAuth credentials for sign-in

## Getting started

```bash
corepack enable pnpm           # if pnpm isn't installed
pnpm install
pnpm prisma:generate

# Configure environment (copy and fill in):
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
# Fill in GEMINI_API_KEY, DATABASE_URL, AUTH_*, INTERNAL_API_SECRET (same in both apps), Google OAuth

pnpm prisma migrate dev   # apply schema to Neon
pnpm dev                       # runs web + api together
```

### Try the LLM core without the UI

The risky, impressive core — a structured-output call returning validated,
schema-conforming data — can be run against hardcoded sample text before any DB
or auth is wired up:

```bash
export GEMINI_API_KEY=...
pnpm --filter api analyze:sample

# Or with Claude:
export LLM_PROVIDER=claude ANTHROPIC_API_KEY=sk-ant-...
pnpm --filter api analyze:sample
```

## Common commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Run web + api in watch mode |
| `pnpm --filter web dev` | Frontend only |
| `pnpm --filter api dev` | Backend only |
| `pnpm test` | Vitest across the workspace |
| `pnpm test:e2e` | Playwright (one happy-path flow) |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` everywhere |
| `pnpm prisma:migrate` | Apply a migration locally |
| `pnpm prisma:studio` | Inspect the DB |
| `docker build -f apps/api/Dockerfile -t resumematch-api .` | Build the API image (root context — see note below) |

> **Docker context note:** the API image is built from the **repo root** with
> `-f apps/api/Dockerfile` (not `docker build ./apps/api`) because the monorepo
> build needs `packages/shared` and `prisma/schema.prisma`.

Always run `pnpm lint && pnpm typecheck && pnpm test` before considering a change
done.

## Deployment

Two targets: the Next.js web app → **Vercel**, and the Dockerized API → **Fly.io**,
both backed by the same **Neon** Postgres. Request flow in prod:
browser → Vercel → (server-side BFF) → Fly.io API → Neon / Gemini.

Reference env files: [`apps/api/.env.production.example`](./apps/api/.env.production.example)
and [`apps/web/.env.production.example`](./apps/web/.env.production.example).

### 1. Database (Neon)
Provision a production database (ideally separate from local dev). Migrations are
applied automatically on each API deploy by `fly.toml`'s `[deploy] release_command`
(`prisma migrate deploy`). To run them by hand:

```bash
DATABASE_URL="<neon-prod-url>" pnpm exec prisma migrate deploy --schema=prisma/schema.prisma
```

### 2. API → Fly.io
Config lives in [`fly.toml`](./fly.toml) (Dockerfile build, `/health` check,
migrate-on-deploy release command, `internal_port = 8080`). Run all commands
**from the repo root** so the build context includes `packages/shared` + `prisma/`.

```bash
fly launch --no-deploy        # first time only; keep the committed fly.toml
fly secrets set \
  GEMINI_API_KEY=... \
  DATABASE_URL="<neon-prod-url>" \
  INTERNAL_API_SECRET="<shared secret>" \
  ALLOWED_ORIGIN=https://<your-vercel-domain>
fly deploy                    # builds apps/api/Dockerfile, runs migrations, ships
```

Note the app URL Fly assigns (e.g. `https://resumematch-api.fly.dev`).

### 3. Web → Vercel
- Import the repo with **Root Directory = `apps/web`** (Next.js is auto-detected;
  the pnpm workspace resolves `@resumematch/shared` from the root lockfile).
- Set project env vars from `apps/web/.env.production.example`: `API_URL` and
  `NEXT_PUBLIC_API_URL` (the Fly URL), `INTERNAL_API_SECRET`, `DATABASE_URL`,
  `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`.
- After the first deploy, point the API's `ALLOWED_ORIGIN` at the Vercel URL
  (`fly secrets set ALLOWED_ORIGIN=https://<your-vercel-domain>`).

### 4. Google OAuth (production)
In Google Cloud Console → your OAuth client, add:
- Redirect URI: `https://<your-vercel-domain>/api/auth/callback/google`
- Authorized origin: `https://<your-vercel-domain>`

### Two things that will break it if missed
1. **`INTERNAL_API_SECRET` must be identical** in Vercel and Fly.io — otherwise
   the BFF → API call is rejected with 401.
2. **Migrations must run against Neon** (`fly.toml`'s release command handles this
   on deploy; run manually the first time if deploying elsewhere).

### Container image (CI)
On every push to `main`, CI builds and pushes the API image to GHCR at
`ghcr.io/<owner>/<repo>-api` (tags: `latest` + short SHA). `fly deploy` builds from
the Dockerfile directly, so the GHCR image is an independent artifact — you can
deploy it instead with `fly deploy --image ghcr.io/<owner>/<repo>-api:latest` if
you prefer registry-based deploys.
