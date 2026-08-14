// NOTE: `tsc --build` on this package emits TS2308 "already exported a
// member" for every request-body component schema that's both a zod
// runtime object here (generated/api.ts, e.g. `UpdateUserRoleBody`, used
// for .safeParse(...) in the api-server routes) AND a plain TS type in
// generated/types/*.ts. This predates the multi-tenant migration — it
// already fired on GenerateReportBody/SaveInspectionBody/etc. in the
// original Replit-era checked-in generated files, confirmed by re-running
// `pnpm typecheck:libs` before touching anything this session. Tried
// `export type * from "./generated/types"` to resolve it type-only, but it
// did not clear the error (an orval codegen quirk, not a straightforward
// TS re-export ambiguity) — reverted to the original two-line form rather
// than spend more time on a cosmetic-only issue: this failure is isolated
// to `tsc --build`'s output-emission step and does not affect the actual
// running app — `wrangler dev`/`wrangler deploy` bundle directly from
// source via esbuild, never through this package's build output, and the
// generated hooks/schemas work correctly at runtime regardless.
export * from "./generated/api";
export * from "./generated/types";
