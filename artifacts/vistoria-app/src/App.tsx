import { createContext, useContext, useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, useClerk } from "@clerk/react";
import { Switch, Route, useLocation, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import NotFound from "@/pages/not-found";
import HomeRedirect from "@/pages/home";
import NovaVistoriaPage from "@/pages/nova-vistoria";
import HistoricoPage from "@/pages/historico";
import VistoriaDetailPage from "@/pages/vistoria-detail";
import AdminPage from "@/pages/admin";
import CondominiosPage from "@/pages/condominios";
import DashboardPage from "@/pages/dashboard";
import AtivosPage from "@/pages/ativos";
import MoradoresPage from "@/pages/moradores";
import FinanceiroPage from "@/pages/financeiro";
import Layout from "@/components/layout";

export const AUTH_BYPASS = import.meta.env.VITE_AUTH_BYPASS === "true";

export const SignOutContext = createContext<() => void | Promise<void>>(() => {});
export function useSignOut() { return useContext(SignOutContext); }

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function SignInPage() {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  return (
    <div style={{ display: "flex", justifyContent: "center", marginTop: "2rem" }}>
      <SignIn routing="path" path={basePath + "/sign-in"} signUpUrl={basePath + "/sign-up"} />
    </div>
  );
}

function SignUpPage() {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  return (
    <div style={{ display: "flex", justifyContent: "center", marginTop: "2rem" }}>
      <SignUp routing="path" path={basePath + "/sign-up"} signInUrl={basePath + "/sign-in"} />
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

function ClerkSignOutWrapper({ children }: { children: React.ReactNode }) {
  const { signOut } = useClerk();
  return (
    <SignOutContext.Provider value={() => signOut()}>
      {children}
    </SignOutContext.Provider>
  );
}

function AppRoutes() {
  return (
    <Switch>
      <Route path="/" component={HomeRedirect} />
      {!AUTH_BYPASS && <Route path="/sign-in/*?" component={SignInPage} />}
      {!AUTH_BYPASS && <Route path="/sign-up/*?" component={SignUpPage} />}
      <Route path="/app/*">
        <Layout>
          <Switch>
            <Route path="/app/dashboard" component={DashboardPage} />
            <Route path="/app/nova-vistoria" component={NovaVistoriaPage} />
            <Route path="/app/historico" component={HistoricoPage} />
            <Route path="/app/vistoria/:id" component={VistoriaDetailPage} />
            <Route path="/app/admin" component={AdminPage} />
            <Route path="/app/condominios" component={CondominiosPage} />
            <Route path="/app/ativos" component={AtivosPage} />
            <Route path="/app/moradores" component={MoradoresPage} />
            <Route path="/app/financeiro" component={FinanceiroPage} />
            <Route component={NotFound} />
          </Switch>
        </Layout>
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

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
  const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  function stripBase(path: string) {
    return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || "/" : path;
  }

  if (!clerkPubKey) {
    return <div>Missing VITE_CLERK_PUBLISHABLE_KEY</div>;
  }

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkSignOutWrapper>
          <ClerkQueryClientCacheInvalidator />
          <TooltipProvider>
            <AppRoutes />
            <Toaster />
          </TooltipProvider>
        </ClerkSignOutWrapper>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      {AUTH_BYPASS ? <BypassProviderWithRoutes /> : <ClerkProviderWithRoutes />}
    </WouterRouter>
  );
}

export default App;
