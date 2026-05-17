import { useEffect } from "react";
import { Show } from "@clerk/react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useGetMe } from "@workspace/api-client-react";
import { Loader2, Globe } from "lucide-react";
import { SindixHubLogo } from "@/components/sindixhub-logo";
import { Button } from "@/components/ui/button";
import { AUTH_BYPASS } from "@/App";

function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const toggle = () => {
    const next = i18n.language === "pt" ? "en" : "pt";
    i18n.changeLanguage(next);
    localStorage.setItem("lang", next);
  };
  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      data-testid="button-lang-switch-landing"
    >
      <Globe className="h-4 w-4" />
      {i18n.language === "pt" ? "EN" : "PT"}
    </button>
  );
}

function AuthenticatedRedirect() {
  const [, setLocation] = useLocation();
  const { data: user, isPending } = useGetMe();

  useEffect(() => {
    if (AUTH_BYPASS) {
      setLocation("/app/dashboard");
      return;
    }
    if (user) {
      if (user.role === "admin" || user.role === "sindico") {
        setLocation("/app/dashboard");
      } else {
        setLocation("/app/nova-vistoria");
      }
    }
  }, [user, setLocation]);

  if (isPending || AUTH_BYPASS) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return null;
}

export default function HomeRedirect() {
  const { t } = useTranslation();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  if (AUTH_BYPASS) {
    return <AuthenticatedRedirect />;
  }

  return (
    <>
      <Show when="signed-in">
        <AuthenticatedRedirect />
      </Show>
      <Show when="signed-out">
        <div className="min-h-[100dvh] flex flex-col bg-background text-foreground">
          <header className="p-4 flex items-center justify-between border-b bg-card">
            <div className="flex items-center gap-2 text-primary font-bold text-xl">
              <SindixHubLogo className="h-6 w-6" />
              <span>SindixHub</span>
            </div>
            <div className="flex items-center gap-3">
              <LanguageSwitcher />
              <Link href={`${basePath}/sign-in`} className="text-sm font-medium hover:underline text-muted-foreground px-3 py-2">
                {t("home.enter")}
              </Link>
              <Link href={`${basePath}/sign-up`}>
                <Button size="sm">{t("home.register")}</Button>
              </Link>
            </div>
          </header>

          <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="max-w-md w-full mx-auto space-y-8">
              <div className="inline-flex items-center justify-center p-4 bg-primary/10 rounded-full mb-4">
                <SindixHubLogo className="h-12 w-12 text-primary" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
                {t("home.title")}
              </h1>
              <p className="text-lg text-muted-foreground">
                {t("home.subtitle")}
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                <Link href={`${basePath}/sign-in`} className="w-full sm:w-auto">
                  <Button size="lg" className="w-full text-base h-12 px-8">
                    {t("home.signIn")}
                  </Button>
                </Link>
                <Link href={`${basePath}/sign-up`} className="w-full sm:w-auto">
                  <Button size="lg" variant="outline" className="w-full text-base h-12 px-8">
                    {t("home.signUp")}
                  </Button>
                </Link>
              </div>
            </div>
          </main>
        </div>
      </Show>
    </>
  );
}
