import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useListCondominios } from "@workspace/api-client-react";
import { Wallet, Plus, Pencil, Trash2, Loader2, TrendingUp, TrendingDown, CheckCircle2, Clock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useUser } from "@/components/layout";

interface Lancamento {
  id: number;
  condominioId: number;
  tipo: string;
  categoria: string;
  descricao: string;
  valor: string;
  dataVencimento: string;
  dataPagamento: string | null;
  status: string;
  observacao: string | null;
  createdAt: string;
}

const CATEGORIA_LABELS: Record<string, string> = {
  taxa_condominio: "Taxa de Condomínio",
  fundo_reserva: "Fundo de Reserva",
  manutencao: "Manutenção",
  agua: "Água",
  energia: "Energia",
  seguro: "Seguro",
  pessoal: "Pessoal",
  administrativo: "Administrativo",
  outros: "Outros",
};

const STATUS_COLORS: Record<string, string> = {
  pendente: "bg-yellow-50 text-yellow-700 border-yellow-200",
  pago: "bg-green-50 text-green-700 border-green-200",
  cancelado: "bg-gray-50 text-gray-500 border-gray-200",
  atrasado: "bg-red-50 text-red-700 border-red-200",
};

const STATUS_ICONS: Record<string, any> = {
  pendente: Clock,
  pago: CheckCircle2,
  cancelado: XCircle,
  atrasado: XCircle,
};

