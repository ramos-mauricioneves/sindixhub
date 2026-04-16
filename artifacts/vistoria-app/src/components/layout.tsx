import React, { createContext, useContext } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useGetMe, UserProfile } from "@workspace/api-client-react";
import { FileText, History, Users, LogOut, Building2, Globe, Loader2, LayoutDashboard, Package, UserRound, Wallet, ClipboardCheck, CalendarDays, MessageSquareWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSignOut } from "@/App";

const UserContext = createContext<UserProfile | undefined>(undefined);

export function useUser() {
  return useContext(UserContext);
}

function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const currentLang = i18n.language;

  const toggle = () => {
    const next = currentLang === "pt" ? "en" : "pt";
    i18n.changeLanguage(next);
    localStorage.setItem("lang", next);
  };

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted"
      data-testid="button-lang-switch"
      title={currentLang === "pt" ? "Switch to English" : "Mudar para Português"}
    >
      <Globe className="h-3.5 w-3.5" />
      {currentLang === "pt" ? "EN" : "PT"}
    </button>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { data: user, isPending, isError } = useGetMe();
  const signOut = useSignOut();
  const [location] = useLocation();

  if (isPending) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !user) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background p-4 text-center">
        <p className="text-muted-foreground mb-4">{t("errors.profileError")}</p>
        <Button onClick={() => window.location.reload()}>{t("errors.tryAgain")}</Button>
      </div>
    );
  }

  const role = user.role;

  const navItems = [];
  if (role === "admin") {
    navItems.push({ label: t("nav.dashboard"), path: "/app/dashboard", icon: LayoutDashboard });
    navItems.push({ label: t("nav.ocorrencias"), path: "/app/ocorrencias", icon: MessageSquareWarning });
    navItems.push({ label: t("nav.reservas"), path: "/app/reservas", icon: CalendarDays });
    navItems.push({ label: t("nav.moradores"), path: "/app/moradores", icon: UserRound });
    navItems.push({ label: t("nav.financeiro"), path: "/app/financeiro", icon: Wallet });
    navItems.push({ label: t("nav.ativos"), path: "/app/ativos", icon: Package });
    navItems.push({ label: t("nav.vistorias"), path: "/app/historico", icon: ClipboardCheck });
    navItems.push({ label: t("nav.novaVistoria"), path: "/app/nova-vistoria", icon: FileText });
    navItems.push({ label: t("nav.condominios"), path: "/app/condominios", icon: Building2 });
    navItems.push({ label: t("nav.usuarios"), path: "/app/admin", icon: Users });
  } else if (role === "sindico") {
    navItems.push({ label: t("nav.dashboard"), path: "/app/dashboard", icon: LayoutDashboard });
    navItems.push({ label: t("nav.ocorrencias"), path: "/app/ocorrencias", icon: MessageSquareWarning });
    navItems.push({ label: t("nav.reservas"), path: "/app/reservas", icon: CalendarDays });
    navItems.push({ label: t("nav.moradores"), path: "/app/moradores", icon: UserRound });
    navItems.push({ label: t("nav.financeiro"), path: "/app/financeiro", icon: Wallet });
    navItems.push({ label: t("nav.ativos"), path: "/app/ativos", icon: Package });
    navItems.push({ label: t("nav.vistorias"), path: "/app/historico", icon: ClipboardCheck });
    navItems.push({ label: t("nav.novaVistoria"), path: "/app/nova-vistoria", icon: FileText });
  } else {
    navItems.push({ label: t("nav.novaVistoria"), path: "/app/nova-vistoria", icon: FileText });
    navItems.push({ label: t("nav.historico"), path: "/app/historico", icon: History });
  }

  return (
    <UserContext.Provider value={user}>
      <div className="min-h-[100dvh] bg-background md:flex">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex flex-col w-64 bg-card border-r px-4 py-6">
          <div className="flex items-center gap-2 px-2 mb-8 text-primary font-bold text-xl">
            <Building2 className="h-6 w-6" />
            <span>CondoGest</span>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = location === item.path || location.startsWith(`${item.path}/`);
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground font-medium"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                  data-testid={`nav-desktop-${item.path.replace("/app/", "")}`}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto border-t pt-4 space-y-2">
            <div className="flex items-center justify-between px-2">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{user.name || user.email}</p>
                <p className="text-xs text-muted-foreground capitalize">{role}</p>
              </div>
              <LanguageSwitcher />
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start text-muted-foreground hover:text-foreground"
              onClick={() => signOut()}
              data-testid="button-signout"
            >
              <LogOut className="h-5 w-5 mr-2" />
              {t("common.signOut")}
            </Button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0 pb-[80px] md:pb-0">
          <div className="md:hidden flex items-center justify-between p-4 bg-card border-b">
            <div className="flex items-center gap-2 text-primary font-bold text-lg">
              <Building2 className="h-5 w-5" />
              <span>CondoGest</span>
            </div>
            <div className="flex items-center gap-2">
              <LanguageSwitcher />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => signOut()}
                className="text-muted-foreground"
                data-testid="button-signout-mobile"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-auto bg-background p-4 md:p-8">
            <div className="mx-auto max-w-3xl w-full">
              {children}
            </div>
          </div>
        </main>

        {/* Mobile Bottom Nav — show max 5 most important items */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t flex justify-around p-2 pb-safe z-50">
          {navItems.slice(0, 5).map((item) => {
            const isActive = location === item.path || location.startsWith(`${item.path}/`);
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`flex flex-col items-center justify-center p-2 min-w-[52px] transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
                data-testid={`nav-mobile-${item.path.replace("/app/", "")}`}
              >
                <item.icon className="h-5 w-5 mb-1" />
                <span className="text-[9px] font-medium leading-tight text-center">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </UserContext.Provider>
  );
}
