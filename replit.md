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
- **Auth**: Clerk (`@clerk/react`, `@clerk/express`)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Required Secrets

- `CLERK_PUBLISHABLE_KEY` + `VITE_CLERK_PUBLISHABLE_KEY` — Clerk frontend publishable key (same value, two names)
- `CLERK_SECRET_KEY` — Clerk backend secret key
- `SESSION_SECRET` — Express session secret
- `OPENAI_API_KEY` — for Whisper transcription and GPT-4o Vision image analysis
- `CLAUDE_API_KEY` — for generating the professional notice via Claude Opus

## Artifacts

### Assistente de Vistoria Condominial (`artifacts/vistoria-app`)

React + Vite mobile-first frontend for a condominium inspection assistant. Building managers record audio and capture photos during inspections; AI generates professional notices for residents.

**Authentication:** Clerk (ClerkProvider wraps WouterRouter internally via ClerkProviderWithRoutes pattern).

**Roles:**
- `vistoriador` — creates inspections, views own history
- `sindico` — views inspections for their condominio, creates inspections
- `admin` — full access + user management panel

**Pages:**
- `/` — Landing page (signed-out) or role-based redirect (signed-in)
- `/sign-in`, `/sign-up` — Clerk auth pages
- `/app/nova-vistoria` — Create new inspection (MediaRecorder audio + camera capture)
- `/app/historico` — Inspection history with urgência filter
- `/app/vistoria/:id` — Inspection detail with copy/WhatsApp buttons
- `/app/admin` — Admin user management panel

**Mobile features:**
- MediaRecorder API for in-browser audio recording (NOT file upload)
- `<input type="file" accept="image/*" capture="environment" multiple />` for camera
- Bottom navigation bar on mobile, sidebar on desktop

### API Server (`artifacts/api-server`)

Express 5 backend with Clerk authentication middleware.

**Routes:**
- `GET /api/healthz` — health check
- `POST /api/generate-report` — multipart form, accepts audio + images + notes
- `GET /api/users/me` — get/create current user profile
- `GET /api/users` — list all users (admin only)
- `PATCH /api/users/:clerkId/role` — update user role/condominio (admin only)
- `GET /api/inspections` — list inspections (scoped by role)
- `POST /api/inspections` — save inspection record
- `GET /api/inspections/:id` — get single inspection

**Services:**
- `src/services/openai-service.ts` — audio transcription (Whisper) + image analysis (GPT-4o Vision)
- `src/services/claude-service.ts` — structured report generation (Claude Opus)

**Middleware:**
- `src/middlewares/requireAuth.ts` — Clerk auth check + role helpers + upsertUser
- `src/middlewares/clerkProxyMiddleware.ts` — Clerk proxy for dev/prod

## Database Schema (`lib/db`)

- `usersTable` — clerkId, email, name, role (admin|sindico|vistoriador), condominio, createdAt
- `inspectionsTable` — tipo, urgencia, acao, resumo, comunicado, transcricao, analise_imagens, local, condominio, createdByClerkId, createdAt

## API Spec (`lib/api-spec`)

OpenAPI YAML at `lib/api-spec/openapi.yaml`. Run codegen after any changes:
```
pnpm --filter @workspace/api-spec run codegen
```
Generated hooks in `lib/api-client-react/src/generated/api.ts`.
Generated Zod schemas in `lib/api-zod/src/generated/api.ts`.
