import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  // Only fatal when auth is actually needed (AUTH_BYPASS mode never touches
  // this client) — throwing here surfaces the missing config immediately
  // instead of failing obscurely on first sign-in attempt.
  // eslint-disable-next-line no-console
  console.warn("VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set — Supabase Auth will not work.");
}

export const supabase = createClient(url ?? "", anonKey ?? "");
