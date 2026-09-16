# ==========================================
# Base Stage
# ==========================================
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat dumb-init
RUN corepack enable && corepack prepare pnpm@10.23.0 --activate
WORKDIR /app

# ==========================================
# Builder Stage
# ==========================================
FROM base AS builder

COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml turbo.json biome.json .npmrc* ./
COPY packages ./packages
COPY apps/web ./apps/web

RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter @storage/web build

# ==========================================
# Production Runner
# ==========================================
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
