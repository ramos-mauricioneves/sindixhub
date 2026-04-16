import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useListCondominios } from "@workspace/api-client-react";
import { MessageSquareWarning, Plus, Loader2, CheckCircle2, Clock, AlertTriangle, ArrowRight, MessageCircle } from "lucide-react";
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

interface Ocorrencia {
  id: number;
  condominioId: number;
  moradorNome: string;
  unidade: string;
  categoria: string;
  titulo: string;
  descricao: string;
  prioridade: string;
  status: string;
  resposta: string | null;
  resolvidoEm: string | null;
  createdAt: string;
}

const CATEGORIA_LABELS: Record<string, string> = {
  manutencao: "Manutenção",
  barulho: "Barulho",
  seguranca: "Segurança",
  limpeza: "Limpeza",
  estacionamento: "Estacionamento",
  infiltracao: "Infiltração",
  elevador: "Elevador",
  outros: "Outros",
};

const PRIORIDADE_COLORS: Record<string, string> = {
  baixa: "bg-blue-50 text-blue-700 border-blue-200",
  media: "bg-yellow-50 text-yellow-700 border-yellow-200",
  alta: "bg-red-50 text-red-700 border-red-200",
};

const STATUS_COLORS: Record<string, string> = {
  aberta: "bg-orange-50 text-orange-700 border-orange-200",
  em_andamento: "bg-blue-50 text-blue-700 border-blue-200",
  resolvida: "bg-green-50 text-green-700 border-green-200",
  fechada: "bg-gray-50 text-gray-500 border-gray-200",
};

const STATUS_LABELS: Record<string, Record<string, string>> = {
  pt: { aberta: "Aberta", em_andamento: "Em Andamento", resolvida: "Resolvida", fechada: "Fechada" },
  en: { aberta: "Open", em_andamento: "In Progress", resolvida: "Resolved", fechada: "Closed" },
};

const isPt = (lang: string) => lang === "pt";

