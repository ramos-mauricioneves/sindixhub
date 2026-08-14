import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Loader2, Plus, ShieldAlert, Wrench, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/components/layout";
import { apiFetch, ApiFetchError } from "@/lib/api-fetch";

interface Empresa {
  id: number;
  nome: string;
  cnpj: string | null;
  ativo: boolean;
  createdAt: string;
}

interface Condominio {
  id: number;
  nome: string;
}

interface PrestadorMestre {
  id: number;
  empresaId: number;
  nome: string;
  categoria: string | null;
  telefone: string | null;
  email: string | null;
  ativo: boolean;
}

interface PrestadorUsuario {
  id: number;
  clerkId: string;
  email: string;
  name: string | null;
}

const CATEGORIA_LABELS: Record<string, string> = {
  elevador: "Elevador", hidraulica: "Hidráulica", eletrica: "Elétrica", pintura: "Pintura",
  jardinagem: "Jardinagem", portaria_seguranca: "Portaria/Segurança", limpeza: "Limpeza",
  ar_condicionado: "Ar-condicionado", estrutural_civil: "Estrutural/Civil", incendio_ppci: "Incêndio/PPCI",
  dedetizacao: "Dedetização", outro: "Outro",
};

// Prestador master records for one empresa, plus per-prestador linked-login-user
// management (the "zelador de terceirizada loga e o sistema já sabe" feature
// from Phase 2) and a bulk "associar a todos os condomínios" action. Nested
// inside the expanded empresa row in AdminEmpresasPage below.
function EmpresaPrestadoresPanel({ empresaId, condominiosDaEmpresa }: { empresaId: number; condominiosDaEmpresa: Condominio[] | undefined }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [novoNome, setNovoNome] = useState("");
  const [novoTelefone, setNovoTelefone] = useState("");
  const [novaCategoria, setNovaCategoria] = useState("");
  const [expandedPrestadorId, setExpandedPrestadorId] = useState<number | null>(null);
  const [emailParaVincular, setEmailParaVincular] = useState("");

  const prestadoresKey = ["empresas", empresaId, "prestadores"];
  const { data: prestadores, isPending } = useQuery({
    queryKey: prestadoresKey,
    queryFn: () => apiFetch<PrestadorMestre[]>(`/api/empresas/${empresaId}/prestadores`),
  });

  const { data: usuariosVinculados } = useQuery({
    queryKey: ["prestadores", expandedPrestadorId, "usuarios"],
    queryFn: () => apiFetch<PrestadorUsuario[]>(`/api/prestadores/${expandedPrestadorId}/usuarios`),
    enabled: expandedPrestadorId !== null,
  });

  const criarPrestador = useMutation({
    mutationFn: () => apiFetch<PrestadorMestre>(`/api/empresas/${empresaId}/prestadores`, {
      method: "POST",
      body: JSON.stringify({ nome: novoNome.trim(), categoria: novaCategoria || undefined, telefone: novoTelefone || undefined }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: prestadoresKey });
      toast({ title: "Prestador cadastrado" });
      setNovoNome(""); setNovoTelefone(""); setNovaCategoria("");
    },
    onError: (e: Error) => toast({ title: "Erro ao cadastrar", description: e.message, variant: "destructive" }),
  });

  const vincularUsuario = useMutation({
    mutationFn: (prestadorId: number) => apiFetch(`/api/prestadores/${prestadorId}/usuarios`, {
      method: "POST",
      body: JSON.stringify({ email: emailParaVincular.trim() }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prestadores", expandedPrestadorId, "usuarios"] });
      toast({ title: "Usuário vinculado" });
      setEmailParaVincular("");
    },
    onError: (e: Error) => toast({ title: "Erro ao vincular", description: e.message, variant: "destructive" }),
  });

  const desvincularUsuario = useMutation({
    mutationFn: ({ prestadorId, userId }: { prestadorId: number; userId: number }) =>
      apiFetch(`/api/prestadores/${prestadorId}/usuarios/${userId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prestadores", expandedPrestadorId, "usuarios"] });
      toast({ title: "Usuário desvinculado" });
    },
  });

  const aplicarATodos = useMutation({
    mutationFn: async (prestadorId: number) => {
      if (!condominiosDaEmpresa) return;
      let associados = 0;
      for (const condo of condominiosDaEmpresa) {
        try {
          await apiFetch(`/api/condominios/${condo.id}/prestadores`, { method: "POST", body: JSON.stringify({ prestadorId }) });
          associados++;
        } catch (e) {
          // 409 = já estava associado a este condomínio — esperado e ignorado.
          if (!(e instanceof ApiFetchError) || e.status !== 409) throw e;
        }
      }
      return associados;
    },
    onSuccess: (associados) => toast({ title: `Associado a ${associados ?? 0} condomínio(s) novo(s)` }),
    onError: (e: Error) => toast({ title: "Erro ao aplicar a todos", description: e.message, variant: "destructive" }),
  });

  if (isPending) return <Loader2 className="h-4 w-4 animate-spin" />;

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
        <Wrench className="h-3.5 w-3.5" /> Prestadores desta empresa
      </p>

      {(!prestadores || prestadores.length === 0) && <p className="text-xs text-muted-foreground">Nenhum prestador cadastrado ainda.</p>}

      {prestadores?.map((p) => (
        <div key={p.id} className="border rounded-md p-2.5 bg-background space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="text-sm font-medium">{p.nome}</span>
              {p.categoria && <Badge variant="outline" className="ml-2 text-xs">{CATEGORIA_LABELS[p.categoria] ?? p.categoria}</Badge>}
              {p.telefone && <span className="text-xs text-muted-foreground ml-2">{p.telefone}</span>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => aplicarATodos.mutate(p.id)} disabled={aplicarATodos.isPending || !condominiosDaEmpresa?.length}>
                Aplicar a todos os condomínios
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setExpandedPrestadorId(expandedPrestadorId === p.id ? null : p.id)}>
                <UserPlus className="h-3.5 w-3.5 mr-1" /> Usuários
              </Button>
            </div>
          </div>

          {expandedPrestadorId === p.id && (
            <div className="pl-2 border-l-2 space-y-2">
              {!usuariosVinculados ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : usuariosVinculados.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum usuário vinculado.</p>
              ) : (
                <ul className="space-y-1">
                  {usuariosVinculados.map((u) => (
                    <li key={u.id} className="flex items-center justify-between text-xs">
                      <span>{u.name || u.email} <span className="text-muted-foreground">({u.email})</span></span>
                      <button onClick={() => desvincularUsuario.mutate({ prestadorId: p.id, userId: u.id })} className="text-muted-foreground hover:text-destructive">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex items-center gap-2">
                <Input
                  placeholder="e-mail do usuário (já precisa ter feito login antes)"
                  value={emailParaVincular}
                  onChange={(e) => setEmailParaVincular(e.target.value)}
                  className="h-7 text-xs"
                />
                <Button size="sm" className="h-7 text-xs" onClick={() => vincularUsuario.mutate(p.id)} disabled={!emailParaVincular.trim() || vincularUsuario.isPending}>
                  {vincularUsuario.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Vincular"}
                </Button>
              </div>
            </div>
          )}
        </div>
      ))}

      <div className="flex items-end gap-2 pt-2 border-t">
        <div className="flex-1 space-y-1">
          <Label className="text-xs">Novo prestador</Label>
          <Input placeholder="Nome" value={novoNome} onChange={(e) => setNovoNome(e.target.value)} className="h-8 text-xs" />
        </div>
        <Input placeholder="Categoria" value={novaCategoria} onChange={(e) => setNovaCategoria(e.target.value)} className="h-8 text-xs w-32" />
        <Input placeholder="Telefone" value={novoTelefone} onChange={(e) => setNovoTelefone(e.target.value)} className="h-8 text-xs w-32" />
        <Button size="sm" className="h-8" onClick={() => criarPrestador.mutate()} disabled={!novoNome.trim() || criarPrestador.isPending}>
          {criarPrestador.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );
}

// Platform-level tenant management — only SindixHub's own staff
// (role === "global_admin") can see or use this page. Manages the
// `empresas` table introduced in the multi-tenant migration (Phase 1).
// Uses apiFetch (plain fetch + Supabase session token) rather than the
// generated api-client-react hooks — /api/empresas isn't in the OpenAPI
// spec yet, see src/lib/api-fetch.ts for why.
export default function AdminEmpresasPage() {
  const [, setLocation] = useLocation();
  const currentUser = useUser();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: empresas, isPending } = useQuery({
    queryKey: ["empresas"],
    queryFn: () => apiFetch<Empresa[]>("/api/empresas"),
    enabled: (currentUser?.role as string | undefined) === "global_admin",
  });

  const { data: condominiosDaEmpresa } = useQuery({
    queryKey: ["empresas", expandedId, "condominios"],
    queryFn: () => apiFetch<Condominio[]>(`/api/empresas/${expandedId}/condominios`),
    enabled: expandedId !== null,
  });

  const createEmpresa = useMutation({
    mutationFn: () => apiFetch<Empresa>("/api/empresas", { method: "POST", body: JSON.stringify({ nome, cnpj: cnpj || undefined }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["empresas"] });
      toast({ title: "Empresa criada" });
      setDialogOpen(false);
      setNome("");
      setCnpj("");
    },
    onError: (e: Error) => toast({ title: "Erro ao criar empresa", description: e.message, variant: "destructive" }),
  });

  // Cast: "global_admin" isn't in the generated UserProfileRole union yet.
  if (currentUser && (currentUser.role as string) !== "global_admin") {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <ShieldAlert className="h-16 w-16 text-destructive opacity-50 mb-4" />
        <p className="text-muted-foreground">Acesso restrito à equipe SindixHub.</p>
        <Button variant="outline" className="mt-4" onClick={() => setLocation("/app/nova-vistoria")}>
          Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Building2 className="h-5 w-5" /> Empresas (síndicos profissionais)
          </h1>
          <p className="text-sm text-muted-foreground">Gestão de tenants da plataforma SindixHub.</p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nova empresa
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isPending ? (
            <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : !empresas || empresas.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Nenhuma empresa cadastrada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Condomínios</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {empresas.map((e) => (
                  <>
                    <TableRow key={e.id} className="cursor-pointer" onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}>
                      <TableCell className="font-medium">{e.nome}</TableCell>
                      <TableCell>{e.cnpj ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={e.ativo ? "secondary" : "outline"}>{e.ativo ? "ativa" : "inativa"}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {expandedId === e.id ? "clique para recolher" : "clique para ver condomínios"}
                      </TableCell>
                    </TableRow>
                    {expandedId === e.id && (
                      <TableRow key={`${e.id}-detail`}>
                        <TableCell colSpan={4} className="bg-muted/30 space-y-4">
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Condomínios</p>
                            {!condominiosDaEmpresa ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : condominiosDaEmpresa.length === 0 ? (
                              <p className="text-xs text-muted-foreground">Nenhum condomínio nesta empresa ainda.</p>
                            ) : (
                              <ul className="text-sm space-y-1">
                                {condominiosDaEmpresa.map((c) => <li key={c.id}>• {c.nome}</li>)}
                              </ul>
                            )}
                          </div>
                          <EmpresaPrestadoresPanel empresaId={e.id} condominiosDaEmpresa={condominiosDaEmpresa} />
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova empresa</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Síndico Profissional Ltda" />
            </div>
            <div className="space-y-1.5">
              <Label>CNPJ</Label>
              <Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0001-00" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => createEmpresa.mutate()} disabled={!nome.trim() || createEmpresa.isPending}>
              {createEmpresa.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
