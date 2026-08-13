import type { createDb } from "@workspace/db/worker";

export interface AppAuth {
  userId: string;
  sessionClaims?: Record<string, unknown>;
}

export interface Bindings {
  DATABASE_URL: string;
  AUTH_BYPASS?: string;
  /** Supabase Auth: project URL, e.g. "https://<ref>.supabase.co". Used server-side to build a
   *  createClient() instance for verifying bearer tokens via auth.getUser(jwt). Public-safe value
   *  (same one used client-side), not a secret — configured as a plain [vars] entry. */
  SUPABASE_URL?: string;
  /** Supabase Auth: anon/publishable key. Public-safe value, not a secret. */
  SUPABASE_ANON_KEY?: string;
  /** Gemini: audio transcription + image analysis + report generation in one call — see gemini-service.ts. */
  GOOGLE_GENERATIVE_AI_API_KEY?: string;
  /** Comma-separated allow-list of origins for CORS, e.g. "https://app.example.com,https://sindixhub.pages.dev". */
  ALLOWED_ORIGINS?: string;
}

export interface Variables {
  auth: AppAuth | null;
  db: ReturnType<typeof createDb>;
}

export interface AppEnv {
  Bindings: Bindings;
  Variables: Variables;
}
