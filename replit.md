# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

### Assistente de Vistoria Condominial (`artifacts/vistoria-app`)

React + Vite frontend for a condominium inspection assistant. Allows building managers to upload audio recordings and images from inspections, then generates AI-powered professional notices for residents.

**Features:**
- Audio upload (sent to OpenAI Whisper for transcription)
- Multiple image uploads with preview (analyzed via GPT-4o Vision)
- Optional additional notes
- AI-generated structured report (tipo, urgência, ação, resumo, comunicado) via Claude
- Editable formal notice for residents
- Copy to clipboard and WhatsApp send (mocked)

**Pages:** Single page app with two states — upload form and result view.

### API Server (`artifacts/api-server`)

Express 5 backend with two main routes:
- `GET /api/healthz` — health check
- `POST /api/generate-report` — multipart form, accepts audio + images + notes, returns InspectionReport

**Services:**
- `src/services/openai-service.ts` — audio transcription (Whisper) + image analysis (GPT-4o Vision)
- `src/services/claude-service.ts` — structured report generation (Claude claude-opus-4-5)

**Required secrets:**
- `OPENAI_API_KEY` — for Whisper transcription and GPT-4o Vision image analysis
- `CLAUDE_API_KEY` — for generating the professional notice via Claude
