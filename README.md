# Storage Management Monorepo Template

Enterprise-grade Storage and Warehouse Management Platform starter template.
Monorepo framework inherited and tailored from Zenith architecture:
- **Mobile**: **Expo SDK 54** (React Native 0.81.5 + React 19.1.0)
- **Web**: **React 19 + Vite 8 SPA** with **Tailwind CSS v4** & Lucide Icons (Pure React Hooks)
- **Backend**: **NestJS 11** with **TypeORM** + **PostgreSQL** (Render) + Swagger OpenAPI
- **Object Storage**: **Cloudflare R2** (S3-compatible object storage)
- **Toolchain**: **pnpm workspaces** + **Turborepo** + **Biome** + **Lefthook** + **mise**

---

## Architecture & Monorepo Structure

```
storage-management-monorepo/
├── .github/workflows/ci.yml     # GitHub Actions CI pipeline (build & Biome check)
├── .vscode/                     # VS Code workspace settings (Biome format-on-save)
├── apps/
│   ├── api/                     # @storage/api      — NestJS 11 + TypeORM (PostgreSQL) + S3 (R2) + Swagger
│   ├── web/                     # @storage/web      — React 19 + Vite 8 SPA + Tailwind v4 + S3 Upload
│   └── mobile/                  # @storage/mobile   — React Native Expo SDK 54 (dev client, không chạy Expo Go)
├── packages/
│   ├── types/                   # @storage/types    — Shared TypeScript interfaces, DTOs & S3 types
│   └── tsconfig/                # @storage/tsconfig — Shared TypeScript compiler presets (nest, react, react-native, base)
├── pnpm-workspace.yaml          # pnpm monorepo workspace definition
├── turbo.json                   # Turborepo task orchestrator
├── biome.json                   # Biome linter & formatter configuration
├── lefthook.yml                 # Git pre-commit and commit-msg hooks
├── commitlint.config.cjs        # Conventional commit message validation
├── mise.toml                    # Toolchain pinning (Node.js 24.11.1 & pnpm 10.23.0)
└── package.json                 # Unified workspace management scripts
```

---

## Tech Stack Overview

| Application / Package | Technology Stack | Default Port | Description |
| :--- | :--- | :--- | :--- |
| **Backend API (`apps/api`)** | NestJS 11, TypeORM, PostgreSQL (`pg`), AWS SDK v3 S3, Swagger | `3001` | REST API, Warehouse Inventory CRUD & S3 Presigned URL services |
| **Web App (`apps/web`)** | React 19, Vite 8, Tailwind CSS v4, Lucide React, Axios | `3000` | Operations & Admin desktop dashboard SPA (Pure React Hooks) |
| **Mobile App (`apps/mobile`)** | React Native, Expo SDK 54, MapLibre + Goong, Metro monorepo | `8081` | Customer booking flow, warehouse map & KPI view (dev client, **không chạy Expo Go**) |
| **Shared Types (`packages/types`)** | TypeScript | N/A | DTOs, entity interfaces, and API response contracts |
| **Shared Config (`packages/tsconfig`)**| TSConfig Presets | N/A | Shared tsconfig (`nest`, `react`, `react-native`, `base`) |
| **Relational Database** | PostgreSQL (Render, managed) | `5432` | Primary relational database |
| **Object Storage (S3)** | Cloudflare R2 | N/A | S3-compatible object storage for file uploads/attachments |

---

## Prerequisites

- **Node.js**: `>= 20.0.0` (Pinned to `24.11.1` in `mise.toml`)
- **pnpm**: `>= 10.0.0` (`corepack enable && corepack prepare pnpm@10.23.0 --activate`)
- A **Render PostgreSQL** instance and a **Cloudflare R2** bucket (credentials go into `apps/api/.env`)

---

## Quick Start

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Configure Environment
```bash
cp apps/api/.env.example apps/api/.env
# Fill in your Render Postgres credentials (DB_* + DB_SSL=true)
# and Cloudflare R2 credentials (S3_*)
```

```bash
# Apply DB migrations (creates tables on first run):
pnpm --filter @storage/api migration:run

# Create the first administrator (self-registration only ever creates customers).
# Idempotent: re-running grants ADMIN to an existing user without touching their password.
SEED_ADMIN_EMAIL=admin@example.com SEED_ADMIN_PASSWORD='<min 8 chars>' SEED_ADMIN_NAME='Admin' \
  pnpm --filter @storage/api seed:admin
```

### 2b. Mobile: dev client (bắt buộc từ khi có bản đồ)

`apps/mobile` có native module (MapLibre) nên **không chạy trên Expo Go**. Lần đầu trên mỗi máy:

```bash
cd apps/mobile && npx expo prebuild --platform android --clean && npx expo run:android
```

Cần JDK 17 + Android SDK. Chi tiết env, yêu cầu máy và troubleshooting:
[`apps/mobile/README.md`](apps/mobile/README.md).

### 3. Run Development Servers
```bash
# Run API, Web, and Mobile simultaneously:
pnpm dev

# Or run individual workspaces:
pnpm dev:api     # Backend API at http://localhost:3001/api/v1
pnpm dev:web     # React Vite Web at http://localhost:3000
pnpm dev:mobile  # Expo SDK 54 Metro bundler (--dev-client; cần build một lần, xem 2b)
```

---

## API & Documentation

- **REST API Base URL**: `http://localhost:3001/api/v1`
- **Swagger Documentation**: `http://localhost:3001/api/docs`
- **Health Liveness**: `http://localhost:3001/api/v1/health` or `/health/live`
- **API response contract**: [`apps/api/API_CONTRACT.md`](apps/api/API_CONTRACT.md)

---

## Common Scripts

| Command | Description |
| :--- | :--- |
| `pnpm dev` | Run all applications in parallel |
| `pnpm dev:api` | Run only the NestJS API with hot reload |
| `pnpm dev:web` | Run only the React Vite web application |
| `pnpm dev:mobile` | Run only the Expo mobile application |
| `pnpm build` | Build all applications and packages via Turborepo |
| `pnpm test` | Run all workspace tests (Jest API + Vitest Web) |
| `pnpm check` | Run Biome linter & formatter check |
| `pnpm check:fix` | Run Biome and automatically apply safe fixes |
| `pnpm format` | Auto-format all code with Biome |
| `pnpm clean` | Clean all `dist`, `build`, and `.turbo` caches |
| `pnpm --filter @storage/api migration:run` | Apply pending DB migrations |
| `pnpm --filter @storage/api seed:admin` | Create or promote an administrator (`SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`) |
| `pnpm --filter @storage/api migration:generate src/migrations/<Name>` | Generate migration from entity changes |
