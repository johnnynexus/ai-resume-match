# ResumeMatch

Analyze how well a resume matches a job description. Upload a resume (PDF) and
paste a job description; the app extracts a deterministic keyword baseline, then
asks Claude to do the semantic matching and rewriting on top of it, returning a
structured analysis: overall match score, matched skills with evidence, missing
keywords, section-level feedback, and before/after rewrite suggestions.

See [CLAUDE.md](./CLAUDE.md) for the full architecture, design decisions, and
conventions.

## Stack

- **Web** (`apps/web`) — Next.js (App Router) + TypeScript + Tailwind → Vercel
- **API** (`apps/api`) — Fastify + TypeScript, Dockerized → Railway/Render/Fly
- **Shared** (`packages/shared`) — analysis result schema + DTOs (Zod), shared
  by web and API so they never drift
- **DB** — PostgreSQL (Neon) via Prisma (`prisma/schema.prisma`)
- **AI** — Anthropic Messages API (`claude-sonnet-4-6`), forced tool use for
  schema-conforming structured output

The Node API is deliberately separate from Next.js: it isolates the Anthropic
key and PDF handling server-side, and sidesteps Vercel serverless timeouts
during PDF parsing + streaming Claude calls. See CLAUDE.md for details.

## Prerequisites

- Node >= 20
- pnpm (`corepack enable pnpm`)
- A PostgreSQL database URL (Neon) for DB-backed features
- An Anthropic API key

## Getting started

```bash
corepack enable pnpm           # if pnpm isn't installed
pnpm install
pnpm prisma:generate

# Configure environment (copy and fill in):
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

pnpm dev                       # runs web + api together
```

### Try the Claude core without the UI

The risky, impressive core — a forced-tool-use Claude call returning validated,
schema-conforming structured data — can be run against hardcoded sample text
before any DB or auth is wired up:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
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
