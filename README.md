# Storage Management Monorepo

Enterprise Storage and Warehouse Management Platform.
Monorepo framework inherited and tailored from Zenith architecture: **Expo Mobile** + **Next.js Web** + **NestJS Backend API** with **PostgreSQL**.

---

## Architecture & Structure

```
storage-management-monorepo/
├── apps/
│   ├── api/                     # @storage/api      — NestJS 11 + TypeORM + PostgreSQL + Swagger
│   ├── web/                     # @storage/web      — Next.js 15 App Router + Tailwind CSS + Lucide
│   └── mobile/                  # @storage/mobile   — React Native Expo SDK (Monorepo Metro Config)
├── packages/
│   ├── types/                   # @storage/types    — Shared TypeScript interfaces & DTOs
│   └── tsconfig/                # @storage/tsconfig — Shared TypeScript compiler presets
├── docker-compose.yml           # PostgreSQL 16 service & development containers
├── pnpm-workspace.yaml          # pnpm monorepo workspace definition
├── turbo.json                   # Turborepo task orchestrator
├── biome.json                   # Biome linter & formatter configuration
├── lefthook.yml                 # Git pre-commit and commit-msg hooks
├── commitlint.config.cjs        # Conventional commit message validation
├── mise.toml                    # Toolchain pinning (Node.js 22 & pnpm)
└── package.json                 # Unified workspace management scripts
```

---

## Tech Stack Overview

| Application / Package | Technology Stack | Default Port | Description |
| :--- | :--- | :--- | :--- |
| **Backend API (`apps/api`)** | NestJS 11, TypeORM, PostgreSQL (`pg`), Swagger, Class-Validator | `3001` | Core REST API, Warehouse Inventory & Storage management endpoints |
| **Web App (`apps/web`)** | Next.js 15, React 19, Tailwind CSS, Lucide React, Axios | `3000` | Administrative and operations desktop dashboard |
| **Mobile App (`apps/mobile`)** | React Native, Expo SDK 52, TypeScript, Metro monorepo | `8081` | Handheld warehouse scanner and inventory management |
| **Shared Types (`packages/types`)** | TypeScript | N/A | DTOs, entity interfaces, and API response contracts |
| **Shared Config (`packages/tsconfig`)** | TypeScript config presets | N/A | Shared tsconfig (`nest`, `nextjs`, `react-native`, `base`) |
| **Database** | PostgreSQL 16 (Docker) | `5432` | Primary relational database |

---

## Prerequisites

- **Node.js**: `>= 20.0.0` (Pinned to `22` in `mise.toml`)
- **pnpm**: `>= 9.0.0` (Run `corepack enable` if needed)
- **Docker & Docker Compose**: For local PostgreSQL database

---

## Quick Start

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Start PostgreSQL Database
```bash
pnpm db:up
```
This starts PostgreSQL 16 in the background on port `5432` with database `storage_management_db`.

### 3. Run Development Servers

Run everything in parallel:
```bash
pnpm dev
```

Or run individual apps:
```bash
# Backend API (runs on http://localhost:3001/api/v1)
pnpm dev:api

# Web Dashboard (runs on http://localhost:3000)
pnpm dev:web

# Mobile App (Expo Metro bundler)
pnpm dev:mobile
```

---

## API & Documentation

- **REST API Base URL**: `http://localhost:3001/api/v1`
- **Swagger Documentation**: `http://localhost:3001/docs`
- **Health Check**: `http://localhost:3001/api/v1/health`

---

## Common Scripts

| Command | Description |
| :--- | :--- |
| `pnpm dev` | Run all applications in parallel |
| `pnpm dev:api` | Run only the NestJS API with hot reload |
| `pnpm dev:web` | Run only the Next.js web application |
| `pnpm dev:mobile` | Run only the Expo mobile application |
| `pnpm build` | Build all applications and packages |
| `pnpm build:api` | Build NestJS production bundle |
| `pnpm build:web` | Build Next.js production bundle |
| `pnpm check` | Run Biome check (lint + format validation) |
| `pnpm check:fix` | Run Biome check and auto-fix issues |
| `pnpm format` | Auto-format all code with Biome |
| `pnpm db:up` | Start PostgreSQL 16 container |
| `pnpm db:down` | Stop PostgreSQL container |
| `pnpm db:logs` | View PostgreSQL database logs |
