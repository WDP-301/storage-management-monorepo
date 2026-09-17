# ==========================================
# Base Stage
# ==========================================
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat git
RUN corepack enable && corepack prepare pnpm@10.23.0 --activate
WORKDIR /app

# ==========================================
# Builder Stage (Vite React SPA)
# ==========================================
FROM base AS builder

COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml turbo.json biome.json .npmrc* ./
COPY packages ./packages
COPY apps/web ./apps/web

RUN pnpm install --ignore-scripts
RUN pnpm --filter @storage/web build

# ==========================================
# Runner Stage (Nginx High-Performance SPA Server)
# ==========================================
FROM nginx:alpine AS runner

COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

RUN echo $'server {\n\
    listen 80;\n\
    server_name _;\n\
    location / {\n\
        root /usr/share/nginx/html;\n\
        index index.html index.htm;\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
    location ~* \\.(?:css|js|jpg|jpeg|gif|png|ico|cur|gz|svg|svgz|mp4|ogg|ogv|webm|htc|woff|woff2)$ {\n\
        root /usr/share/nginx/html;\n\
        expires 1y;\n\
        access_log off;\n\
        add_header Cache-Control "public";\n\
    }\n\
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
