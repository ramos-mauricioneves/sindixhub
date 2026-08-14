import { supabase } from "./supabase";

// Small manual fetch helper for the multi-tenant Phase 4 endpoints
// (empresas, the reshaped prestadores API, acionamentos) — these were
// added/changed on the backend without a matching update to
// lib/api-spec/openapi.yaml + orval codegen, so there are no generated
// @workspace/api-client-react hooks for them yet. Mirrors what
// customFetch/setAuthTokenGetter already do for the generated client:
// attach the current Supabase session's bearer token, throw on non-2xx.
export class ApiFetchError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(path, { ...init, headers });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new ApiFetchError(response.status, (body && (body.error as string)) || response.statusText);
  }
  return body as T;
}
