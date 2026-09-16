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
COPY apps/api ./apps/api

RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter @storage/api build

# ==========================================
# Production Runner
# ==========================================
FROM node:22-alpine AS runner
RUN apk add --no-cache dumb-init
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages ./packages

EXPOSE 3001

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/api/dist/main.js"]