export default function OcorrenciasPage() {
  const { i18n } = useTranslation();
  const user = useUser();
  const { toast } = useToast();
  const lang = isPt(i18n.language) ? "pt" : "en";

  const [condominioId, setCondominioId] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [filterPrioridade, setFilterPrioridade] = useState<string>("todos");
  const [filterCategoria, setFilterCategoria] = useState<string>("todos");
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ moradorNome: "", unidade: "", categoria: "outros", titulo: "", descricao: "", prioridade: "media" });
  const [isSaving, setIsSaving] = useState(false);

  const [showRespondDialog, setShowRespondDialog] = useState(false);
  const [respondId, setRespondId] = useState<number | null>(null);
  const [respondText, setRespondText] = useState("");
  const [respondStatus, setRespondStatus] = useState("em_andamento");

  const { data: condominios } = useListCondominios();
  const canManage = user?.role === "admin" || user?.role === "sindico";

  const loadOcorrencias = async (condId: string) => {
    if (!condId) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus && filterStatus !== "todos") params.set("status", filterStatus);
      if (filterPrioridade && filterPrioridade !== "todos") params.set("prioridade", filterPrioridade);
      if (filterCategoria && filterCategoria !== "todos") params.set("categoria", filterCategoria);
      const res = await fetch(`/api/condominios/${condId}/ocorrencias?${params}`);
      if (res.ok) setOcorrencias(await res.json());
    } finally {
      setIsLoading(false);
    }
  };

  const handleCondominioChange = (val: string) => {
    setCondominioId(val);
    loadOcorrencias(val);
  };

  const openCreate = () => {
    setForm({ moradorNome: "", unidade: "", categoria: "outros", titulo: "", descricao: "", prioridade: "media" });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!form.moradorNome || !form.unidade || !form.titulo || !form.descricao) {
      toast({ title: lang === "pt" ? "Preencha todos os campos obrigatórios" : "Fill in required fields", variant: "destructive" }); return;
    }
    setIsSaving(true);
    try {
      const res = await fetch(`/api/condominios/${condominioId}/ocorrencias`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: err.error || (lang === "pt" ? "Erro ao criar" : "Error creating"), variant: "destructive" }); return;
      }
      toast({ title: lang === "pt" ? "Ocorrência registrada!" : "Issue reported!" });
      setShowDialog(false);
      loadOcorrencias(condominioId);
    } finally {
      setIsSaving(false);
    }
  };

  const openRespond = (o: Ocorrencia) => {
    setRespondId(o.id);
    setRespondText(o.resposta ?? "");
    setRespondStatus(o.status === "aberta" ? "em_andamento" : "resolvida");
    setShowRespondDialog(true);
  };

  const handleRespond = async () => {
    if (!respondId) return;
    await fetch(`/api/condominios/${condominioId}/ocorrencias/${respondId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: respondStatus, resposta: respondText || null }),
    });
    toast({ title: lang === "pt" ? "Ocorrência atualizada!" : "Issue updated!" });
    setShowRespondDialog(false);
    loadOcorrencias(condominioId);
  };

  const openCount = ocorrencias.filter(o => o.status === "aberta").length;
  const inProgressCount = ocorrencias.filter(o => o.status === "em_andamento").length;

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    return lang === "pt" ? "agora" : "now";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <MessageSquareWarning className="h-6 w-6 text-primary" />
            {lang === "pt" ? "Ocorrências" : "Issues"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {lang === "pt" ? "Chamados e solicitações de moradores" : "Resident requests and reports"}
          </p>
        </div>
        {condominioId && (
          <Button onClick={openCreate} data-testid="button-nova-ocorrencia">
            <Plus className="h-4 w-4 mr-2" />
            {lang === "pt" ? "Nova Ocorrência" : "New Issue"}
          </Button>
        )}
      </div>

      {/* Summary badges */}
      {condominioId && !isLoading && (openCount > 0 || inProgressCount > 0) && (
        <div className="flex gap-2">
          {openCount > 0 && (
            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 py-1 px-3">
              <AlertTriangle className="h-3.5 w-3.5 mr-1" />{openCount} {lang === "pt" ? "abertas" : "open"}
            </Badge>
          )}
          {inProgressCount > 0 && (
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 py-1 px-3">
              <Clock className="h-3.5 w-3.5 mr-1" />{inProgressCount} {lang === "pt" ? "em andamento" : "in progress"}
            </Badge>
          )}
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <Select value={condominioId} onValueChange={handleCondominioChange}>
              <SelectTrigger><SelectValue placeholder={lang === "pt" ? "Selecionar condomínio" : "Select condominium"} /></SelectTrigger>
              <SelectContent>
                {condominios?.map((c) => (<SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); if (condominioId) loadOcorrencias(condominioId); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">{lang === "pt" ? "Todos os status" : "All statuses"}</SelectItem>
                <SelectItem value="aberta">{lang === "pt" ? "Aberta" : "Open"}</SelectItem>
                <SelectItem value="em_andamento">{lang === "pt" ? "Em andamento" : "In progress"}</SelectItem>
                <SelectItem value="resolvida">{lang === "pt" ? "Resolvida" : "Resolved"}</SelectItem>
                <SelectItem value="fechada">{lang === "pt" ? "Fechada" : "Closed"}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterPrioridade} onValueChange={(v) => { setFilterPrioridade(v); if (condominioId) loadOcorrencias(condominioId); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">{lang === "pt" ? "Todas prioridades" : "All priorities"}</SelectItem>
                <SelectItem value="alta">{lang === "pt" ? "Alta" : "High"}</SelectItem>
                <SelectItem value="media">{lang === "pt" ? "Média" : "Medium"}</SelectItem>
                <SelectItem value="baixa">{lang === "pt" ? "Baixa" : "Low"}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterCategoria} onValueChange={(v) => { setFilterCategoria(v); if (condominioId) loadOcorrencias(condominioId); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">{lang === "pt" ? "Todas categorias" : "All categories"}</SelectItem>
                {Object.entries(CATEGORIA_LABELS).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      {!condominioId ? (
        <div className="text-center py-12 text-muted-foreground">
          <MessageSquareWarning className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>{lang === "pt" ? "Selecione um condomínio" : "Select a condominium"}</p>
        </div>
      ) : isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : ocorrencias.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>{lang === "pt" ? "Nenhuma ocorrência encontrada" : "No issues found"}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {ocorrencias.map((o) => (
            <Card key={o.id} className="hover:border-primary/40 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{o.titulo}</span>
                      <Badge variant="outline" className="text-xs">{CATEGORIA_LABELS[o.categoria] || o.categoria}</Badge>
                      <Badge variant="outline" className={`text-xs ${PRIORIDADE_COLORS[o.prioridade] || ""}`}>
                        {o.prioridade}
                      </Badge>
                      <Badge variant="outline" className={`text-xs ${STATUS_COLORS[o.status] || ""}`}>
                        {STATUS_LABELS[lang]?.[o.status] || o.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{o.descricao}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{o.moradorNome} · {o.unidade}</span>
                      <span>{timeAgo(o.createdAt)}</span>
                    </div>
                    {o.resposta && (
                      <div className="mt-2 p-2 bg-blue-50 rounded-md border border-blue-100">
                        <p className="text-xs font-medium text-blue-700 flex items-center gap-1 mb-0.5">
                          <MessageCircle className="h-3 w-3" /> {lang === "pt" ? "Resposta da administração:" : "Management response:"}
                        </p>
                        <p className="text-xs text-blue-800">{o.resposta}</p>
                      </div>
                    )}
                  </div>
                  {canManage && (o.status === "aberta" || o.status === "em_andamento") && (
                    <Button size="sm" variant="outline" className="shrink-0" onClick={() => openRespond(o)}>
                      <ArrowRight className="h-3.5 w-3.5 mr-1" />
                      {lang === "pt" ? "Responder" : "Respond"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{lang === "pt" ? "Nova Ocorrência" : "New Issue"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{lang === "pt" ? "Nome *" : "Name *"}</Label>
                <Input value={form.moradorNome} onChange={(e) => setForm({ ...form, moradorNome: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>{lang === "pt" ? "Unidade *" : "Unit *"}</Label>
                <Input placeholder="101" value={form.unidade} onChange={(e) => setForm({ ...form, unidade: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{lang === "pt" ? "Categoria *" : "Category *"}</Label>
                <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORIA_LABELS).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{lang === "pt" ? "Prioridade" : "Priority"}</Label>
                <Select value={form.prioridade} onValueChange={(v) => setForm({ ...form, prioridade: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">{lang === "pt" ? "Baixa" : "Low"}</SelectItem>
                    <SelectItem value="media">{lang === "pt" ? "Média" : "Medium"}</SelectItem>
                    <SelectItem value="alta">{lang === "pt" ? "Alta" : "High"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{lang === "pt" ? "Título *" : "Title *"}</Label>
              <Input placeholder={lang === "pt" ? "Ex: Vazamento no banheiro" : "e.g. Bathroom leak"} value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{lang === "pt" ? "Descrição *" : "Description *"}</Label>
              <Textarea placeholder={lang === "pt" ? "Descreva o problema em detalhes..." : "Describe the issue in detail..."} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">{lang === "pt" ? "Cancelar" : "Cancel"}</Button></DialogClose>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {lang === "pt" ? "Registrar" : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Respond dialog */}
      <Dialog open={showRespondDialog} onOpenChange={setShowRespondDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{lang === "pt" ? "Responder Ocorrência" : "Respond to Issue"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>{lang === "pt" ? "Novo status" : "New status"}</Label>
              <Select value={respondStatus} onValueChange={setRespondStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="em_andamento">{lang === "pt" ? "Em Andamento" : "In Progress"}</SelectItem>
                  <SelectItem value="resolvida">{lang === "pt" ? "Resolvida" : "Resolved"}</SelectItem>
                  <SelectItem value="fechada">{lang === "pt" ? "Fechada" : "Closed"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{lang === "pt" ? "Resposta ao morador" : "Response to resident"}</Label>
              <Textarea value={respondText} onChange={(e) => setRespondText(e.target.value)} rows={3} placeholder={lang === "pt" ? "Providências tomadas..." : "Actions taken..."} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">{lang === "pt" ? "Cancelar" : "Cancel"}</Button></DialogClose>
            <Button onClick={handleRespond}>
              {lang === "pt" ? "Atualizar" : "Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
