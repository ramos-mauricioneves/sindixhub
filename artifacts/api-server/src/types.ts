import type { createDb } from "@workspace/db/worker";

export interface AppAuth {
  userId: string;
  sessionClaims?: Record<string, unknown>;
}

export interface Bindings {
  DATABASE_URL: string;
  AUTH_BYPASS?: string;
  CLERK_SECRET_KEY?: string;
  CLERK_PUBLISHABLE_KEY?: string;
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
