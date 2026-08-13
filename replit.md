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
- **Auth**: Supabase Auth (`@supabase/supabase-js`)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Required Secrets

- `SUPABASE_URL` + `VITE_SUPABASE_URL` — Supabase project URL (same value, two names)
- `SUPABASE_ANON_KEY` + `VITE_SUPABASE_ANON_KEY` — Supabase anon/publishable key (same value, two names)
- `SESSION_SECRET` — Express session secret
- `OPENAI_API_KEY` — for Whisper transcription and GPT-4o Vision image analysis
- `CLAUDE_API_KEY` — for generating the professional notice via Claude Opus

## Artifacts

### SindixHub — Gestao Condominial (`artifacts/vistoria-app`)

React + Vite mobile-first PWA frontend for professional sindico (building manager) inspection management. Building managers record audio and capture photos during inspections; AI generates professional notices. Also manages condominiums and assets (CMDB). Focused on inspection workflows.

**Authentication:** Supabase Auth configured but bypassed in dev via `VITE_AUTH_BYPASS=true` in `.env.local`. Backend bypass enabled via `AUTH_BYPASS=true` in the api-server dev script. `BypassProviderWithRoutes` skips `SupabaseAuthProviderWithRoutes` entirely; `SignOutContext` replaces `supabase.auth.signOut()` for sign-out.

**Roles:**
- `vistoriador` — creates inspections, views own history
- `sindico` — views inspections for their condominio, creates inspections
- `admin` — full access + user management panel

**Pages:**
- `/` — Landing page (signed-out) or role-based redirect (admin/sindico → dashboard, vistoriador → nova-vistoria)
- `/sign-in`, `/sign-up` — Clerk auth pages
- `/app/dashboard` — Visao Geral overview: metric cards (events, assets, critical alerts), recent events list, critical assets list, smart alerts, quick actions (admin + sindico only)
- `/app/ativos` — Assets CMDB: list/create/edit/delete equipment, structures, systems with criticidade + status filters. Includes "Etiquetas" button to generate QR code labels per condominio
- `/app/ativos/etiquetas` — QR Code label generator: select ativos by condominio, preview labels in 3 sizes (5x5cm, 7x7cm, 10x10cm), print-ready with CSS print media queries
- `/ativo/:id` — Public asset page (no auth). Shows asset info, criticidade badge, status, area, last 5 inspections. Button to "Registrar Ocorrencia" linking to nova-vistoria with pre-selected asset
- `/app/nova-vistoria` — Create new event: tipoEvento selector (Vistoria/Manutencao/Incidente/Melhoria), tipoVistoria selector (7 types), escopo selector (completa/areas especificas with checkbox grouped by type), condominio + area + asset selectors, MediaRecorder audio + camera capture. Offline-aware: saves to IndexedDB when offline, syncs on reconnection
- `/app/historico` — Event history with urgencia, status, tipoEvento filters; tipoEvento badges on cards
- `/app/vistoria/:id` — Event detail: tipoEvento badge, copy/WhatsApp buttons + status badge; sindico/admin can advance status
- `/app/admin` — Admin user management panel
- `/app/condominios` — Admin-only condominium CRUD + area management (inline expandable)
- `/app/assembleias` — Assembly insights: AI-generated topic suggestions based on inspection data (melhorias, incidentes, manutencoes, ativos criticos, recorrencias). Filter by condominio and period (3/6/12/24 months). Sorted by priority (alta/media/baixa)
- `/app/fila-offline` — Offline queue: view pending inspections saved while offline, retry individual syncs, delete from queue, auto-sync on reconnection

**Offline (PWA) features:**
- `vite-plugin-pwa` with web app manifest + service worker
- IndexedDB via Dexie (`src/lib/offline-db.ts`) for offline inspection persistence (audio blobs, image blobs, metadata)
- `use-online-status.ts` hook + `ConnectionStatus` banner
- `OfflineSyncContext` with `useOfflineSync` hook: sync queue, auto-sync on reconnection, badge count in nav
- Mobile bottom nav shows "Fila Offline" with badge count

**Mobile features:**
- MediaRecorder API for in-browser audio recording (NOT file upload)
- `<input type="file" accept="image/*" capture="environment" multiple />` for camera
- Bottom navigation bar on mobile, sidebar on desktop

### API Server (`artifacts/api-server`)

Express 5 backend with Clerk authentication middleware. Public routes exist (no auth required).

