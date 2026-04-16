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

### CondoGest — Gestão Condominial (`artifacts/vistoria-app`)

React + Vite mobile-first frontend for professional síndico (building manager) inspection management. Building managers record audio and capture photos during inspections; AI generates professional notices. Also manages condominiums, residents, and assets (CMDB). Focused on inspection workflows — modules for ocorrências, financeiro, and reservas were removed to keep the platform lean.

**Authentication:** Clerk configured but bypassed in dev via `VITE_AUTH_BYPASS=true` in `.env.local`. Backend bypass enabled via `AUTH_BYPASS=true` in the api-server dev script. `BypassProviderWithRoutes` skips `ClerkProvider` entirely; `SignOutContext` replaces `useClerk` for sign-out.

**Roles:**
- `vistoriador` — creates inspections, views own history
- `sindico` — views inspections for their condominio, creates inspections
- `admin` — full access + user management panel

**Pages:**
- `/` — Landing page (signed-out) or role-based redirect (admin/síndico → dashboard, vistoriador → nova-vistoria)
- `/sign-in`, `/sign-up` — Clerk auth pages
- `/app/dashboard` — Visão Geral overview: metric cards (events, assets, critical alerts), recent events list, critical assets list, smart alerts, quick actions (admin + síndico only)
- `/app/ativos` — Assets CMDB: list/create/edit/delete equipment, structures, systems with criticidade + status filters (admin + síndico only)
- `/app/nova-vistoria` — Create new event: tipoEvento selector (Vistoria/Manutenção/Incidente/Melhoria), tipoVistoria selector (7 types), escopo selector (completa/áreas específicas with checkbox grouped by type), condomínio + área + asset selectors, MediaRecorder audio + camera capture
- `/app/historico` — Event history with urgência, status, tipoEvento filters; tipoEvento badges on cards
- `/app/vistoria/:id` — Event detail: tipoEvento badge, copy/WhatsApp buttons + status badge; síndico/admin can advance status
- `/app/moradores` — Residents CRUD: unidade, nome, tipo (proprietario/inquilino/morador/dependente), telefone, email, ativo; filter by tipo and ativo status; search by name or unit
- `/app/admin` — Admin user management panel
- `/app/condominios` — Admin-only condominium CRUD + area management (inline expandable)

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
- `GET /api/inspections` — list inspections (scoped by role; filters: urgencia, status, condominioId, areaId)
- `POST /api/inspections` — save inspection record (accepts condominioId, areaId)
- `GET /api/inspections/:id` — get single inspection
- `PATCH /api/inspections/:id/status` — update status (sindico/admin only; gerado→pronto_para_envio→enviado)
- `GET /api/condominios` — list condominiums
- `POST /api/condominios` — create condominium (admin only)
- `GET /api/condominios/:id` — get single condominium
- `PATCH /api/condominios/:id` — update condominium (admin only)
- `GET /api/condominios/:id/areas` — list areas for condominium
- `POST /api/condominios/:id/areas` — add area to condominium
- `DELETE /api/condominios/:id/areas/:areaId` — remove area
- `GET /api/users/:clerkId/condominios` — get user's condominium associations
- `POST /api/users/:clerkId/condominios` — assign user to condominium (admin only)
- `DELETE /api/users/:clerkId/condominios/:condominioId` — remove user from condominium (admin only)

**Services:**
- `src/services/openai-service.ts` — audio transcription (Whisper) + image analysis (GPT-4o Vision)
- `src/services/claude-service.ts` — structured report generation (Claude Opus)

**Middleware:**
- `src/middlewares/requireAuth.ts` — Clerk auth check + role helpers + upsertUser
- `src/middlewares/clerkProxyMiddleware.ts` — Clerk proxy for dev/prod

## Database Schema (`lib/db`)

- `usersTable` — clerkId, email, name, role (admin|sindico|vistoriador), condominio, createdAt
- `inspectionsTable` — tipo, urgencia, acao, resumo, comunicado, transcricao, analise_imagens, local, condominio, status (gerado|pronto_para_envio|enviado, default: gerado), condominioId (FK), areaId (FK), assetId (FK → assetsTable), tipoEvento (vistoria|manutencao|incidente|melhoria, default: vistoria), createdByClerkId, createdAt
- `condominiosTable` — nome, cnpj, tipoCondominio (residencial|comercial|misto), endereco, cep, bairro, cidade, estado, totalUnidades, totalBlocos, totalAndares, anoConstrucao, telefone, email, sindico, zelador, administradora, ativo, createdAt
- `areasTable` — condominioId (FK), nome, tipo (comum|lazer|esportiva|social|servico|estacionamento|infantil|predial|administrativa), descricao, capacidade, reservavel, horarioAbertura, horarioFechamento, ativo, createdAt
- `assetsTable` — condominioId (FK), areaId (nullable FK), nome, tipo (equipamento|estrutura|sistema), criticidade (baixa|media|alta), status (operacional|em_manutencao|inativo), descricao, createdAt
- `userCondominiosTable` — clerkId (FK), condominioId (FK) — many-to-many for síndico access scoping
- `moradoresTable` — condominioId (FK), unidade, nome, tipo (proprietario|inquilino|morador|dependente), telefone, email, ativo, createdAt

**Inspection Status Workflow:**
`gerado` (default, created by AI) → `pronto_para_envio` (ready to send, set by síndico/admin) → `enviado` (sent, set by síndico/admin)

## API Spec (`lib/api-spec`)

OpenAPI YAML at `lib/api-spec/openapi.yaml`. Run codegen after any changes:
```
pnpm --filter @workspace/api-spec run codegen
```
Generated hooks in `lib/api-client-react/src/generated/api.ts`.
Generated Zod schemas in `lib/api-zod/src/generated/api.ts`.
