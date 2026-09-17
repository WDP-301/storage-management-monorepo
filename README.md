# Storage Management Monorepo Template

Enterprise-grade Storage and Warehouse Management Platform starter template.
Monorepo framework inherited and tailored from Zenith architecture:
- **Mobile**: **Expo SDK 54** (React Native 0.81.5 + React 19.1.0)
- **Web**: **React 19 + Vite 8 SPA** with **Tailwind CSS v4** & Lucide Icons (Pure React Hooks)
- **Backend**: **NestJS 11** with **TypeORM** + **PostgreSQL 16** + Swagger OpenAPI
- **Object Storage**: **RustFS S3** (high-performance, lightweight S3-compatible storage written in Rust)
- **Toolchain**: **pnpm workspaces** + **Turborepo** + **Biome** + **Lefthook** + **mise**

---

## Architecture & Monorepo Structure

```
storage-management-monorepo/
├── .github/workflows/ci.yml     # GitHub Actions CI pipeline (build & Biome check)
├── .vscode/                     # VS Code workspace settings (Biome format-on-save)
├── apps/
│   ├── api/                     # @storage/api      — NestJS 11 + TypeORM (PostgreSQL) + RustFS S3 + Swagger
│   ├── web/                     # @storage/web      — React 19 + Vite 8 SPA + Tailwind v4 + S3 Upload
│   └── mobile/                  # @storage/mobile   — React Native Expo SDK 54 (Barcode Scanner Simulation)
├── packages/
│   ├── types/                   # @storage/types    — Shared TypeScript interfaces, DTOs & S3 types
│   └── tsconfig/                # @storage/tsconfig — Shared TypeScript compiler presets (nest, react, react-native, base)
├── docker-compose.yml           # PostgreSQL 16 (5433) + RustFS S3 (9000 S3 API, 9001 Console)
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
| **Mobile App (`apps/mobile`)** | React Native, Expo SDK 54, Metro monorepo | `8081` | Handheld warehouse barcode scanner simulator & KPI view |
| **Shared Types (`packages/types`)** | TypeScript | N/A | DTOs, entity interfaces, and API response contracts |
| **Shared Config (`packages/tsconfig`)**| TSConfig Presets | N/A | Shared tsconfig (`nest`, `react`, `react-native`, `base`) |
| **Relational Database** | PostgreSQL 16 (Docker) | `5433` (host) / `5432` | Primary relational database |
| **Object Storage (S3)** | RustFS S3 (Docker) | `9000` (API) / `9001` (Console) | S3-compatible object storage for file uploads/attachments |

---

## Prerequisites

- **Node.js**: `>= 20.0.0` (Pinned to `24.11.1` in `mise.toml`)
- **pnpm**: `>= 10.0.0` (`corepack enable && corepack prepare pnpm@10.23.0 --activate`)
- **Docker & Docker Compose**: For local PostgreSQL and RustFS S3 services

---

## Quick Start

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Start Storage Infrastructure (Postgres + RustFS S3)
```bash
# Start both PostgreSQL and RustFS S3
pnpm storage:up

# Or start services individually:
pnpm db:up   # PostgreSQL on port 5433
pnpm s3:up   # RustFS S3 on ports 9000 & 9001
```

- **PostgreSQL**: `localhost:5433` (user: `postgres`, password: `postgrespassword`, db: `storage_management_db`)
- **RustFS S3 Console**: `http://localhost:9001` (access key: `rustfsadmin`, secret: `rustfspassword`)

### 3. Run Development Servers
```bash
# Run API, Web, and Mobile simultaneously:
pnpm dev

# Or run individual workspaces:
pnpm dev:api     # Backend API at http://localhost:3001/api/v1
pnpm dev:web     # React Vite Web at http://localhost:3000
pnpm dev:mobile  # Expo SDK 54 Mobile Metro bundler
```

---

## API & Documentation

- **REST API Base URL**: `http://localhost:3001/api/v1`
- **Swagger Documentation**: `http://localhost:3001/api/docs`
- **Health Check**: `http://localhost:3001/api/v1/health` (checks both DB and RustFS S3)

---

## Common Scripts

| Command | Description |
| :--- | :--- |
| `pnpm dev` | Run all applications in parallel |
| `pnpm dev:api` | Run only the NestJS API with hot reload |
| `pnpm dev:web` | Run only the React Vite web application |
| `pnpm dev:mobile` | Run only the Expo mobile application |
| `pnpm build` | Build all applications and packages via Turborepo |
| `pnpm check` | Run Biome linter & formatter check |
| `pnpm check:fix` | Run Biome and automatically apply safe fixes |
| `pnpm format` | Auto-format all code with Biome |
| `pnpm clean` | Clean all `dist`, `build`, and `.turbo` caches |
| `pnpm storage:up` | Start both PostgreSQL and RustFS S3 containers |
| `pnpm storage:down` | Stop and tear down docker containers |
| `pnpm db:logs` | View PostgreSQL database logs |
| `pnpm s3:logs` | View RustFS S3 logs |
