import { Show } from "@clerk/react";
import { Link, useLocation } from "wouter";
import { useGetMe } from "@workspace/api-client-react";
import { ClipboardCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

function AuthenticatedRedirect() {
  const [, setLocation] = useLocation();
  const { data: user, isPending } = useGetMe();

  if (isPending) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) {
    if (user.role === "admin") {
      setLocation("/app/admin");
    } else if (user.role === "sindico") {
      setLocation("/app/historico");
    } else {
      setLocation("/app/nova-vistoria");
    }
  }

  return null;
}

export default function HomeRedirect() {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  return (
    <>
      <Show when="signed-in">
        <AuthenticatedRedirect />
      </Show>
      <Show when="signed-out">
        <div className="min-h-[100dvh] flex flex-col bg-background text-foreground">
          <header className="p-4 flex items-center justify-between border-b bg-card">
            <div className="flex items-center gap-2 text-primary font-bold text-xl">
              <ClipboardCheck className="h-6 w-6" />
              <span>Vistorias</span>
            </div>
            <div className="flex items-center gap-2">
              <Link href={`${basePath}/sign-in`} className="text-sm font-medium hover:underline text-muted-foreground px-4 py-2">
                Entrar
              </Link>
              <Link href={`${basePath}/sign-up`}>
                <Button size="sm">Cadastrar</Button>
              </Link>
            </div>
          </header>

          <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="max-w-md w-full mx-auto space-y-8">
              <div className="inline-flex items-center justify-center p-4 bg-primary/10 rounded-full mb-4">
                <ClipboardCheck className="h-12 w-12 text-primary" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
                Assistente de Vistoria Condominial
              </h1>
              <p className="text-lg text-muted-foreground">
                Ferramenta profissional para síndicos e vistoriadores. Registre ocorrências, analise imagens e gere relatórios com IA diretamente do local.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                <Link href={`${basePath}/sign-in`} className="w-full sm:w-auto">
                  <Button size="lg" className="w-full text-base h-12 px-8">
                    Fazer Login
                  </Button>
                </Link>
                <Link href={`${basePath}/sign-up`} className="w-full sm:w-auto">
                  <Button size="lg" variant="outline" className="w-full text-base h-12 px-8">
                    Criar Conta
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
