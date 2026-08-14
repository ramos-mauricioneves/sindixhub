import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Loader2, Plus, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/components/layout";
import { apiFetch } from "@/lib/api-fetch";

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
                        <TableCell colSpan={4} className="bg-muted/30">
                          {!condominiosDaEmpresa ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : condominiosDaEmpresa.length === 0 ? (
                            <p className="text-xs text-muted-foreground">Nenhum condomínio nesta empresa ainda.</p>
                          ) : (
                            <ul className="text-sm space-y-1">
                              {condominiosDaEmpresa.map((c) => <li key={c.id}>• {c.nome}</li>)}
                            </ul>
                          )}
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
