import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useListCondominios } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { UserRound, Plus, Pencil, Trash2, Loader2, Phone, Mail, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { useUser } from "@/components/layout";

interface Morador {
  id: number;
  condominioId: number;
  unidade: string;
  nome: string;
  tipo: string;
  telefone: string | null;
  email: string | null;
  ativo: boolean;
  createdAt: string;
}

const TIPO_COLORS: Record<string, string> = {
  proprietario: "bg-blue-50 text-blue-700 border-blue-200",
  inquilino: "bg-green-50 text-green-700 border-green-200",
  morador: "bg-purple-50 text-purple-700 border-purple-200",
  dependente: "bg-orange-50 text-orange-700 border-orange-200",
};

const TIPO_LABELS: Record<string, string> = {
  proprietario: "Proprietário",
  inquilino: "Inquilino",
  morador: "Morador",
  dependente: "Dependente",
};

export default function MoradoresPage() {
  const { t, i18n } = useTranslation();
  const user = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [condominioId, setCondominioId] = useState<string>("");
  const [filterTipo, setFilterTipo] = useState<string>("todos");
  const [filterAtivo, setFilterAtivo] = useState<string>("ativos");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [moradores, setMoradores] = useState<Morador[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [showDialog, setShowDialog] = useState(false);
  const [editingMorador, setEditingMorador] = useState<Morador | null>(null);
  const [form, setForm] = useState({ unidade: "", nome: "", tipo: "morador", telefone: "", email: "", ativo: true });
  const [isSaving, setIsSaving] = useState(false);

  const { data: condominios } = useListCondominios();
  const canEdit = user?.role === "admin" || user?.role === "sindico";

  const loadMoradores = async (condId: string) => {
    if (!condId) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterTipo && filterTipo !== "todos") params.set("tipo", filterTipo);
      if (filterAtivo === "ativos") params.set("ativo", "true");
      if (filterAtivo === "inativos") params.set("ativo", "false");
      const res = await fetch(`/api/condominios/${condId}/moradores?${params}`);
      if (res.ok) setMoradores(await res.json());
    } finally {
      setIsLoading(false);
    }
  };

  const handleCondominioChange = (val: string) => {
    setCondominioId(val);
    loadMoradores(val);
  };

  const openCreate = () => {
    setEditingMorador(null);
    setForm({ unidade: "", nome: "", tipo: "morador", telefone: "", email: "", ativo: true });
    setShowDialog(true);
  };

  const openEdit = (m: Morador) => {
    setEditingMorador(m);
    setForm({ unidade: m.unidade, nome: m.nome, tipo: m.tipo, telefone: m.telefone ?? "", email: m.email ?? "", ativo: m.ativo });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!form.unidade || !form.nome || !form.tipo) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" }); return;
    }
    setIsSaving(true);
    try {
      const payload = { ...form, telefone: form.telefone || null, email: form.email || null };
      let res: Response;
      if (editingMorador) {
        res = await fetch(`/api/condominios/${condominioId}/moradores/${editingMorador.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/condominios/${condominioId}/moradores`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, condominioId: parseInt(condominioId) }),
        });
      }
      if (!res.ok) {
        const err = await res.json();
        toast({ title: err.error || "Erro ao salvar", variant: "destructive" }); return;
      }
      toast({ title: editingMorador ? "Morador atualizado" : "Morador criado" });
      setShowDialog(false);
      loadMoradores(condominioId);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Excluir este morador?")) return;
    await fetch(`/api/condominios/${condominioId}/moradores/${id}`, { method: "DELETE" });
    toast({ title: "Morador excluído" });
    loadMoradores(condominioId);
  };

  const filtered = moradores.filter((m) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return m.nome.toLowerCase().includes(term) || m.unidade.toLowerCase().includes(term);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <UserRound className="h-6 w-6 text-primary" />
            {i18n.language === "pt" ? "Moradores" : "Residents"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {i18n.language === "pt" ? "Gestão de moradores e proprietários" : "Manage residents and owners"}
          </p>
        </div>
        {canEdit && condominioId && (
          <Button onClick={openCreate} data-testid="button-novo-morador">
            <Plus className="h-4 w-4 mr-2" />
            {i18n.language === "pt" ? "Novo Morador" : "New Resident"}
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <Select value={condominioId} onValueChange={handleCondominioChange}>
              <SelectTrigger>
                <SelectValue placeholder={i18n.language === "pt" ? "Selecionar condomínio" : "Select condominium"} />
              </SelectTrigger>
              <SelectContent>
                {condominios?.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterTipo} onValueChange={(v) => { setFilterTipo(v); if (condominioId) loadMoradores(condominioId); }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">{i18n.language === "pt" ? "Todos os tipos" : "All types"}</SelectItem>
                <SelectItem value="proprietario">Proprietário</SelectItem>
                <SelectItem value="inquilino">Inquilino</SelectItem>
                <SelectItem value="morador">Morador</SelectItem>
                <SelectItem value="dependente">Dependente</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterAtivo} onValueChange={(v) => { setFilterAtivo(v); if (condominioId) loadMoradores(condominioId); }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ativos">{i18n.language === "pt" ? "Ativos" : "Active"}</SelectItem>
                <SelectItem value="inativos">{i18n.language === "pt" ? "Inativos" : "Inactive"}</SelectItem>
                <SelectItem value="todos">{i18n.language === "pt" ? "Todos" : "All"}</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder={i18n.language === "pt" ? "Buscar por nome ou unidade..." : "Search by name or unit..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* List */}
      {!condominioId ? (
        <div className="text-center py-12 text-muted-foreground">
          <UserRound className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>{i18n.language === "pt" ? "Selecione um condomínio para ver os moradores" : "Select a condominium to view residents"}</p>
        </div>
      ) : isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <UserRound className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>{i18n.language === "pt" ? "Nenhum morador encontrado" : "No residents found"}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filtered.map((m) => (
            <Card key={m.id} className="hover:border-primary/40 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-base">{m.nome}</span>
                      <Badge variant="outline" className="text-xs font-mono">{m.unidade}</Badge>
                      <Badge variant="outline" className={`text-xs ${TIPO_COLORS[m.tipo] || ""}`}>
                        {TIPO_LABELS[m.tipo] || m.tipo}
                      </Badge>
                      {!m.ativo && (
                        <Badge variant="outline" className="text-xs bg-gray-50 text-gray-500 border-gray-200">
                          {i18n.language === "pt" ? "Inativo" : "Inactive"}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                      {m.telefone && (
                        <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{m.telefone}</span>
                      )}
                      {m.email && (
                        <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{m.email}</span>
                      )}
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(m)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(m.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingMorador ? (i18n.language === "pt" ? "Editar Morador" : "Edit Resident") : (i18n.language === "pt" ? "Novo Morador" : "New Resident")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{i18n.language === "pt" ? "Unidade *" : "Unit *"}</Label>
                <Input placeholder="101" value={form.unidade} onChange={(e) => setForm({ ...form, unidade: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>{i18n.language === "pt" ? "Tipo *" : "Type *"}</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="proprietario">Proprietário</SelectItem>
                    <SelectItem value="inquilino">Inquilino</SelectItem>
                    <SelectItem value="morador">Morador</SelectItem>
                    <SelectItem value="dependente">Dependente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{i18n.language === "pt" ? "Nome completo *" : "Full name *"}</Label>
              <Input placeholder="João Silva" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{i18n.language === "pt" ? "Telefone" : "Phone"}</Label>
              <Input placeholder="(11) 99999-9999" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input placeholder="email@exemplo.com" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, ativo: !form.ativo })}
                className={`flex items-center gap-1.5 text-sm ${form.ativo ? "text-green-600" : "text-gray-500"}`}
              >
                {form.ativo ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                {form.ativo ? (i18n.language === "pt" ? "Ativo" : "Active") : (i18n.language === "pt" ? "Inativo" : "Inactive")}
              </button>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">{i18n.language === "pt" ? "Cancelar" : "Cancel"}</Button></DialogClose>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {i18n.language === "pt" ? "Salvar" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
