import React, { createContext, useContext } from "react";
import { Link, useLocation } from "wouter";
import { useClerk } from "@clerk/react";
import { useGetMe, UserProfile } from "@workspace/api-client-react";
import { FileText, History, Users, LogOut, ClipboardCheck } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";

const UserContext = createContext<UserProfile | undefined>(undefined);

export function useUser() {
  return useContext(UserContext);
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { data: user, isPending, isError } = useGetMe();
  const { signOut } = useClerk();
  const [location] = useLocation();

  if (isPending) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  if (isError || !user) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background p-4 text-center">
        <p className="text-muted-foreground mb-4">Erro ao carregar perfil.</p>
        <Button onClick={() => window.location.reload()}>Tentar novamente</Button>
      </div>
    );
  }

  const role = user.role;

  const navItems = [];
  if (role === "admin") {
    navItems.push({ label: "Nova Vistoria", path: "/app/nova-vistoria", icon: FileText });
    navItems.push({ label: "Todas Vistorias", path: "/app/historico", icon: History });
    navItems.push({ label: "Usuários", path: "/app/admin", icon: Users });
  } else if (role === "sindico") {
    navItems.push({ label: "Nova Vistoria", path: "/app/nova-vistoria", icon: FileText });
    navItems.push({ label: "Vistorias", path: "/app/historico", icon: History });
  } else {
    navItems.push({ label: "Nova Vistoria", path: "/app/nova-vistoria", icon: FileText });
    navItems.push({ label: "Meu Histórico", path: "/app/historico", icon: History });
  }

  return (
    <UserContext.Provider value={user}>
      <div className="min-h-[100dvh] bg-background md:flex">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex flex-col w-64 bg-card border-r px-4 py-6">
          <div className="flex items-center gap-2 px-2 mb-8 text-primary font-bold text-xl">
            <ClipboardCheck className="h-6 w-6" />
            <span>Vistorias</span>
          </div>

          <nav className="flex-1 space-y-2">
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
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto border-t pt-4">
            <div className="px-2 mb-4">
              <p className="text-sm font-medium truncate">{user.name || user.email}</p>
              <p className="text-xs text-muted-foreground capitalize">{role}</p>
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start text-muted-foreground hover:text-foreground"
              onClick={() => signOut()}
              data-testid="button-signout"
            >
              <LogOut className="h-5 w-5 mr-2" />
              Sair
            </Button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0 pb-[80px] md:pb-0">
          <div className="md:hidden flex items-center justify-between p-4 bg-card border-b">
            <div className="flex items-center gap-2 text-primary font-bold text-lg">
              <ClipboardCheck className="h-5 w-5" />
              <span>Vistorias</span>
            </div>
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
          <div className="flex-1 overflow-auto bg-background p-4 md:p-8">
            <div className="mx-auto max-w-3xl w-full">
              {children}
            </div>
          </div>
        </main>

        {/* Mobile Bottom Nav */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t flex justify-around p-2 pb-safe z-50">
          {navItems.map((item) => {
            const isActive = location === item.path || location.startsWith(`${item.path}/`);
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`flex flex-col items-center justify-center p-2 min-w-[64px] transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
                data-testid={`nav-mobile-${item.path.replace("/app/", "")}`}
              >
                <item.icon className="h-6 w-6 mb-1" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </UserContext.Provider>
  );
}
