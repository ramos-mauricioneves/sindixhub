import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Switch, Route, useLocation, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";

import NotFound from "@/pages/not-found";
import HomeRedirect from "@/pages/home";
import NovaVistoriaPage from "@/pages/nova-vistoria";
import HistoricoPage from "@/pages/historico";
import VistoriaDetailPage from "@/pages/vistoria-detail";
import AdminPage from "@/pages/admin";
import AdminEmpresasPage from "@/pages/admin-empresas";
import CondominiosPage from "@/pages/condominios";
import DashboardPage from "@/pages/dashboard";
import AtivosPage from "@/pages/ativos";
import EtiquetasPage from "@/pages/etiquetas";
import AssembleiasPage from "@/pages/assembleias";
import AssetPublicPage from "@/pages/asset-public";
import FilaOfflinePage from "@/pages/fila-offline";
import Layout from "@/components/layout";
import { OfflineSyncProvider } from "@/contexts/offline-sync-context";

export const AUTH_BYPASS = import.meta.env.VITE_AUTH_BYPASS === "true";

export const SignOutContext = createContext<() => void | Promise<void>>(() => {});
export function useSignOut() { return useContext(SignOutContext); }

// Supabase session context — mirrors what Clerk's useUser()/<Show> used to
// provide, but backed by supabase.auth.getSession() / onAuthStateChange().
type SessionState = { session: Session | null; isLoading: boolean };
const SessionContext = createContext<SessionState>({ session: null, isLoading: true });
export function useSupabaseSession() { return useContext(SessionContext); }

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

// Wire the api-client's bearer-token getter once. On Workers/Hono the
// backend reads `Authorization: Bearer <token>` and verifies it via
// supabase.auth.getUser(jwt) — see artifacts/api-server/src/app.ts.
setAuthTokenGetter(async () => {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
});

function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const [, setLocation] = useLocation();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signUpDone, setSignUpDone] = useState(false);

  const isSignIn = mode === "sign-in";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      if (isSignIn) {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        setLocation(`${basePath}/`);
      } else {
        const { error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
        setSignUpDone(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocorreu um erro. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", marginTop: "2rem" }} className="px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{isSignIn ? "Entrar" : "Criar conta"}</CardTitle>
          <CardDescription>
            {isSignIn ? "Acesse sua conta SindixHub" : "Crie sua conta SindixHub"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {signUpDone ? (
            <div className="space-y-4 text-sm text-muted-foreground">
              <p>Conta criada. Verifique seu e-mail para confirmar o cadastro e depois faça login.</p>
              <Button className="w-full" onClick={() => setLocation(`${basePath}/sign-in`)}>
                Ir para login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  data-testid="input-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={isSignIn ? "current-password" : "new-password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  data-testid="input-password"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={isSubmitting} data-testid="button-submit-auth">
                {isSubmitting ? "Aguarde..." : isSignIn ? "Entrar" : "Cadastrar"}
              </Button>
              <p className="text-sm text-muted-foreground text-center">
                {isSignIn ? (
                  <>Não tem conta? <a className="underline" href={`${basePath}/sign-up`}>Cadastre-se</a></>
                ) : (
                  <>Já tem conta? <a className="underline" href={`${basePath}/sign-in`}>Entrar</a></>
                )}
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SignInPage() {
  return <AuthForm mode="sign-in" />;
}

function SignUpPage() {
  return <AuthForm mode="sign-up" />;
}

// Equivalent of the old ClerkQueryClientCacheInvalidator: clears the
// TanStack Query cache whenever the signed-in user changes (sign-in,
// sign-out, or switching accounts), so stale per-user data doesn't leak
// across sessions.
function SupabaseQueryClientCacheInvalidator({ session }: { session: Session | null }) {
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const userId = session?.user.id ?? null;
    if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
      queryClient.clear();
    }
    prevUserIdRef.current = userId;
  }, [session, queryClient]);

  return null;
}

function AppRoutes() {
  return (
    <Switch>
      <Route path="/" component={HomeRedirect} />
      {!AUTH_BYPASS && <Route path="/sign-in/*?" component={SignInPage} />}
      {!AUTH_BYPASS && <Route path="/sign-up/*?" component={SignUpPage} />}
      <Route path="/ativo/:id" component={AssetPublicPage} />
      <Route path="/app/*">
        <OfflineSyncProvider>
          <Layout>
            <Switch>
              <Route path="/app/dashboard" component={DashboardPage} />
              <Route path="/app/nova-vistoria" component={NovaVistoriaPage} />
              <Route path="/app/historico" component={HistoricoPage} />
              <Route path="/app/vistoria/:id" component={VistoriaDetailPage} />
              <Route path="/app/admin" component={AdminPage} />
              <Route path="/app/admin/empresas" component={AdminEmpresasPage} />
              <Route path="/app/condominios" component={CondominiosPage} />
              <Route path="/app/ativos" component={AtivosPage} />
              <Route path="/app/ativos/etiquetas" component={EtiquetasPage} />
              <Route path="/app/assembleias" component={AssembleiasPage} />
              <Route path="/app/fila-offline" component={FilaOfflinePage} />
              <Route component={NotFound} />
            </Switch>
          </Layout>
        </OfflineSyncProvider>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function BypassProviderWithRoutes() {
  return (
    <SignOutContext.Provider value={() => { window.location.href = "/"; }}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AppRoutes />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </SignOutContext.Provider>
  );
}

function SupabaseProviderWithRoutes() {
  const [sessionState, setSessionState] = useState<SessionState>({ session: null, isLoading: true });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessionState({ session: data.session, isLoading: false });
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionState({ session, isLoading: false });
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  return (
    <SessionContext.Provider value={sessionState}>
      <SignOutContext.Provider value={async () => { await supabase.auth.signOut(); }}>
        <QueryClientProvider client={queryClient}>
          <SupabaseQueryClientCacheInvalidator session={sessionState.session} />
          <TooltipProvider>
            <AppRoutes />
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </SignOutContext.Provider>
    </SessionContext.Provider>
  );
}

function App() {
  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      {AUTH_BYPASS ? <BypassProviderWithRoutes /> : <SupabaseProviderWithRoutes />}
    </WouterRouter>
  );
}

export default App;
