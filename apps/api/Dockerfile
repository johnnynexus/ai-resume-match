# Build from the REPO ROOT (monorepo needs packages/shared + prisma/schema.prisma):
#   docker build -f apps/api/Dockerfile -t resumematch-api .

# ---- Builder: install everything, generate Prisma client, bundle the API ----
FROM node:20-slim AS builder
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm prisma:generate
RUN pnpm --filter @resumematch/api build

# ---- Runner ----
# Copies the built workspace as-is. This is intentionally simple; a future
# optimization is `pnpm deploy --prod` to ship a pruned, production-only bundle.
FROM node:20-slim AS runner
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=builder /repo /repo

WORKDIR /repo/apps/api
EXPOSE 8080
CMD ["node", "dist/index.js"]