**Routes:**
- `GET /api/healthz` — health check
- `POST /api/generate-report` — multipart form, accepts audio + images + notes (Whisper transcription + GPT-4o Vision + Claude report generation)
- `GET /api/users/me` — get/create current user profile
- `GET /api/users` — list all users (admin only)
- `PATCH /api/users/:clerkId/role` — update user role/condominio (admin only)
- `GET /api/inspections` — list inspections (scoped by role; filters: urgencia, status, condominioId, areaId)
- `POST /api/inspections` — save inspection record (accepts condominioId, areaId, assetId)
- `GET /api/inspections/:id` — get single inspection
- `PATCH /api/inspections/:id/status` — update status (sindico/admin only; gerado→pronto_para_envio→enviado)
- `GET /api/dashboard/summary` — dashboard metrics: total condominios, assets breakdown (operacional/em_manutencao/inativo), critical assets, 30d events summary, recent events, critical asset list
- `GET /api/condominios` — list condominiums
- `POST /api/condominios` — create condominium (admin only)
- `GET /api/condominios/:id` — get single condominium
- `PATCH /api/condominios/:id` — update condominium (admin only)
- `GET /api/condominios/:id/areas` — list areas for condominium
- `POST /api/condominios/:id/areas` — add area to condominium
- `DELETE /api/condominios/:id/areas/:areaId` — remove area
- `GET /api/condominios/:condominioId/assets` — list assets for a condominio (scoped by role)
- `POST /api/condominios/:condominioId/assets` — create asset (admin/sindico)
- `GET /api/condominios/:condominioId/assets/:assetId` — get single asset
- `PATCH /api/condominios/:condominioId/assets/:assetId` — update asset (admin/sindico)
- `DELETE /api/condominios/:condominioId/assets/:assetId` — delete asset (admin/sindico)
- `GET /api/public/assets/:assetId` — PUBLIC, no auth. Returns asset info + condominium name + area name + last 5 inspections
- `GET /api/assembleias/insights` — analyze inspection data and generate assembly topic suggestions (melhorias, incidentes, manutencoes, ativos criticos, padroes recorrentes). Query params: `condominioId`, `months`
- `GET /api/users/:clerkId/condominios` — get user's condominium associations
- `POST /api/users/:clerkId/condominios` — assign user to condominium (admin only)
- `DELETE /api/users/:clerkId/condominios/:condominioId` — remove user from condominium (admin only)

**Services:**
- `src/services/openai-service.ts` — audio transcription (Whisper) + image analysis (GPT-4o Vision)
- `src/services/claude-service.ts` — structured report generation (Claude Opus)

**Middleware:**
- `src/middlewares/requireAuth.ts` — Clerk auth check + role helpers + upsertUser
- `src/middlewares/clerkProxyMiddleware.ts` — Clerk proxy for dev/prod
- Auth bypass mode (`AUTH_BYPASS=true`) sets `req.auth.userId` to `"bypass-admin"` automatically

## Database Schema (`lib/db`)

- `usersTable` — clerkId, email, name, role (admin|sindico|vistoriador), createdAt, updatedAt
- `inspectionsTable` — tipo, urgencia, acao, resumo, comunicado, transcricao, analise_imagens, local, condominio, status (gerado|pronto_para_envio|enviado, default: gerado), condominioId (FK), areaId (FK), assetId (FK → assetsTable), tipoEvento (vistoria|manutencao|incidente|melhoria, default: vistoria), tipoVistoria, escopo (completa|parcial, default: completa), areasIds (comma-separated JSON), createdByClerkId, createdAt
- `condominiosTable` — nome, cnpj, tipoCondominio (residencial|comercial|misto), endereco, cep, bairro, cidade, estado, totalUnidades, totalBlocos, totalAndares, anoConstrucao, telefone, email, sindico, zelador, administradora, ativo, createdAt, updatedAt
- `areasTable` — condominioId (FK), nome, tipo (comum|lazer|esportiva|social|servico|estacionamento|infantil|predial|administrativa), descricao, capacidade, reservavel, horarioAbertura, horarioFechamento, ativo, createdAt
- `assetsTable` — condominioId (FK), areaId (nullable FK), nome, tipo (equipamento|estrutura|sistema), criticidade (baixa|media|alta), status (operacional|em_manutencao|inativo), descricao, createdAt, updatedAt
- `userCondominiosTable` — userId (FK), condominioId (FK) — many-to-many for sindico access scoping

**Removed (not present):**
- `moradoresTable` — was removed to keep the platform lean. Resident management is not part of SindixHub.

**Inspection Status Workflow:**
`gerado` (default, created by AI) → `pronto_para_envio` (ready to send, set by sindico/admin) → `enviado` (sent, set by sindico/admin)

## API Spec (`lib/api-spec`)

OpenAPI YAML at `lib/api-spec/openapi.yaml`. Run codegen after any changes:
```
pnpm --filter @workspace/api-spec run codegen
```
Generated hooks in `lib/api-client-react/src/generated/api.ts`.
Generated Zod schemas in `lib/api-zod/src/generated/api.ts`.

## Project Notes

- **PWA**: `vite-plugin-pwa` configured with manifest, service worker, icons. Offline inspections saved to IndexedDB, synced on reconnection.
- **QR Code labels**: `qrcode` library generates Data URLs for asset labels. Three sizes: small (5x5cm), medium (7x7cm), large (10x10cm). Print via CSS `@media print`.
- **Build rules**: After DB/API changes: `pnpm --filter @workspace/db run push` → `pnpm --filter @workspace/api-spec run codegen` → `cd lib/api-client-react && pnpm exec tsc -p tsconfig.json`
- **DB pkg exports source TS directly** (no build step needed)
- **Auth bypass**: Backend `AUTH_BYPASS=true` in api-server dev script; bypass admin clerkId = `"bypass-admin"`; Frontend `VITE_AUTH_BYPASS=true` in `.env.local`
- **Active nav order (admin/sindico)**: Painel → Vistorias → Nova Vistoria → Ativos → Assembleias → (admin: Condominios, Usuarios) + Fila Offline
- **Select component bug fix**: Never use `value=""` in `<SelectItem>` — use `"__none__"` as sentinel value and map to/from empty string