function formatCurrency(val: string) {
  const num = parseFloat(val);
  if (isNaN(num)) return val;
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function FinanceiroPage() {
  const { i18n } = useTranslation();
  const user = useUser();
  const { toast } = useToast();

  const [condominioId, setCondominioId] = useState<string>("");
  const [filterTipo, setFilterTipo] = useState<string>("todos");
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [showDialog, setShowDialog] = useState(false);
  const [editingLancamento, setEditingLancamento] = useState<Lancamento | null>(null);
  const [form, setForm] = useState({
    tipo: "despesa", categoria: "outros", descricao: "", valor: "",
    dataVencimento: "", dataPagamento: "", status: "pendente", observacao: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  const { data: condominios } = useListCondominios();
  const canEdit = user?.role === "admin" || user?.role === "sindico";

  const loadLancamentos = async (condId: string) => {
    if (!condId) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterTipo && filterTipo !== "todos") params.set("tipo", filterTipo);
      if (filterStatus && filterStatus !== "todos") params.set("status", filterStatus);
      const res = await fetch(`/api/condominios/${condId}/lancamentos?${params}`);
      if (res.ok) setLancamentos(await res.json());
    } finally {
      setIsLoading(false);
    }
  };

  const handleCondominioChange = (val: string) => {
    setCondominioId(val);
    loadLancamentos(val);
  };

  const openCreate = () => {
    setEditingLancamento(null);
    const today = new Date().toISOString().split("T")[0];
    setForm({ tipo: "despesa", categoria: "outros", descricao: "", valor: "", dataVencimento: today, dataPagamento: "", status: "pendente", observacao: "" });
    setShowDialog(true);
  };

  const openEdit = (l: Lancamento) => {
    setEditingLancamento(l);
    setForm({ tipo: l.tipo, categoria: l.categoria, descricao: l.descricao, valor: l.valor, dataVencimento: l.dataVencimento, dataPagamento: l.dataPagamento ?? "", status: l.status, observacao: l.observacao ?? "" });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!form.tipo || !form.categoria || !form.descricao || !form.valor || !form.dataVencimento) {
      toast({ title: i18n.language === "pt" ? "Preencha todos os campos obrigatórios" : "Fill in required fields", variant: "destructive" }); return;
    }
    setIsSaving(true);
    try {
      const payload = { ...form, dataPagamento: form.dataPagamento || null, observacao: form.observacao || null };
      let res: Response;
      if (editingLancamento) {
        res = await fetch(`/api/condominios/${condominioId}/lancamentos/${editingLancamento.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/condominios/${condominioId}/lancamentos`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, condominioId: parseInt(condominioId) }),
        });
      }
      if (!res.ok) {
        const err = await res.json();
        toast({ title: err.error || (i18n.language === "pt" ? "Erro ao salvar" : "Save failed"), variant: "destructive" }); return;
      }
      toast({ title: editingLancamento ? (i18n.language === "pt" ? "Lançamento atualizado" : "Entry updated") : (i18n.language === "pt" ? "Lançamento criado" : "Entry created") });
      setShowDialog(false);
      loadLancamentos(condominioId);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(i18n.language === "pt" ? "Excluir este lançamento?" : "Delete this entry?")) return;
    await fetch(`/api/condominios/${condominioId}/lancamentos/${id}`, { method: "DELETE" });
    toast({ title: i18n.language === "pt" ? "Lançamento excluído" : "Entry deleted" });
    loadLancamentos(condominioId);
  };

  const markPago = async (l: Lancamento) => {
    const today = new Date().toISOString().split("T")[0];
    await fetch(`/api/condominios/${condominioId}/lancamentos/${l.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "pago", dataPagamento: today }),
    });
    toast({ title: i18n.language === "pt" ? "Marcado como pago" : "Marked as paid" });
    loadLancamentos(condominioId);
  };

  const totalReceitas = lancamentos.filter((l) => l.tipo === "receita" && l.status === "pago").reduce((sum, l) => sum + parseFloat(l.valor || "0"), 0);
  const totalDespesas = lancamentos.filter((l) => l.tipo === "despesa" && l.status === "pago").reduce((sum, l) => sum + parseFloat(l.valor || "0"), 0);
  const saldo = totalReceitas - totalDespesas;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Wallet className="h-6 w-6 text-primary" />
            {i18n.language === "pt" ? "Financeiro" : "Finances"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {i18n.language === "pt" ? "Receitas, despesas e fluxo de caixa" : "Income, expenses and cash flow"}
          </p>
        </div>
        {canEdit && condominioId && (
          <Button onClick={openCreate} data-testid="button-novo-lancamento">
            <Plus className="h-4 w-4 mr-2" />
            {i18n.language === "pt" ? "Novo Lançamento" : "New Entry"}
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
            <Select value={filterTipo} onValueChange={(v) => { setFilterTipo(v); if (condominioId) loadLancamentos(condominioId); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">{i18n.language === "pt" ? "Receitas e Despesas" : "Income & Expenses"}</SelectItem>
                <SelectItem value="receita">{i18n.language === "pt" ? "Receitas" : "Income"}</SelectItem>
                <SelectItem value="despesa">{i18n.language === "pt" ? "Despesas" : "Expenses"}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); if (condominioId) loadLancamentos(condominioId); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">{i18n.language === "pt" ? "Todos os status" : "All statuses"}</SelectItem>
                <SelectItem value="pendente">{i18n.language === "pt" ? "Pendente" : "Pending"}</SelectItem>
                <SelectItem value="pago">{i18n.language === "pt" ? "Pago" : "Paid"}</SelectItem>
                <SelectItem value="cancelado">{i18n.language === "pt" ? "Cancelado" : "Cancelled"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Summary cards */}
      {condominioId && !isLoading && lancamentos.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-green-200 bg-green-50/50">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="text-xs font-medium text-green-700">{i18n.language === "pt" ? "Receitas pagas" : "Paid income"}</span>
              </div>
              <p className="text-lg font-bold text-green-700">{formatCurrency(totalReceitas.toFixed(2))}</p>
            </CardContent>
          </Card>
          <Card className="border-red-200 bg-red-50/50">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="h-4 w-4 text-red-600" />
                <span className="text-xs font-medium text-red-700">{i18n.language === "pt" ? "Despesas pagas" : "Paid expenses"}</span>
              </div>
              <p className="text-lg font-bold text-red-700">{formatCurrency(totalDespesas.toFixed(2))}</p>
            </CardContent>
          </Card>
          <Card className={`border-${saldo >= 0 ? "blue" : "orange"}-200 bg-${saldo >= 0 ? "blue" : "orange"}-50/50`}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <Wallet className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-medium text-blue-700">{i18n.language === "pt" ? "Saldo" : "Balance"}</span>
              </div>
              <p className={`text-lg font-bold ${saldo >= 0 ? "text-blue-700" : "text-orange-700"}`}>{formatCurrency(saldo.toFixed(2))}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* List */}
      {!condominioId ? (
        <div className="text-center py-12 text-muted-foreground">
          <Wallet className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>{i18n.language === "pt" ? "Selecione um condomínio para ver os lançamentos" : "Select a condominium to view entries"}</p>
        </div>
      ) : isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : lancamentos.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Wallet className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>{i18n.language === "pt" ? "Nenhum lançamento encontrado" : "No entries found"}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {lancamentos.map((l) => {
            const StatusIcon = STATUS_ICONS[l.status] || Clock;
            return (
              <Card key={l.id} className="hover:border-primary/40 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`p-1.5 rounded-full shrink-0 mt-0.5 ${l.tipo === "receita" ? "bg-green-100" : "bg-red-100"}`}>
                        {l.tipo === "receita" ? <TrendingUp className="h-3.5 w-3.5 text-green-600" /> : <TrendingDown className="h-3.5 w-3.5 text-red-600" />}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{l.descricao}</span>
                          <Badge variant="outline" className="text-xs">{CATEGORIA_LABELS[l.categoria] || l.categoria}</Badge>
                          <Badge variant="outline" className={`text-xs ${STATUS_COLORS[l.status] || ""}`}>
                            <StatusIcon className="h-3 w-3 mr-1" />{l.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {i18n.language === "pt" ? "Vence" : "Due"}: {l.dataVencimento}
                          {l.dataPagamento && ` · ${i18n.language === "pt" ? "Pago" : "Paid"}: ${l.dataPagamento}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`font-bold text-base ${l.tipo === "receita" ? "text-green-700" : "text-red-700"}`}>
                        {l.tipo === "receita" ? "+" : "-"}{formatCurrency(l.valor)}
                      </span>
                      {canEdit && (
                        <div className="flex gap-1">
                          {l.status === "pendente" && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600" title={i18n.language === "pt" ? "Marcar pago" : "Mark paid"} onClick={() => markPago(l)}>
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(l)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(l.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingLancamento ? (i18n.language === "pt" ? "Editar Lançamento" : "Edit Entry") : (i18n.language === "pt" ? "Novo Lançamento" : "New Entry")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{i18n.language === "pt" ? "Tipo *" : "Type *"}</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="receita">{i18n.language === "pt" ? "Receita" : "Income"}</SelectItem>
                    <SelectItem value="despesa">{i18n.language === "pt" ? "Despesa" : "Expense"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{i18n.language === "pt" ? "Categoria *" : "Category *"}</Label>
                <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORIA_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{i18n.language === "pt" ? "Descrição *" : "Description *"}</Label>
              <Input placeholder={i18n.language === "pt" ? "Ex: Taxa condominial Abril/2026" : "e.g. April/2026 fee"} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{i18n.language === "pt" ? "Valor (R$) *" : "Amount (R$) *"}</Label>
                <Input type="number" step="0.01" placeholder="0,00" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>{i18n.language === "pt" ? "Status" : "Status"}</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{i18n.language === "pt" ? "Data Vencimento *" : "Due Date *"}</Label>
                <Input type="date" value={form.dataVencimento} onChange={(e) => setForm({ ...form, dataVencimento: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>{i18n.language === "pt" ? "Data Pagamento" : "Payment Date"}</Label>
                <Input type="date" value={form.dataPagamento} onChange={(e) => setForm({ ...form, dataPagamento: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{i18n.language === "pt" ? "Observação" : "Notes"}</Label>
              <Textarea placeholder={i18n.language === "pt" ? "Observações adicionais..." : "Additional notes..."} value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} rows={2} />
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
