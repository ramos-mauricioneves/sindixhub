import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Building2, Plus, Trash2, ChevronDown, ChevronUp, ChevronRight, Loader2, AlertCircle,
  Pencil, X, Check, MapPin, Users, Clock, Hash, Phone, Mail, Shield, Wrench,
  FileText, Star, AlertTriangle, Calendar, ShieldCheck, Package
} from "lucide-react";
import {
  useListCondominios, useCreateCondominio, useUpdateCondominio,
  useListAreas, useCreateArea, useUpdateArea, useDeleteArea,
  useListAssets, useCreateAsset, useUpdateAsset, useDeleteAsset,
  useListContratos, useCreateContrato, useUpdateContrato, useDeleteContrato,
  useListDocumentos, useCreateDocumento, useUpdateDocumento, useDeleteDocumento,
  useGetSeguroPredial, useUpsertSeguroPredial,
  useGetCondominioHealth,
  Condominio, CondominioBody, Area, AreaBodyPrivacidade, AreaPrivacidade,
  Asset, AssetBody,
  ContratoCondominio, DocumentoCondominio,
  getListCondominiosQueryKey, getListAreasQueryKey, getListAssetsQueryKey,
  getListContratosQueryKey,
  getListDocumentosQueryKey, getGetSeguroPredialQueryKey, getGetCondominioHealthQueryKey,
} from "@workspace/api-client-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AREA_CATEGORIES, AreaTemplate, KNOWN_AREA_TIPOS } from "@/lib/area-templates";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-fetch";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

// ─── Constants ────────────────────────────────────────────────────────────────

const AREA_TIPOS = ["comum", "lazer", "esportiva", "social", "servico", "estacionamento", "infantil", "predial", "administrativa", "manutencao", "circulacao", "unidade_privativa"] as const;

const AREA_TIPO_COLORS: Record<string, string> = {
  unidade_privativa: "text-violet-700 bg-violet-50",
  comum: "text-blue-600 bg-blue-50",
  lazer: "text-green-600 bg-green-50",
  esportiva: "text-orange-600 bg-orange-50",
  social: "text-purple-600 bg-purple-50",
  servico: "text-gray-600 bg-gray-50",
  estacionamento: "text-yellow-700 bg-yellow-50",
  infantil: "text-pink-600 bg-pink-50",
  predial: "text-red-600 bg-red-50",
  administrativa: "text-indigo-600 bg-indigo-50",
  manutencao: "text-amber-700 bg-amber-50",
  circulacao: "text-sky-600 bg-sky-50",
};

const PRIVACIDADE_COLORS: Record<string, string> = {
  publica: "text-green-700 bg-green-50",
  privada: "text-slate-600 bg-slate-100",
  mista: "text-violet-600 bg-violet-50",
};

const TIPO_SERVICO_OPTIONS = [
  "elevadores", "portoes", "jardinagem", "dedetizacao", "cftv", "glp", "piscina", "limpeza", "seguranca", "outros",
] as const;

const TIPO_DOCUMENTO_OPTIONS = [
  "avcb", "habite", "spda", "elevadores", "glp", "alvara", "convencao", "regimento", "outros",
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

type CondominioForm = {
  nome: string; cnpj: string; tipoCondominio: string;
  endereco: string; cep: string; bairro: string; cidade: string; estado: string;
  totalUnidades: string; totalBlocos: string; totalAndares: string; anoConstrucao: string;
  telefone: string; email: string; sindico: string; zelador: string; administradora: string;
  inscricaoMunicipal: string; areaTotalM2: string; areaLazerM2: string;
  numElevadores: string; tipoPortaria: string;
  equipeSubSindicoNome: string; equipeSubSindicoTelefone: string; equipeSubSindicoEmail: string;
  equipeZeladorTipo: string; equipeZeladorNome: string; equipeZeladorTelefone: string; equipeZeladorEmpresa: string;
  equipePortariaTipo: string; equipePortariaEmpresa: string;
  equipeAsgQtd: string; equipeAsgEmpresa: string;
  equipeSegurancaQtd: string; equipeSegurancaEmpresa: string;
  ativo: boolean;
};

const emptyForm = (): CondominioForm => ({
  nome: "", cnpj: "", tipoCondominio: "residencial",
  endereco: "", cep: "", bairro: "", cidade: "", estado: "",
  totalUnidades: "", totalBlocos: "", totalAndares: "", anoConstrucao: "",
  telefone: "", email: "", sindico: "", zelador: "", administradora: "",
  inscricaoMunicipal: "", areaTotalM2: "", areaLazerM2: "", numElevadores: "", tipoPortaria: "",
  equipeSubSindicoNome: "", equipeSubSindicoTelefone: "", equipeSubSindicoEmail: "",
  equipeZeladorTipo: "", equipeZeladorNome: "", equipeZeladorTelefone: "", equipeZeladorEmpresa: "",
  equipePortariaTipo: "", equipePortariaEmpresa: "",
  equipeAsgQtd: "", equipeAsgEmpresa: "",
  equipeSegurancaQtd: "", equipeSegurancaEmpresa: "",
  ativo: true,
});

type AreaForm = {
  nome: string; tipo: string; tipoCustom: string; bloco: string; andar: string;
  privacidade: AreaBodyPrivacidade;
  descricao: string; capacidade: string; reservavel: boolean;
  horarioAbertura: string; horarioFechamento: string;
};

const emptyAreaForm = (): AreaForm => ({
  nome: "", tipo: "comum", tipoCustom: "", bloco: "", andar: "", privacidade: "publica",
  descricao: "", capacidade: "", reservavel: false, horarioAbertura: "", horarioFechamento: "",
});

type PendingArea = { id: string; nome: string; tipo: string; privacidade: "publica" | "privada" | "mista"; bloco: string; andar: string; };

type AssetForm = { nome: string; tipo: string; criticidade: string; status: string; descricao: string; };
const emptyAssetForm = (): AssetForm => ({ nome: "", tipo: "equipamento", criticidade: "baixa", status: "operacional", descricao: "" });

// ─── Helper Components ───────────────────────────────────────────────────────

function AreaTipoBadge({ tipo, t }: { tipo: string; t: (k: string) => string }) {
  const colors = AREA_TIPO_COLORS[tipo] || "text-gray-600 bg-gray-50";
  const labelMap: Record<string, string> = {
    comum: t("condominios.tipoComum"), lazer: t("condominios.tipoLazer"),
    esportiva: t("condominios.tipoEsportiva"), social: t("condominios.tipoSocial"),
    servico: t("condominios.tipoServico"), estacionamento: t("condominios.tipoEstacionamento"),
    infantil: t("condominios.tipoInfantil"), predial: t("condominios.tipoPredial"),
    administrativa: t("condominios.tipoAdministrativa"), manutencao: t("condominios.tipoManutencao"),
    circulacao: t("condominios.tipoCirculacao"), unidade_privativa: t("condominios.tipoUnidadePrivativa"),
  };
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors}`}>{labelMap[tipo] || tipo}</span>;
}

function PrivacidadeBadge({ privacidade, t }: { privacidade: string; t: (k: string) => string }) {
  if (privacidade === "publica") return null;
  const colors = PRIVACIDADE_COLORS[privacidade] || "text-gray-600 bg-gray-50";
  const labelMap: Record<string, string> = { privada: t("condominios.privacidadePrivada"), mista: t("condominios.privacidadeMista") };
  return <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${colors}`}>{labelMap[privacidade] || privacidade}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const cfg: Record<string, { key: string; cls: string }> = {
    ativo:        { key: "condominios.statusAtivo",        cls: "text-green-700 bg-green-50" },
    valido:       { key: "condominios.statusValido",       cls: "text-green-700 bg-green-50" },
    a_vencer:     { key: "condominios.statusAVencer",      cls: "text-amber-700 bg-amber-50" },
    vencido:      { key: "condominios.statusVencido",      cls: "text-red-700 bg-red-50" },
    sem_registro: { key: "condominios.statusSemRegistro",  cls: "text-gray-500 bg-gray-100" },
  };
  const c = cfg[status];
  const label = c ? t(c.key) : status;
  const cls = c ? c.cls : "text-gray-600 bg-gray-50";
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>{label}</span>;
}

function SectionLabel({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </p>
  );
}

function SaveFirstMessage({ t }: { t: (k: string) => string }) {
  return (
    <div className="flex items-center justify-center py-12 text-center">
      <div>
        <Building2 className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-30" />
        <p className="text-sm text-muted-foreground">{t("condominios.saveFirstToAdd")}</p>
      </div>
    </div>
  );
}

// ─── CatalogDialog ────────────────────────────────────────────────────────────

function CatalogDialog({
  condominioId, open, onOpenChange, onDone, onOpenCustomArea,
}: {
  condominioId: number;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
  onOpenCustomArea: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [activeCategory, setActiveCategory] = useState(AREA_CATEGORIES[0].key);
  const [pending, setPending] = useState<PendingArea[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const createArea = useCreateArea();
  const qc = useQueryClient();

  const currentCategory = AREA_CATEGORIES.find(c => c.key === activeCategory) ?? AREA_CATEGORIES[0];
  const categoryLabel = (key: string) => t(`condominios.catalog${key.charAt(0).toUpperCase() + key.slice(1)}`);

  const toggleTemplate = (template: AreaTemplate) => {
    const uid = `${template.tipo}__${template.nome}`;
    const exists = pending.some(p => p.id === uid);
    if (exists) {
      setPending(p => p.filter(x => x.id !== uid));
    } else {
      setPending(p => [...p, { id: uid, nome: template.nome, tipo: template.tipo, privacidade: template.privacidade, bloco: "", andar: "" }]);
    }
  };

  const handleSave = async () => {
    if (pending.length === 0) return;
    setIsSaving(true);
    try {
      await Promise.all(pending.map(area =>
        createArea.mutateAsync({
          condominioId,
          data: {
            nome: area.nome.trim() || area.nome,
            tipo: area.tipo,
            privacidade: area.privacidade as AreaBodyPrivacidade,
            bloco: area.bloco.trim() || undefined,
            andar: area.andar ? parseInt(area.andar) : undefined,
          },
        })
      ));
      qc.invalidateQueries({ queryKey: getListAreasQueryKey(condominioId) });
      toast({ title: t("condominios.catalogBatchAdded", { count: pending.length }) });
      onDone();
      onOpenChange(false);
      setPending([]);
    } catch {
      toast({ title: t("condominios.errorAddingArea"), variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => { onOpenChange(false); setPending([]); };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle>{t("condominios.catalogTitle")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap gap-1.5 pb-2 border-b">
          {AREA_CATEGORIES.map(cat => (
            <button key={cat.key} onClick={() => setActiveCategory(cat.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${activeCategory === cat.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/60"}`}>
              {categoryLabel(cat.key)}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 overflow-y-auto max-h-44">
          {currentCategory.templates.map(template => {
            const uid = `${template.tipo}__${template.nome}`;
            const isSelected = pending.some(p => p.id === uid);
            return (
              <button key={template.nome} onClick={() => toggleTemplate(template)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-left text-sm transition-colors ${isSelected ? "border-primary bg-primary/10 text-primary font-medium" : "border-border bg-background hover:bg-muted"}`}>
                {isSelected ? <Check className="h-3.5 w-3.5 shrink-0" /> : <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                <span className="truncate">{t(template.labelKey)}</span>
              </button>
            );
          })}
        </div>
        {pending.length > 0 && (
          <div className="border-t pt-3 space-y-2 overflow-y-auto max-h-48">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t("condominios.catalogSelected", { count: pending.length })}
            </p>
            {pending.map((area, idx) => (
              <div key={area.id} className="flex items-center gap-2">
                <input className="flex-1 min-w-0 text-sm px-2 py-1.5 rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  value={area.nome} aria-label={t("condominios.catalogNameLabel")}
                  onChange={(e) => setPending(p => p.map((x, i) => i === idx ? { ...x, nome: e.target.value } : x))} />
                <input className="w-24 text-xs px-2 py-1.5 rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder={t("condominios.catalogBlocoLabel")} value={area.bloco}
                  onChange={(e) => setPending(p => p.map((x, i) => i === idx ? { ...x, bloco: e.target.value } : x))} />
                <input className="w-14 text-xs px-2 py-1.5 rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  type="number" placeholder={t("condominios.catalogAndarLabel")} value={area.andar}
                  onChange={(e) => setPending(p => p.map((x, i) => i === idx ? { ...x, andar: e.target.value } : x))} />
                <button onClick={() => setPending(p => p.filter((_, i) => i !== idx))} className="text-muted-foreground hover:text-destructive shrink-0">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <DialogFooter className="gap-2 border-t pt-2">
          <Button variant="ghost" size="sm" className="mr-auto text-muted-foreground text-xs" onClick={() => { handleClose(); setTimeout(onOpenCustomArea, 50); }}>
            <Plus className="h-3 w-3 mr-1" />{t("condominios.catalogCustomArea")}
          </Button>
          <Button variant="outline" onClick={handleClose}>{t("common.cancel")}</Button>
          <Button disabled={pending.length === 0 || isSaving} onClick={handleSave}>
            {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {t("condominios.catalogAddBatch", { count: pending.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── AreasPanel ───────────────────────────────────────────────────────────────

function AreasPanel({ condominioId }: { condominioId: number }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [areaForm, setAreaForm] = useState<AreaForm>(emptyAreaForm());
  const [editingAreaId, setEditingAreaId] = useState<number | null>(null);
  const [areaDialogOpen, setAreaDialogOpen] = useState(false);
  const [catalogDialogOpen, setCatalogDialogOpen] = useState(false);

  const { data: areas, isPending } = useListAreas(condominioId, { query: { queryKey: getListAreasQueryKey(condominioId) } });
  const createArea = useCreateArea();
  const updateArea = useUpdateArea();
  const deleteArea = useDeleteArea();

  const openNewArea = () => { setAreaForm(emptyAreaForm()); setEditingAreaId(null); setAreaDialogOpen(true); };
  const openEditArea = (area: Area) => {
    const isKnown = KNOWN_AREA_TIPOS.has(area.tipo);
    setAreaForm({
      nome: area.nome, tipo: isKnown ? area.tipo : "__custom__", tipoCustom: isKnown ? "" : area.tipo,
      bloco: area.bloco || "", andar: area.andar != null ? String(area.andar) : "",
      privacidade: (area.privacidade as AreaBodyPrivacidade) || "publica",
      descricao: area.descricao || "", capacidade: area.capacidade?.toString() || "",
      reservavel: area.reservavel, horarioAbertura: area.horarioAbertura || "", horarioFechamento: area.horarioFechamento || "",
    });
    setEditingAreaId(area.id);
    setAreaDialogOpen(true);
  };

  const handleSaveArea = () => {
    if (!areaForm.nome.trim()) return;
    const effectiveTipo = areaForm.tipo === "__custom__" ? areaForm.tipoCustom.trim() : areaForm.tipo;
    if (!effectiveTipo) return;
    const payload = {
      nome: areaForm.nome.trim(), tipo: effectiveTipo,
      bloco: areaForm.bloco.trim() || undefined,
      andar: areaForm.andar !== "" ? parseInt(areaForm.andar) : undefined,
      privacidade: areaForm.privacidade, descricao: areaForm.descricao || undefined,
      capacidade: areaForm.capacidade ? parseInt(areaForm.capacidade) : undefined,
      reservavel: areaForm.reservavel,
      horarioAbertura: areaForm.horarioAbertura || undefined, horarioFechamento: areaForm.horarioFechamento || undefined,
    };
    const onSuccess = () => { qc.invalidateQueries({ queryKey: getListAreasQueryKey(condominioId) }); toast({ title: editingAreaId ? t("condominios.areaUpdated") : t("condominios.areaAdded") }); setAreaDialogOpen(false); };
    const onError = () => toast({ title: t("condominios.errorAddingArea"), variant: "destructive" });
    if (editingAreaId) {
      updateArea.mutate({ condominioId, areaId: editingAreaId, data: payload }, { onSuccess, onError });
    } else {
      createArea.mutate({ condominioId, data: payload }, { onSuccess, onError });
    }
  };

  const groupedByBlocoAndTipo = (areas || []).reduce<Record<string, Record<string, Area[]>>>((acc, area) => {
    const bloco = area.bloco || "__sem_bloco__";
    if (!acc[bloco]) acc[bloco] = {};
    if (!acc[bloco][area.tipo]) acc[bloco][area.tipo] = [];
    acc[bloco][area.tipo].push(area);
    return acc;
  }, {});

  const blocoKeys = Object.keys(groupedByBlocoAndTipo).sort((a, b) => {
    if (a === "__sem_bloco__") return 1;
    if (b === "__sem_bloco__") return -1;
    return a.localeCompare(b);
  });
  const knownTipoOrder = AREA_TIPOS as readonly string[];
  const customTipos = (areas || []).map(a => a.tipo).filter(t => !KNOWN_AREA_TIPOS.has(t));
  const tipoOrder = [...knownTipoOrder, ...new Set(customTipos)];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{t("condominios.areas")}</p>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="outline" onClick={() => setCatalogDialogOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />{t("condominios.catalogTitle")}
          </Button>
          <Button size="sm" variant="ghost" className="text-muted-foreground text-xs px-2" onClick={openNewArea}>
            {t("condominios.catalogCustomArea")}
          </Button>
        </div>
      </div>

      {isPending ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        : !areas || areas.length === 0 ? (
          <div className="text-center py-8 border border-dashed rounded-lg">
            <MapPin className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-30" />
            <p className="text-sm text-muted-foreground">{t("condominios.noAreas")}</p>
            <div className="flex justify-center gap-2 mt-3">
              <Button size="sm" variant="outline" onClick={() => setCatalogDialogOpen(true)}><Plus className="h-3.5 w-3.5 mr-1" />{t("condominios.catalogTitle")}</Button>
              <Button size="sm" variant="ghost" className="text-muted-foreground text-xs" onClick={openNewArea}>{t("condominios.catalogCustomArea")}</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {blocoKeys.map(blocoKey => {
              const tipoMap = groupedByBlocoAndTipo[blocoKey];
              const orderedTipos = tipoOrder.filter(t => tipoMap[t]?.length);
              const totalInBloco = orderedTipos.reduce((s, t) => s + tipoMap[t].length, 0);
              return (
                <div key={blocoKey}>
                  <div className="flex items-center gap-2 mb-2">
                    {blocoKey !== "__sem_bloco__"
                      ? <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary uppercase tracking-wide">{blocoKey}</span>
                      : <span className="text-xs text-muted-foreground font-medium">{t("condominios.semBloco")}</span>}
                    <span className="text-xs text-muted-foreground">({totalInBloco})</span>
                  </div>
                  <div className="space-y-3">
                    {orderedTipos.map(tipo => (
                      <div key={tipo}>
                        <div className="flex items-center gap-1.5 mb-1.5 ml-1">
                          <AreaTipoBadge tipo={tipo} t={t} />
                          <span className="text-xs text-muted-foreground">({tipoMap[tipo].length})</span>
                        </div>
                        <div className="grid gap-2">
                          {tipoMap[tipo].map(area => (
                            <div key={area.id} className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2 border ml-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium text-sm">{area.nome}</span>
                                  <PrivacidadeBadge privacidade={area.privacidade as AreaPrivacidade} t={t} />
                                  {area.andar != null && <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{t("condominios.andarDisplay", { andar: area.andar })}</span>}
                                  {area.reservavel && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{t("condominios.areaReservavel")}</Badge>}
                                  {!area.ativo && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Inativo</Badge>}
                                </div>
                                <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                                  {area.capacidade && <span className="flex items-center gap-0.5"><Users className="h-3 w-3" />{area.capacidade} {t("condominios.pessoas")}</span>}
                                  {area.horarioAbertura && area.horarioFechamento && <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" />{area.horarioAbertura}–{area.horarioFechamento}</span>}
                                  {area.descricao && <span className="truncate max-w-[200px]">{area.descricao}</span>}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button onClick={() => openEditArea(area)} className="p-1 text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                                <button onClick={() => deleteArea.mutate({ condominioId, areaId: area.id }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListAreasQueryKey(condominioId) }) })} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      <Dialog open={areaDialogOpen} onOpenChange={setAreaDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingAreaId ? t("condominios.editAreaDialog") : t("condominios.addAreaDialog")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("condominios.areaName")} *</Label>
                <Input value={areaForm.nome} onChange={(e) => setAreaForm(f => ({ ...f, nome: e.target.value }))} placeholder={t("condominios.areaNamePlaceholder")} />
              </div>
              <div className="space-y-2">
                <Label>{t("condominios.areaType")} *</Label>
                <Select value={areaForm.tipo} onValueChange={(v) => setAreaForm(f => ({ ...f, tipo: v, tipoCustom: "" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AREA_TIPOS.map(tipo => <SelectItem key={tipo} value={tipo}>{t(`condominios.tipo${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`)}</SelectItem>)}
                    <SelectItem value="__custom__">{t("condominios.tipoCustom")}</SelectItem>
                  </SelectContent>
                </Select>
                {areaForm.tipo === "__custom__" && <Input className="mt-1" value={areaForm.tipoCustom} onChange={(e) => setAreaForm(f => ({ ...f, tipoCustom: e.target.value }))} placeholder={t("condominios.tipoCustomPlaceholder")} />}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2 col-span-2">
                <Label>{t("condominios.areaBloco")}</Label>
                <Input value={areaForm.bloco} onChange={(e) => setAreaForm(f => ({ ...f, bloco: e.target.value }))} placeholder={t("condominios.areaBlocoPlaceholder")} />
              </div>
              <div className="space-y-2">
                <Label>{t("condominios.areaAndar")}</Label>
                <Input type="number" value={areaForm.andar} onChange={(e) => setAreaForm(f => ({ ...f, andar: e.target.value }))} placeholder={t("condominios.areaAndarPlaceholder")} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("condominios.areaPrivacidade")}</Label>
              <Select value={areaForm.privacidade} onValueChange={(v) => setAreaForm(f => ({ ...f, privacidade: v as AreaBodyPrivacidade }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="publica">{t("condominios.privacidadePublica")}</SelectItem>
                  <SelectItem value="privada">{t("condominios.privacidadePrivada")}</SelectItem>
                  <SelectItem value="mista">{t("condominios.privacidadeMista")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("condominios.areaDescricao")}</Label>
              <Textarea value={areaForm.descricao} onChange={(e) => setAreaForm(f => ({ ...f, descricao: e.target.value }))} placeholder={t("condominios.areaDescricaoPlaceholder")} rows={2} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>{t("condominios.areaCapacidade")}</Label>
                <Input type="number" min="0" value={areaForm.capacidade} onChange={(e) => setAreaForm(f => ({ ...f, capacidade: e.target.value }))} placeholder="50" />
              </div>
              <div className="space-y-2">
                <Label>{t("condominios.areaHorarioAbertura")}</Label>
                <Input type="time" value={areaForm.horarioAbertura} onChange={(e) => setAreaForm(f => ({ ...f, horarioAbertura: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{t("condominios.areaHorarioFechamento")}</Label>
                <Input type="time" value={areaForm.horarioFechamento} onChange={(e) => setAreaForm(f => ({ ...f, horarioFechamento: e.target.value }))} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={areaForm.reservavel} onCheckedChange={(v) => setAreaForm(f => ({ ...f, reservavel: v }))} id="area-reservavel" />
              <Label htmlFor="area-reservavel">{t("condominios.areaReservavel")}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAreaDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleSaveArea} disabled={!areaForm.nome.trim() || createArea.isPending || updateArea.isPending}>
              {(createArea.isPending || updateArea.isPending) ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CatalogDialog condominioId={condominioId} open={catalogDialogOpen} onOpenChange={setCatalogDialogOpen}
        onDone={() => qc.invalidateQueries({ queryKey: getListAreasQueryKey(condominioId) })} onOpenCustomArea={openNewArea} />
    </div>
  );
}

// ─── AssetDialog ──────────────────────────────────────────────────────────────

function AssetDialog({
  condominioId, areaId, asset, open, onOpenChange,
}: {
  condominioId: number;
  areaId?: number;
  asset: Asset | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<AssetForm>(emptyAssetForm());

  useEffect(() => {
    if (open) {
      setForm(asset
        ? { nome: asset.nome, tipo: asset.tipo, criticidade: asset.criticidade, status: asset.status, descricao: asset.descricao || "" }
        : emptyAssetForm());
    }
  }, [asset, open]);

  const createAsset = useCreateAsset();
  const updateAsset = useUpdateAsset();
  const invalidate = () => qc.invalidateQueries({ queryKey: getListAssetsQueryKey(condominioId) });

  const handleSave = () => {
    if (!form.nome.trim()) return;
    const data: AssetBody = {
      nome: form.nome.trim(),
      tipo: form.tipo as AssetBody["tipo"],
      criticidade: form.criticidade as AssetBody["criticidade"],
      status: form.status as AssetBody["status"],
      descricao: form.descricao.trim() || undefined,
      areaId: areaId ?? asset?.areaId ?? undefined,
    };
    const onSuccess = () => { invalidate(); toast({ title: asset ? t("ativos.updatedSuccess") : t("ativos.createdSuccess") }); onOpenChange(false); };
    const onError = () => toast({ title: t("ativos.errorSaving"), variant: "destructive" });
    if (asset) {
      updateAsset.mutate({ condominioId, assetId: asset.id, data }, { onSuccess, onError });
    } else {
      createAsset.mutate({ condominioId, data }, { onSuccess, onError });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{asset ? t("ativos.editAsset") : t("ativos.newAsset")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("ativos.nome")} *</Label>
            <Input value={form.nome} onChange={(e) => setForm(f => ({ ...f, nome: e.target.value }))} placeholder={t("ativos.nomePlaceholder")} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t("ativos.tipo")}</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm(f => ({ ...f, tipo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="equipamento">{t("ativos.tipoEquipamento")}</SelectItem>
                  <SelectItem value="estrutura">{t("ativos.tipoEstrutura")}</SelectItem>
                  <SelectItem value="sistema">{t("ativos.tipoSistema")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("ativos.criticidade")}</Label>
              <Select value={form.criticidade} onValueChange={(v) => setForm(f => ({ ...f, criticidade: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">{t("ativos.criticidadeBaixa")}</SelectItem>
                  <SelectItem value="media">{t("ativos.criticidadeMedia")}</SelectItem>
                  <SelectItem value="alta">{t("ativos.criticidadeAlta")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("ativos.status")}</Label>
            <Select value={form.status} onValueChange={(v) => setForm(f => ({ ...f, status: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="operacional">{t("ativos.statusOperacional")}</SelectItem>
                <SelectItem value="em_manutencao">{t("ativos.statusEmManutencao")}</SelectItem>
                <SelectItem value="inativo">{t("ativos.statusInativo")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("ativos.descricao")}</Label>
            <Textarea value={form.descricao} onChange={(e) => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder={t("ativos.descricaoPlaceholder")} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button onClick={handleSave} disabled={!form.nome.trim() || createAsset.isPending || updateAsset.isPending}>
            {(createAsset.isPending || updateAsset.isPending) ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── AssetRow ─────────────────────────────────────────────────────────────────

function AssetRow({ asset, t, onEdit, onDelete }: { asset: Asset; t: (k: string) => string; onEdit: (a: Asset) => void; onDelete: (id: number) => void }) {
  const critColors: Record<string, string> = { alta: "text-red-700 bg-red-50", media: "text-amber-700 bg-amber-50", baixa: "text-gray-600 bg-gray-50" };
  const statusColors: Record<string, string> = { operacional: "text-green-700 bg-green-50", em_manutencao: "text-amber-700 bg-amber-50", inativo: "text-gray-500 bg-gray-100" };
  const critLabel: Record<string, string> = { alta: t("ativos.criticidadeAlta"), media: t("ativos.criticidadeMedia"), baixa: t("ativos.criticidadeBaixa") };
  const statusLabel: Record<string, string> = { operacional: t("ativos.statusOperacional"), em_manutencao: t("ativos.statusEmManutencao"), inativo: t("ativos.statusInativo") };
  const tipoLabel: Record<string, string> = { equipamento: t("ativos.tipoEquipamento"), estrutura: t("ativos.tipoEstrutura"), sistema: t("ativos.tipoSistema") };
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/20 border hover:border-primary/20 transition-colors">
      <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
        <span className="font-medium text-sm">{asset.nome}</span>
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${critColors[asset.criticidade]}`}>{critLabel[asset.criticidade]}</span>
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${statusColors[asset.status]}`}>{statusLabel[asset.status]}</span>
        <span className="text-[10px] text-muted-foreground">{tipoLabel[asset.tipo]}</span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={() => onEdit(asset)} className="p-1 text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
        <button onClick={() => onDelete(asset.id)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  );
}

// ─── AreasItensTab ────────────────────────────────────────────────────────────

function AreasItensTab({ condominioId }: { condominioId: number }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();

  // Area form state
  const [areaForm, setAreaForm] = useState<AreaForm>(emptyAreaForm());
  const [editingAreaId, setEditingAreaId] = useState<number | null>(null);
  const [areaDialogOpen, setAreaDialogOpen] = useState(false);
  const [catalogDialogOpen, setCatalogDialogOpen] = useState(false);
  const [deleteAreaId, setDeleteAreaId] = useState<number | null>(null);

  // Asset dialog state
  const [assetDialogOpen, setAssetDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [assetDialogAreaId, setAssetDialogAreaId] = useState<number | undefined>();
  const [deleteAssetId, setDeleteAssetId] = useState<number | null>(null);

  // Accordion expanded state
  const [expandedAreas, setExpandedAreas] = useState<Set<number>>(new Set());

  const { data: areas, isPending: areasPending } = useListAreas(condominioId, { query: { queryKey: getListAreasQueryKey(condominioId) } });
  const { data: assets, isPending: assetsPending } = useListAssets(condominioId, undefined, { query: { queryKey: getListAssetsQueryKey(condominioId) } });

  const createArea = useCreateArea();
  const updateArea = useUpdateArea();
  const deleteArea = useDeleteArea();
  const deleteAsset = useDeleteAsset();

  const toggleArea = (id: number) => setExpandedAreas(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const openNewArea = () => { setAreaForm(emptyAreaForm()); setEditingAreaId(null); setAreaDialogOpen(true); };
  const openEditArea = (area: Area) => {
    const isKnown = KNOWN_AREA_TIPOS.has(area.tipo);
    setAreaForm({
      nome: area.nome, tipo: isKnown ? area.tipo : "__custom__", tipoCustom: isKnown ? "" : area.tipo,
      bloco: area.bloco || "", andar: area.andar != null ? String(area.andar) : "",
      privacidade: (area.privacidade as AreaBodyPrivacidade) || "publica",
      descricao: area.descricao || "", capacidade: area.capacidade?.toString() || "",
      reservavel: area.reservavel, horarioAbertura: area.horarioAbertura || "", horarioFechamento: area.horarioFechamento || "",
    });
    setEditingAreaId(area.id);
    setAreaDialogOpen(true);
  };

  const handleSaveArea = () => {
    if (!areaForm.nome.trim()) return;
    const effectiveTipo = areaForm.tipo === "__custom__" ? areaForm.tipoCustom.trim() : areaForm.tipo;
    if (!effectiveTipo) return;
    const payload = {
      nome: areaForm.nome.trim(), tipo: effectiveTipo,
      bloco: areaForm.bloco.trim() || undefined,
      andar: areaForm.andar !== "" ? parseInt(areaForm.andar) : undefined,
      privacidade: areaForm.privacidade, descricao: areaForm.descricao || undefined,
      capacidade: areaForm.capacidade ? parseInt(areaForm.capacidade) : undefined,
      reservavel: areaForm.reservavel,
      horarioAbertura: areaForm.horarioAbertura || undefined, horarioFechamento: areaForm.horarioFechamento || undefined,
    };
    const onSuccess = () => { qc.invalidateQueries({ queryKey: getListAreasQueryKey(condominioId) }); toast({ title: editingAreaId ? t("condominios.areaUpdated") : t("condominios.areaAdded") }); setAreaDialogOpen(false); };
    const onError = () => toast({ title: t("condominios.errorAddingArea"), variant: "destructive" });
    if (editingAreaId) {
      updateArea.mutate({ condominioId, areaId: editingAreaId, data: payload }, { onSuccess, onError });
    } else {
      createArea.mutate({ condominioId, data: payload }, { onSuccess, onError });
    }
  };

  const handleDeleteArea = (areaId: number) => {
    deleteArea.mutate({ condominioId, areaId }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListAreasQueryKey(condominioId) }); toast({ title: t("condominios.areaRemoved") }); },
      onError: () => toast({ title: t("condominios.errorDeletingArea"), variant: "destructive" }),
    });
    setDeleteAreaId(null);
  };

  const handleDeleteAsset = (assetId: number) => {
    deleteAsset.mutate({ condominioId, assetId }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListAssetsQueryKey(condominioId) }); toast({ title: t("ativos.deletedSuccess") }); },
      onError: () => toast({ title: t("ativos.errorDeleting"), variant: "destructive" }),
    });
    setDeleteAssetId(null);
  };

  const openNewAsset = (areaId?: number) => { setEditingAsset(null); setAssetDialogAreaId(areaId); setAssetDialogOpen(true); };
  const openEditAsset = (asset: Asset) => { setEditingAsset(asset); setAssetDialogAreaId(asset.areaId); setAssetDialogOpen(true); };

  const allAreas = areas || [];
  const allAssets = assets || [];
  const unassignedAssets = allAssets.filter(a => !a.areaId);

  if (areasPending || assetsPending) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{t("condominios.areas")}</p>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="outline" onClick={() => setCatalogDialogOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />{t("condominios.catalogTitle")}
          </Button>
          <Button size="sm" variant="ghost" className="text-muted-foreground text-xs px-2" onClick={openNewArea}>
            {t("condominios.catalogCustomArea")}
          </Button>
        </div>
      </div>

      {allAreas.length === 0 ? (
        <div className="text-center py-8 border border-dashed rounded-lg">
          <MapPin className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-30" />
          <p className="text-sm text-muted-foreground">{t("condominios.noAreas")}</p>
          <div className="flex justify-center gap-2 mt-3">
            <Button size="sm" variant="outline" onClick={() => setCatalogDialogOpen(true)}><Plus className="h-3.5 w-3.5 mr-1" />{t("condominios.catalogTitle")}</Button>
            <Button size="sm" variant="ghost" className="text-muted-foreground text-xs" onClick={openNewArea}>{t("condominios.catalogCustomArea")}</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {allAreas.map(area => {
            const areaAssets = allAssets.filter(a => a.areaId === area.id);
            const isExpanded = expandedAreas.has(area.id);
            return (
              <div key={area.id} className="border rounded-lg overflow-hidden">
                <div
                  className="flex items-center justify-between px-3 py-2.5 bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors select-none"
                  onClick={() => toggleArea(area.id)}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <ChevronRight className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-150 ${isExpanded ? "rotate-90" : ""}`} />
                    <AreaTipoBadge tipo={area.tipo} t={t} />
                    <span className="font-medium text-sm truncate">{area.nome}</span>
                    {area.bloco && <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">{area.bloco}</span>}
                    {area.andar != null && <span className="text-xs text-muted-foreground shrink-0">{t("condominios.andarDisplay", { andar: area.andar })}</span>}
                    <span className="text-xs text-muted-foreground shrink-0 ml-0.5">({areaAssets.length})</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2" onClick={e => e.stopPropagation()}>
                    <button onClick={() => openEditArea(area)} className="p-1 text-muted-foreground hover:text-foreground rounded"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => setDeleteAreaId(area.id)} className="p-1 text-muted-foreground hover:text-destructive rounded"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="px-3 py-3 space-y-2 border-t bg-background">
                    {areaAssets.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-3">{t("condominios.areasItensNoItems")}</p>
                    ) : (
                      <div className="space-y-1.5">
                        {areaAssets.map(a => <AssetRow key={a.id} asset={a} t={t} onEdit={openEditAsset} onDelete={setDeleteAssetId} />)}
                      </div>
                    )}
                    <Button size="sm" variant="outline" className="w-full mt-1 text-xs h-8" onClick={() => openNewAsset(area.id)}>
                      <Plus className="h-3.5 w-3.5 mr-1" />{t("condominios.areasItensAddItem")}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Unassigned items section */}
      {(unassignedAssets.length > 0 || allAreas.length > 0) && (
        <div className="space-y-2 pt-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5" />{t("condominios.areasItensSemArea")}
            <span className="font-normal">({unassignedAssets.length})</span>
          </p>
          {unassignedAssets.length > 0 && (
            <div className="space-y-1.5">
              {unassignedAssets.map(a => <AssetRow key={a.id} asset={a} t={t} onEdit={openEditAsset} onDelete={setDeleteAssetId} />)}
            </div>
          )}
          <Button size="sm" variant="outline" className="w-full text-xs h-8" onClick={() => openNewAsset(undefined)}>
            <Plus className="h-3.5 w-3.5 mr-1" />{t("condominios.areasItensAddItem")}
          </Button>
        </div>
      )}

      {/* Area Dialog (reuses same form as AreasPanel) */}
      <Dialog open={areaDialogOpen} onOpenChange={setAreaDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingAreaId ? t("condominios.editAreaDialog") : t("condominios.addAreaDialog")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("condominios.areaName")} *</Label>
                <Input value={areaForm.nome} onChange={(e) => setAreaForm(f => ({ ...f, nome: e.target.value }))} placeholder={t("condominios.areaNamePlaceholder")} />
              </div>
              <div className="space-y-2">
                <Label>{t("condominios.areaType")} *</Label>
                <Select value={areaForm.tipo} onValueChange={(v) => setAreaForm(f => ({ ...f, tipo: v, tipoCustom: "" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AREA_TIPOS.map(tipo => <SelectItem key={tipo} value={tipo}>{t(`condominios.tipo${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`)}</SelectItem>)}
                    <SelectItem value="__custom__">{t("condominios.tipoCustom")}</SelectItem>
                  </SelectContent>
                </Select>
                {areaForm.tipo === "__custom__" && <Input className="mt-1" value={areaForm.tipoCustom} onChange={(e) => setAreaForm(f => ({ ...f, tipoCustom: e.target.value }))} placeholder={t("condominios.tipoCustomPlaceholder")} />}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2 col-span-2">
                <Label>{t("condominios.areaBloco")}</Label>
                <Input value={areaForm.bloco} onChange={(e) => setAreaForm(f => ({ ...f, bloco: e.target.value }))} placeholder={t("condominios.areaBlocoPlaceholder")} />
              </div>
              <div className="space-y-2">
                <Label>{t("condominios.areaAndar")}</Label>
                <Input type="number" value={areaForm.andar} onChange={(e) => setAreaForm(f => ({ ...f, andar: e.target.value }))} placeholder={t("condominios.areaAndarPlaceholder")} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("condominios.areaPrivacidade")}</Label>
              <Select value={areaForm.privacidade} onValueChange={(v) => setAreaForm(f => ({ ...f, privacidade: v as AreaBodyPrivacidade }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="publica">{t("condominios.privacidadePublica")}</SelectItem>
                  <SelectItem value="privada">{t("condominios.privacidadePrivada")}</SelectItem>
                  <SelectItem value="mista">{t("condominios.privacidadeMista")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("condominios.areaDescricao")}</Label>
              <Textarea value={areaForm.descricao} onChange={(e) => setAreaForm(f => ({ ...f, descricao: e.target.value }))} placeholder={t("condominios.areaDescricaoPlaceholder")} rows={2} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>{t("condominios.areaCapacidade")}</Label>
                <Input type="number" min="0" value={areaForm.capacidade} onChange={(e) => setAreaForm(f => ({ ...f, capacidade: e.target.value }))} placeholder="50" />
              </div>
              <div className="space-y-2">
                <Label>{t("condominios.areaHorarioAbertura")}</Label>
                <Input type="time" value={areaForm.horarioAbertura} onChange={(e) => setAreaForm(f => ({ ...f, horarioAbertura: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{t("condominios.areaHorarioFechamento")}</Label>
                <Input type="time" value={areaForm.horarioFechamento} onChange={(e) => setAreaForm(f => ({ ...f, horarioFechamento: e.target.value }))} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={areaForm.reservavel} onCheckedChange={(v) => setAreaForm(f => ({ ...f, reservavel: v }))} id="ai-tab-area-reservavel" />
              <Label htmlFor="ai-tab-area-reservavel">{t("condominios.areaReservavel")}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAreaDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleSaveArea} disabled={!areaForm.nome.trim() || createArea.isPending || updateArea.isPending}>
              {(createArea.isPending || updateArea.isPending) ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Asset sub-dialog */}
      <AssetDialog condominioId={condominioId} areaId={assetDialogAreaId} asset={editingAsset} open={assetDialogOpen} onOpenChange={setAssetDialogOpen} />

      {/* Catalog dialog */}
      <CatalogDialog condominioId={condominioId} open={catalogDialogOpen} onOpenChange={setCatalogDialogOpen}
        onDone={() => qc.invalidateQueries({ queryKey: getListAreasQueryKey(condominioId) })} onOpenCustomArea={openNewArea} />

      {/* Delete Area Confirmation */}
      <AlertDialog open={deleteAreaId !== null} onOpenChange={(o) => { if (!o) setDeleteAreaId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("condominios.deleteAreaConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>{t("condominios.deleteAreaWarning")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteAreaId !== null && handleDeleteArea(deleteAreaId)} className="bg-destructive hover:bg-destructive/90">{t("common.delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Asset Confirmation */}
      <AlertDialog open={deleteAssetId !== null} onOpenChange={(o) => { if (!o) setDeleteAssetId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("ativos.deleteConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>{t("ativos.deleteWarning")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteAssetId !== null && handleDeleteAsset(deleteAssetId)} className="bg-destructive hover:bg-destructive/90">{t("common.delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── AssetSummaryBadges ───────────────────────────────────────────────────────

function AssetSummaryBadges({ condominioId }: { condominioId: number }) {
  const { t } = useTranslation();
  const { data: assets } = useListAssets(condominioId, undefined, { query: { queryKey: getListAssetsQueryKey(condominioId) } });
  if (!assets || assets.length === 0) return null;
  const critical = assets.filter(a => a.criticidade === "alta").length;
  const manutencao = assets.filter(a => a.status === "em_manutencao").length;
  const inativo = assets.filter(a => a.status === "inativo").length;
  if (critical === 0 && manutencao === 0 && inativo === 0) return null;
  return (
    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
      {critical > 0 && (
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full text-red-700 bg-red-50 flex items-center gap-0.5">
          <AlertTriangle className="h-2.5 w-2.5" />{t("condominios.areasItensCardCritical", { count: critical })}
        </span>
      )}
      {manutencao > 0 && (
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full text-amber-700 bg-amber-50 flex items-center gap-0.5">
          <Wrench className="h-2.5 w-2.5" />{t("condominios.areasItensCardManutencao", { count: manutencao })}
        </span>
      )}
      {inativo > 0 && (
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full text-gray-500 bg-gray-100">
          {t("condominios.areasItensCardInativo", { count: inativo })}
        </span>
      )}
    </div>
  );
}

// ─── ContratosPanel ───────────────────────────────────────────────────────────

type ContratoForm = { tipoServico: string; empresa: string; cnpjEmpresa: string; telefoneEmpresa: string; emailEmpresa: string; valorMensal: string; vigenciaInicio: string; vigenciaFim: string; periodicidadeVisita: string; };

const emptyContratoForm = (): ContratoForm => ({ tipoServico: "outros", empresa: "", cnpjEmpresa: "", telefoneEmpresa: "", emailEmpresa: "", valorMensal: "", vigenciaInicio: "", vigenciaFim: "", periodicidadeVisita: "" });

function ContratosPanel({ condominioId }: { condominioId: number }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ContratoForm>(emptyContratoForm());

  const { data: contratos, isPending } = useListContratos(condominioId, { query: { queryKey: getListContratosQueryKey(condominioId) } });
  const createContrato = useCreateContrato();
  const updateContrato = useUpdateContrato();
  const deleteContrato = useDeleteContrato();

  const openNew = () => { setForm(emptyContratoForm()); setEditingId(null); setDialogOpen(true); };
  const openEdit = (c: ContratoCondominio) => {
    setForm({ tipoServico: c.tipoServico, empresa: c.empresa ?? "", cnpjEmpresa: c.cnpjEmpresa ?? "", telefoneEmpresa: c.telefoneEmpresa ?? "", emailEmpresa: c.emailEmpresa ?? "", valorMensal: c.valorMensal?.toString() ?? "", vigenciaInicio: c.vigenciaInicio ?? "", vigenciaFim: c.vigenciaFim ?? "", periodicidadeVisita: c.periodicidadeVisita ?? "" });
    setEditingId(c.id);
    setDialogOpen(true);
  };

  const handleSave = () => {
    const payload = { tipoServico: form.tipoServico, empresa: form.empresa || undefined, cnpjEmpresa: form.cnpjEmpresa || undefined, telefoneEmpresa: form.telefoneEmpresa || undefined, emailEmpresa: form.emailEmpresa || undefined, valorMensal: form.valorMensal ? parseFloat(form.valorMensal) : undefined, vigenciaInicio: form.vigenciaInicio || undefined, vigenciaFim: form.vigenciaFim || undefined, periodicidadeVisita: form.periodicidadeVisita || undefined };
    const onSuccess = () => { qc.invalidateQueries({ queryKey: getListContratosQueryKey(condominioId) }); qc.invalidateQueries({ queryKey: getGetCondominioHealthQueryKey(condominioId) }); toast({ title: t("condominios.contratoSaved") }); setDialogOpen(false); };
    const onError = () => toast({ title: t("condominios.errorSaving"), variant: "destructive" });
    if (editingId) {
      updateContrato.mutate({ condominioId, contratoId: editingId, data: payload }, { onSuccess, onError });
    } else {
      createContrato.mutate({ condominioId, data: payload }, { onSuccess, onError });
    }
  };

  const handleDelete = (id: number) => {
    deleteContrato.mutate({ condominioId, contratoId: id }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListContratosQueryKey(condominioId) }); qc.invalidateQueries({ queryKey: getGetCondominioHealthQueryKey(condominioId) }); toast({ title: t("condominios.contratoDeleted") }); } });
  };

  const tipoLabel = (v: string) => {
    const map: Record<string, string> = { elevadores: t("condominios.contratoTipoElevadores"), portoes: t("condominios.contratoTipoPortoes"), jardinagem: t("condominios.contratoTipoJardinagem"), dedetizacao: t("condominios.contratoTipoDedetizacao"), cftv: t("condominios.contratoTipoCftv"), glp: t("condominios.contratoTipoGlp"), piscina: t("condominios.contratoTipoPiscina"), limpeza: t("condominios.contratoTipoLimpeza"), seguranca: t("condominios.contratoTipoSeguranca"), outros: t("condominios.contratoTipoOutros") };
    return map[v] || v;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{t("condominios.contratos")}</p>
        <Button size="sm" onClick={openNew}><Plus className="h-3.5 w-3.5 mr-1" />{t("condominios.addContrato")}</Button>
      </div>

      {isPending ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        : !contratos || contratos.length === 0 ? (
          <div className="text-center py-8 border border-dashed rounded-lg">
            <Wrench className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-30" />
            <p className="text-sm text-muted-foreground">{t("condominios.noContratos")}</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={openNew}><Plus className="h-3.5 w-3.5 mr-1" />{t("condominios.addContrato")}</Button>
          </div>
        ) : (
          <div className="space-y-2">
            {contratos.map(c => (
              <div key={c.id} className="flex items-start justify-between bg-muted/30 rounded-lg px-3 py-2.5 border gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">{tipoLabel(c.tipoServico)}</span>
                    <StatusBadge status={c.statusVigencia} />
                    {c.empresa && <span className="text-sm font-medium truncate">{c.empresa}</span>}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                    {c.vigenciaInicio && c.vigenciaFim && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{c.vigenciaInicio} → {c.vigenciaFim}</span>}
                    {c.valorMensal != null && <span>R$ {c.valorMensal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/mês</span>}
                    {c.periodicidadeVisita && <span>{c.periodicidadeVisita}</span>}
                    {c.telefoneEmpresa && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.telefoneEmpresa}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEdit(c)} className="p-1 text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => handleDelete(c.id)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingId ? t("condominios.editContrato") : t("condominios.addContrato")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("condominios.contratoTipoServico")} *</Label>
                <Select value={form.tipoServico} onValueChange={(v) => setForm(f => ({ ...f, tipoServico: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPO_SERVICO_OPTIONS.map(v => <SelectItem key={v} value={v}>{tipoLabel(v)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("condominios.contratoEmpresa")}</Label>
                <Input value={form.empresa} onChange={(e) => setForm(f => ({ ...f, empresa: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>{t("condominios.contratoCnpj")}</Label>
                <Input value={form.cnpjEmpresa} onChange={(e) => setForm(f => ({ ...f, cnpjEmpresa: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{t("condominios.contratoTelefone")}</Label>
                <Input value={form.telefoneEmpresa} onChange={(e) => setForm(f => ({ ...f, telefoneEmpresa: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{t("condominios.contratoEmail")}</Label>
                <Input type="email" value={form.emailEmpresa} onChange={(e) => setForm(f => ({ ...f, emailEmpresa: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>{t("condominios.contratoVigenciaInicio")}</Label>
                <Input type="date" value={form.vigenciaInicio} onChange={(e) => setForm(f => ({ ...f, vigenciaInicio: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{t("condominios.contratoVigenciaFim")}</Label>
                <Input type="date" value={form.vigenciaFim} onChange={(e) => setForm(f => ({ ...f, vigenciaFim: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{t("condominios.contratoValorMensal")}</Label>
                <Input type="number" min="0" step="0.01" value={form.valorMensal} onChange={(e) => setForm(f => ({ ...f, valorMensal: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("condominios.contratoPeriodicidade")}</Label>
              <Input value={form.periodicidadeVisita} onChange={(e) => setForm(f => ({ ...f, periodicidadeVisita: e.target.value }))} placeholder="Ex: Mensal, Trimestral..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleSave} disabled={!form.tipoServico || createContrato.isPending || updateContrato.isPending}>
              {(createContrato.isPending || updateContrato.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── PrestadoresPanel ─────────────────────────────────────────────────────────
// Multi-tenant model (see LOCAL_DEV.md / migration notes): a prestador is a
// master record at the empresa level; what this panel shows/edits is the
// per-condomínio ASSOCIATION (categoria/telefone/email here override the
// master's when set, vigência/valor are condomínio-specific). Uses apiFetch
// directly — /api/condominios/:id/prestadores's shape changed with this
// migration and the generated api-client-react hooks weren't regenerated
// for it (see src/lib/api-fetch.ts).

// Mirrors SERVICO_CATEGORIAS in lib/db/src/schema/assets.ts — kept as a
// small local duplicate since the frontend can't import the backend
// package's schema module.
const SERVICO_CATEGORIAS = [
  "elevador", "hidraulica", "eletrica", "pintura", "jardinagem",
  "portaria_seguranca", "limpeza", "ar_condicionado", "estrutural_civil",
  "incendio_ppci", "dedetizacao", "outro",
] as const;

interface PrestadorAssociacao {
  id: number;
  prestadorId: number;
  condominioId: number;
  nome: string;
  categoria: string | null;
  telefone: string | null;
  email: string | null;
  vigenciaInicio: string | null;
  vigenciaFim: string | null;
  valorMensal: number | null;
  avaliacao: number | null;
  observacoes: string | null;
  ativo: boolean;
}

type PrestadorForm = { nome: string; categoria: string; telefone: string; email: string; avaliacao: string; observacoes: string; };
const emptyPrestadorForm = (): PrestadorForm => ({ nome: "", categoria: "", telefone: "", email: "", avaliacao: "", observacoes: "" });

function PrestadoresPanel({ condominioId }: { condominioId: number }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<PrestadorForm>(emptyPrestadorForm());

  const queryKey = ["condominios", condominioId, "prestadores"];
  const { data: prestadores, isPending } = useQuery({
    queryKey,
    queryFn: () => apiFetch<PrestadorAssociacao[]>(`/api/condominios/${condominioId}/prestadores`),
  });

  const openNew = () => { setForm(emptyPrestadorForm()); setEditingId(null); setDialogOpen(true); };
  const openEdit = (p: PrestadorAssociacao) => {
    setForm({ nome: p.nome, categoria: p.categoria ?? "", telefone: p.telefone ?? "", email: p.email ?? "", avaliacao: p.avaliacao?.toString() ?? "", observacoes: p.observacoes ?? "" });
    setEditingId(p.id);
    setDialogOpen(true);
  };

  const onSuccess = () => { qc.invalidateQueries({ queryKey }); toast({ title: t("condominios.prestadorSaved") }); setDialogOpen(false); };
  const onError = (e: Error) => toast({ title: t("condominios.errorSaving"), description: e.message, variant: "destructive" });

  const createPrestador = useMutation({
    mutationFn: () => apiFetch(`/api/condominios/${condominioId}/prestadores`, {
      method: "POST",
      body: JSON.stringify({
        nome: form.nome.trim(),
        categoria: form.categoria || undefined,
        telefone: form.telefone || undefined,
        email: form.email || undefined,
        avaliacao: form.avaliacao ? parseInt(form.avaliacao) : undefined,
        observacoes: form.observacoes || undefined,
      }),
    }),
    onSuccess, onError,
  });
  const updatePrestador = useMutation({
    mutationFn: () => apiFetch(`/api/condominios/${condominioId}/prestadores/${editingId}`, {
      method: "PATCH",
      body: JSON.stringify({
        categoria: form.categoria || null,
        telefone: form.telefone || null,
        email: form.email || null,
        avaliacao: form.avaliacao ? parseInt(form.avaliacao) : null,
        observacoes: form.observacoes || null,
      }),
    }),
    onSuccess, onError,
  });
  const deletePrestador = useMutation({
    mutationFn: (associacaoId: number) => apiFetch(`/api/condominios/${condominioId}/prestadores/${associacaoId}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey }); toast({ title: t("condominios.prestadorDeleted") }); },
    onError,
  });

  const handleSave = () => { if (editingId) updatePrestador.mutate(); else createPrestador.mutate(); };

  const categoriaLabel = (v: string) => {
    const map: Record<string, string> = {
      elevador: "Elevador", hidraulica: "Hidráulica", eletrica: "Elétrica", pintura: "Pintura",
      jardinagem: "Jardinagem", portaria_seguranca: "Portaria/Segurança", limpeza: "Limpeza",
      ar_condicionado: "Ar-condicionado", estrutural_civil: "Estrutural/Civil", incendio_ppci: "Incêndio/PPCI",
      dedetizacao: "Dedetização", outro: "Outro",
    };
    return map[v] || v;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{t("condominios.prestadores")}</p>
        <Button size="sm" onClick={openNew}><Plus className="h-3.5 w-3.5 mr-1" />{t("condominios.addPrestador")}</Button>
      </div>

      {isPending ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        : !prestadores || prestadores.length === 0 ? (
          <div className="text-center py-8 border border-dashed rounded-lg">
            <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-30" />
            <p className="text-sm text-muted-foreground">{t("condominios.noPrestadores")}</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={openNew}><Plus className="h-3.5 w-3.5 mr-1" />{t("condominios.addPrestador")}</Button>
          </div>
        ) : (
          <div className="space-y-2">
            {prestadores.map(p => (
              <div key={p.id} className="flex items-start justify-between bg-muted/30 rounded-lg px-3 py-2.5 border gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-medium text-sm">{p.nome}</span>
                    {p.categoria && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{categoriaLabel(p.categoria)}</span>}
                    {p.avaliacao != null && (
                      <span className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }, (_, i) => <Star key={i} className={`h-3 w-3 ${i < p.avaliacao! ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                    {p.telefone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{p.telefone}</span>}
                    {p.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{p.email}</span>}
                    {p.observacoes && <span className="truncate max-w-[200px]">{p.observacoes}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEdit(p)} className="p-1 text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => deletePrestador.mutate(p.id)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingId ? t("condominios.editPrestador") : t("condominios.addPrestador")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("condominios.prestadorNome")} *</Label>
              <Input value={form.nome} onChange={(e) => setForm(f => ({ ...f, nome: e.target.value }))} disabled={!!editingId} />
              {editingId && <p className="text-xs text-muted-foreground">O nome pertence ao cadastro do prestador (nível empresa) e não é editável aqui.</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Categoria de serviço</Label>
                <Select value={form.categoria || "__none__"} onValueChange={(v) => setForm(f => ({ ...f, categoria: v === "__none__" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {SERVICO_CATEGORIAS.map(v => <SelectItem key={v} value={v}>{categoriaLabel(v)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("condominios.prestadorAvaliacao")} (1–5)</Label>
                <Input type="number" min="1" max="5" value={form.avaliacao} onChange={(e) => setForm(f => ({ ...f, avaliacao: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("condominios.prestadorTelefone")}</Label>
                <Input value={form.telefone} onChange={(e) => setForm(f => ({ ...f, telefone: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{t("condominios.prestadorEmail")}</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("condominios.prestadorObservacoes")}</Label>
              <Textarea rows={2} value={form.observacoes} onChange={(e) => setForm(f => ({ ...f, observacoes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleSave} disabled={!form.nome.trim() || createPrestador.isPending || updatePrestador.isPending}>
              {(createPrestador.isPending || updatePrestador.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── DocumentosPanel ─────────────────────────────────────────────────────────

type DocumentoForm = { tipo: string; numeroReferencia: string; dataEmissao: string; dataValidade: string; empresaResponsavel: string; };
const emptyDocumentoForm = (): DocumentoForm => ({ tipo: "outros", numeroReferencia: "", dataEmissao: "", dataValidade: "", empresaResponsavel: "" });

function DocumentosPanel({ condominioId }: { condominioId: number }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<DocumentoForm>(emptyDocumentoForm());

  const { data: documentos, isPending } = useListDocumentos(condominioId, { query: { queryKey: getListDocumentosQueryKey(condominioId) } });
  const createDocumento = useCreateDocumento();
  const updateDocumento = useUpdateDocumento();
  const deleteDocumento = useDeleteDocumento();

  const openNew = () => { setForm(emptyDocumentoForm()); setEditingId(null); setDialogOpen(true); };
  const openEdit = (d: DocumentoCondominio) => {
    setForm({ tipo: d.tipo, numeroReferencia: d.numeroReferencia ?? "", dataEmissao: d.dataEmissao ?? "", dataValidade: d.dataValidade ?? "", empresaResponsavel: d.empresaResponsavel ?? "" });
    setEditingId(d.id);
    setDialogOpen(true);
  };

  const handleSave = () => {
    const payload = { tipo: form.tipo, numeroReferencia: form.numeroReferencia || undefined, dataEmissao: form.dataEmissao || undefined, dataValidade: form.dataValidade || undefined, empresaResponsavel: form.empresaResponsavel || undefined };
    const onSuccess = () => { qc.invalidateQueries({ queryKey: getListDocumentosQueryKey(condominioId) }); qc.invalidateQueries({ queryKey: getGetCondominioHealthQueryKey(condominioId) }); toast({ title: t("condominios.documentoSaved") }); setDialogOpen(false); };
    const onError = () => toast({ title: t("condominios.errorSaving"), variant: "destructive" });
    if (editingId) {
      updateDocumento.mutate({ condominioId, documentoId: editingId, data: payload }, { onSuccess, onError });
    } else {
      createDocumento.mutate({ condominioId, data: payload }, { onSuccess, onError });
    }
  };

  const docTipoLabel = (v: string) => {
    const map: Record<string, string> = { avcb: t("condominios.documentoTipoAvcb"), habite: t("condominios.documentoTipoHabite"), spda: t("condominios.documentoTipoSpda"), elevadores: t("condominios.documentoTipoElevadores"), glp: t("condominios.documentoTipoGlp"), alvara: t("condominios.documentoTipoAlvara"), convencao: t("condominios.documentoTipoConvencao"), regimento: t("condominios.documentoTipoRegimento"), outros: t("condominios.documentoTipoOutros") };
    return map[v] || v;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{t("condominios.documentos")}</p>
        <Button size="sm" onClick={openNew}><Plus className="h-3.5 w-3.5 mr-1" />{t("condominios.addDocumento")}</Button>
      </div>

      {isPending ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        : !documentos || documentos.length === 0 ? (
          <div className="text-center py-8 border border-dashed rounded-lg">
            <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-30" />
            <p className="text-sm text-muted-foreground">{t("condominios.noDocumentos")}</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={openNew}><Plus className="h-3.5 w-3.5 mr-1" />{t("condominios.addDocumento")}</Button>
          </div>
        ) : (
          <div className="space-y-2">
            {documentos.map(d => (
              <div key={d.id} className="flex items-start justify-between bg-muted/30 rounded-lg px-3 py-2.5 border gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">{docTipoLabel(d.tipo)}</span>
                    <StatusBadge status={d.statusDocumento} />
                    {d.numeroReferencia && <span className="text-sm font-mono text-muted-foreground">{d.numeroReferencia}</span>}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                    {d.dataEmissao && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Emissão: {d.dataEmissao}</span>}
                    {d.dataValidade && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Validade: {d.dataValidade}</span>}
                    {d.empresaResponsavel && <span>{d.empresaResponsavel}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEdit(d)} className="p-1 text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => deleteDocumento.mutate({ condominioId, documentoId: d.id }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListDocumentosQueryKey(condominioId) }); qc.invalidateQueries({ queryKey: getGetCondominioHealthQueryKey(condominioId) }); toast({ title: t("condominios.documentoDeleted") }); } })} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingId ? t("condominios.editDocumento") : t("condominios.addDocumento")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("condominios.documentoTipo")} *</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm(f => ({ ...f, tipo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPO_DOCUMENTO_OPTIONS.map(v => <SelectItem key={v} value={v}>{docTipoLabel(v)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("condominios.documentoNumeroReferencia")}</Label>
                <Input value={form.numeroReferencia} onChange={(e) => setForm(f => ({ ...f, numeroReferencia: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("condominios.documentoDataEmissao")}</Label>
                <Input type="date" value={form.dataEmissao} onChange={(e) => setForm(f => ({ ...f, dataEmissao: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{t("condominios.documentoDataValidade")}</Label>
                <Input type="date" value={form.dataValidade} onChange={(e) => setForm(f => ({ ...f, dataValidade: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("condominios.documentoEmpresaResponsavel")}</Label>
              <Input value={form.empresaResponsavel} onChange={(e) => setForm(f => ({ ...f, empresaResponsavel: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleSave} disabled={!form.tipo || createDocumento.isPending || updateDocumento.isPending}>
              {(createDocumento.isPending || updateDocumento.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── SeguroPanel ──────────────────────────────────────────────────────────────

type SeguroForm = { seguradora: string; numeroApolice: string; vigenciaInicio: string; vigenciaFim: string; tipoCobertura: string; valorSegurado: string; nomeCorretor: string; telefoneCorretor: string; };
const emptySeguroForm = (): SeguroForm => ({ seguradora: "", numeroApolice: "", vigenciaInicio: "", vigenciaFim: "", tipoCobertura: "", valorSegurado: "", nomeCorretor: "", telefoneCorretor: "" });

function SeguroPanel({ condominioId }: { condominioId: number }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<SeguroForm>(emptySeguroForm());

  const { data: seguro, isPending, isError } = useGetSeguroPredial(condominioId, {
    query: { queryKey: getGetSeguroPredialQueryKey(condominioId), retry: false }
  });
  const upsertSeguro = useUpsertSeguroPredial();

  useEffect(() => {
    if (seguro) {
      setForm({
        seguradora: seguro.seguradora ?? "",
        numeroApolice: seguro.numeroApolice ?? "",
        vigenciaInicio: seguro.vigenciaInicio ?? "",
        vigenciaFim: seguro.vigenciaFim ?? "",
        tipoCobertura: seguro.tipoCobertura ?? "",
        valorSegurado: seguro.valorSegurado?.toString() ?? "",
        nomeCorretor: seguro.nomeCorretor ?? "",
        telefoneCorretor: seguro.telefoneCorretor ?? "",
      });
    }
  }, [seguro]);

  const handleSave = () => {
    const payload = { seguradora: form.seguradora || undefined, numeroApolice: form.numeroApolice || undefined, vigenciaInicio: form.vigenciaInicio || undefined, vigenciaFim: form.vigenciaFim || undefined, tipoCobertura: form.tipoCobertura || undefined, valorSegurado: form.valorSegurado ? parseFloat(form.valorSegurado) : undefined, nomeCorretor: form.nomeCorretor || undefined, telefoneCorretor: form.telefoneCorretor || undefined };
    upsertSeguro.mutate({ condominioId, data: payload }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getGetSeguroPredialQueryKey(condominioId) }); qc.invalidateQueries({ queryKey: getGetCondominioHealthQueryKey(condominioId) }); toast({ title: t("condominios.seguroSaved") }); },
      onError: () => toast({ title: t("condominios.errorSaving"), variant: "destructive" }),
    });
  };

  if (isPending) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{t("condominios.seguro")}</p>
          {seguro && <StatusBadge status={seguro.statusVigencia} />}
          {isError && !seguro && <StatusBadge status="sem_registro" />}
        </div>
      </div>

      {isError && !seguro && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border text-sm text-muted-foreground">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          {t("condominios.seguroSemRegistro")}
        </div>
      )}

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>{t("condominios.seguroSeguradora")}</Label>
            <Input value={form.seguradora} onChange={(e) => setForm(f => ({ ...f, seguradora: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>{t("condominios.seguroNumeroApolice")}</Label>
            <Input value={form.numeroApolice} onChange={(e) => setForm(f => ({ ...f, numeroApolice: e.target.value }))} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label>{t("condominios.seguroVigenciaInicio")}</Label>
            <Input type="date" value={form.vigenciaInicio} onChange={(e) => setForm(f => ({ ...f, vigenciaInicio: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>{t("condominios.seguroVigenciaFim")}</Label>
            <Input type="date" value={form.vigenciaFim} onChange={(e) => setForm(f => ({ ...f, vigenciaFim: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>{t("condominios.seguroValorSegurado")}</Label>
            <Input type="number" min="0" step="1000" value={form.valorSegurado} onChange={(e) => setForm(f => ({ ...f, valorSegurado: e.target.value }))} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>{t("condominios.seguroTipoCobertura")}</Label>
          <Select value={form.tipoCobertura || "__none__"} onValueChange={(v) => setForm(f => ({ ...f, tipoCobertura: v === "__none__" ? "" : v }))}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">—</SelectItem>
              <SelectItem value="basica">{t("condominios.seguroCoberturaBasica")}</SelectItem>
              <SelectItem value="ampla">{t("condominios.seguroCoberturaAmpla")}</SelectItem>
              <SelectItem value="total">{t("condominios.seguroCoberturaTotal")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>{t("condominios.seguroNomeCorretor")}</Label>
            <Input value={form.nomeCorretor} onChange={(e) => setForm(f => ({ ...f, nomeCorretor: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>{t("condominios.seguroTelefoneCorretor")}</Label>
            <Input value={form.telefoneCorretor} onChange={(e) => setForm(f => ({ ...f, telefoneCorretor: e.target.value }))} />
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} disabled={upsertSeguro.isPending}>
          {upsertSeguro.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {t("common.save")}
        </Button>
      </div>
    </div>
  );
}

// ─── HealthIndicator ──────────────────────────────────────────────────────────

function HealthIndicator({ condominioId }: { condominioId: number }) {
  const { t } = useTranslation();
  const { data: health } = useGetCondominioHealth(condominioId, {
    query: { queryKey: getGetCondominioHealthQueryKey(condominioId), staleTime: 5 * 60 * 1000 }
  });
  if (!health) return null;
  const vencidos = health.contratosVencidos + health.documentosVencidos + (health.seguroVencido ? 1 : 0);
  const aVencer = health.contratosAVencer + health.documentosAVencer + (health.seguroAVencer ? 1 : 0);
  if (vencidos === 0 && aVencer === 0) return null;
  return (
    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
      {vencidos > 0 && (
        <span className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
          <AlertTriangle className="h-3 w-3" />{t("condominios.alertasVencidos", { count: vencidos })}
        </span>
      )}
      {aVencer > 0 && (
        <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
          <Clock className="h-3 w-3" />{t("condominios.alertasAVencer", { count: aVencer })}
        </span>
      )}
    </div>
  );
}

// ─── CondominioCard ───────────────────────────────────────────────────────────

function CondominioCard({ condo, onEdit }: { condo: Condominio; onEdit: (c: Condominio) => void }) {
  const { t } = useTranslation();
  const tipoLabel: Record<string, string> = {
    residencial: t("condominios.tipoResidencial"),
    comercial: t("condominios.tipoComercial"),
    misto: t("condominios.tipoMisto"),
  };
  return (
    <Card className="hover:border-primary/30 transition-colors">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="h-4 w-4 text-primary shrink-0" />
              <h3 className="font-semibold text-base truncate">{condo.nome}</h3>
              <Badge variant="outline" className="text-xs shrink-0">{tipoLabel[condo.tipoCondominio] || condo.tipoCondominio}</Badge>
              {!condo.ativo && <Badge variant="secondary" className="text-xs">Inativo</Badge>}
            </div>
            {(condo.cidade || condo.estado || condo.endereco || condo.bairro) && (
              <p className="text-sm text-muted-foreground truncate flex items-center gap-1">
                <MapPin className="h-3 w-3 shrink-0" />
                {[condo.endereco, condo.bairro, condo.cidade, condo.estado].filter(Boolean).join(", ")}
              </p>
            )}
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
              {condo.totalUnidades && <span className="flex items-center gap-1"><Hash className="h-3 w-3" />{condo.totalUnidades} {t("condominios.unidades")}</span>}
              {condo.totalBlocos && <span>{condo.totalBlocos} {t("condominios.totalBlocos").toLowerCase()}</span>}
              {condo.totalAndares && <span>{condo.totalAndares} {t("condominios.totalAndares").toLowerCase()}</span>}
              {condo.sindico && <span className="flex items-center gap-1"><Shield className="h-3 w-3" />{condo.sindico}</span>}
              {condo.cnpj && <span className="font-mono">{condo.cnpj}</span>}
            </div>
            <AssetSummaryBadges condominioId={condo.id} />
            <HealthIndicator condominioId={condo.id} />
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(condo)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── CondominiosPage ──────────────────────────────────────────────────────────

export default function CondominiosPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<CondominioForm>(emptyForm());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("geral");

  const { data: condominios, isPending, isError } = useListCondominios({ query: { queryKey: getListCondominiosQueryKey() } });
  const createCondominio = useCreateCondominio();
  const updateCondominio = useUpdateCondominio();

  const buildEquipePayload = (f: CondominioForm) => {
    const equipe = {
      subSindico: { nome: f.equipeSubSindicoNome || undefined, telefone: f.equipeSubSindicoTelefone || undefined, email: f.equipeSubSindicoEmail || undefined },
      zelador: { tipo: f.equipeZeladorTipo || undefined, nome: f.equipeZeladorNome || undefined, telefone: f.equipeZeladorTelefone || undefined, empresaTerceirizadora: f.equipeZeladorEmpresa || undefined },
      portaria: { tipo: f.equipePortariaTipo || undefined, empresa: f.equipePortariaEmpresa || undefined },
      asg: { quantidade: f.equipeAsgQtd ? parseInt(f.equipeAsgQtd) : undefined, empresa: f.equipeAsgEmpresa || undefined },
      seguranca: { quantidade: f.equipeSegurancaQtd ? parseInt(f.equipeSegurancaQtd) : undefined, empresa: f.equipeSegurancaEmpresa || undefined },
    };
    const hasData = Object.values(equipe).some(v => Object.values(v).some(x => x !== undefined));
    return hasData ? equipe : undefined;
  };

  const openNew = () => { setForm(emptyForm()); setEditingId(null); setActiveTab("geral"); setDialogOpen(true); };

  const openEdit = (c: Condominio) => {
    const eq = c.equipe;
    setForm({
      nome: c.nome, cnpj: c.cnpj ?? "", tipoCondominio: c.tipoCondominio ?? "residencial",
      endereco: c.endereco ?? "", cep: c.cep ?? "", bairro: c.bairro ?? "", cidade: c.cidade ?? "", estado: c.estado ?? "",
      totalUnidades: c.totalUnidades?.toString() ?? "", totalBlocos: c.totalBlocos?.toString() ?? "",
      totalAndares: c.totalAndares?.toString() ?? "", anoConstrucao: c.anoConstrucao?.toString() ?? "",
      telefone: c.telefone ?? "", email: c.email ?? "", sindico: c.sindico ?? "",
      zelador: c.zelador ?? "", administradora: c.administradora ?? "",
      inscricaoMunicipal: c.inscricaoMunicipal ?? "",
      areaTotalM2: c.areaTotalM2?.toString() ?? "",
      areaLazerM2: c.areaLazerM2?.toString() ?? "",
      numElevadores: c.numElevadores?.toString() ?? "",
      tipoPortaria: c.tipoPortaria ?? "",
      equipeSubSindicoNome: eq?.subSindico?.nome ?? "",
      equipeSubSindicoTelefone: eq?.subSindico?.telefone ?? "",
      equipeSubSindicoEmail: eq?.subSindico?.email ?? "",
      equipeZeladorTipo: eq?.zelador?.tipo ?? "",
      equipeZeladorNome: eq?.zelador?.nome ?? "",
      equipeZeladorTelefone: eq?.zelador?.telefone ?? "",
      equipeZeladorEmpresa: eq?.zelador?.empresaTerceirizadora ?? "",
      equipePortariaTipo: eq?.portaria?.tipo ?? "",
      equipePortariaEmpresa: eq?.portaria?.empresa ?? "",
      equipeAsgQtd: eq?.asg?.quantidade?.toString() ?? "",
      equipeAsgEmpresa: eq?.asg?.empresa ?? "",
      equipeSegurancaQtd: eq?.seguranca?.quantidade?.toString() ?? "",
      equipeSegurancaEmpresa: eq?.seguranca?.empresa ?? "",
      ativo: c.ativo,
    });
    setEditingId(c.id);
    setActiveTab("geral");
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.nome.trim()) return;
    const payload: CondominioBody = {
      nome: form.nome.trim(),
      cnpj: form.cnpj || undefined,
      tipoCondominio: (form.tipoCondominio as CondominioBody["tipoCondominio"]) || undefined,
      endereco: form.endereco || undefined,
      cep: form.cep || undefined,
      bairro: form.bairro || undefined,
      cidade: form.cidade || undefined,
      estado: form.estado || undefined,
      totalUnidades: form.totalUnidades ? parseInt(form.totalUnidades) : undefined,
      totalBlocos: form.totalBlocos ? parseInt(form.totalBlocos) : undefined,
      totalAndares: form.totalAndares ? parseInt(form.totalAndares) : undefined,
      anoConstrucao: form.anoConstrucao ? parseInt(form.anoConstrucao) : undefined,
      telefone: form.telefone || undefined,
      email: form.email || undefined,
      sindico: form.sindico || undefined,
      zelador: form.zelador || undefined,
      administradora: form.administradora || undefined,
      inscricaoMunicipal: form.inscricaoMunicipal || undefined,
      areaTotalM2: form.areaTotalM2 ? parseFloat(form.areaTotalM2) : undefined,
      areaLazerM2: form.areaLazerM2 ? parseFloat(form.areaLazerM2) : undefined,
      numElevadores: form.numElevadores ? parseInt(form.numElevadores) : undefined,
      tipoPortaria: form.tipoPortaria || undefined,
      equipe: buildEquipePayload(form),
      ativo: form.ativo,
    };
    const onSuccess = () => { qc.invalidateQueries({ queryKey: getListCondominiosQueryKey() }); toast({ title: t("condominios.savedSuccess") }); setDialogOpen(false); };
    const onError = () => toast({ title: t("condominios.errorSaving"), variant: "destructive" });
    if (editingId) {
      updateCondominio.mutate({ id: editingId, data: payload }, { onSuccess, onError });
    } else {
      createCondominio.mutate({ data: payload }, {
        onSuccess: (data: Condominio) => {
          qc.invalidateQueries({ queryKey: getListCondominiosQueryKey() });
          toast({ title: t("condominios.savedSuccess") });
          setEditingId(data.id);
          setActiveTab("equipe");
        },
        onError,
      });
    }
  };

  const isSaving = createCondominio.isPending || updateCondominio.isPending;
  const isGeralOrEquipe = activeTab === "geral" || activeTab === "equipe";

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("condominios.title")}</h1>
          <p className="text-muted-foreground">{t("condominios.subtitle")}</p>
        </div>
        <Button onClick={openNew} className="shrink-0" data-testid="button-new-condominio">
          <Plus className="h-4 w-4 mr-2" />{t("condominios.newCondominio")}
        </Button>
      </div>

      {isPending ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : isError ? (
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive opacity-50" />
          <p className="text-muted-foreground">{t("condominios.errorLoading")}</p>
        </div>
      ) : !condominios || condominios.length === 0 ? (
        <div className="text-center py-16 border border-dashed rounded-xl bg-card">
          <Building2 className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-20" />
          <h3 className="font-medium text-foreground">{t("condominios.noCondominios")}</h3>
          <Button className="mt-4" onClick={openNew}>{t("condominios.createFirst")}</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {condominios.map(c => <CondominioCard key={c.id} condo={c} onEdit={openEdit} />)}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) setActiveTab("geral"); setDialogOpen(o); }}>
        <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col gap-0 p-0 overflow-hidden">
          <div className="flex-shrink-0 px-6 py-4 border-b">
            <DialogTitle className="text-lg font-semibold">
              {editingId ? t("condominios.editCondominio") : t("condominios.newCondominio")}
            </DialogTitle>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="flex-shrink-0 border-b bg-background px-4 pt-2">
              <TabsList className="h-auto p-0 bg-transparent gap-0 flex-wrap">
                {(
                  [
                    { value: "geral", label: t("condominios.tabGeral") },
                    { value: "equipe", label: t("condominios.tabEquipe") },
                    { value: "areas-itens", label: t("condominios.tabAreasItens"), disabled: !editingId },
                    { value: "contratos", label: t("condominios.tabContratos"), disabled: !editingId },
                    { value: "prestadores", label: t("condominios.tabPrestadores"), disabled: !editingId },
                    { value: "documentos", label: t("condominios.tabDocumentos"), disabled: !editingId },
                    { value: "seguro", label: t("condominios.tabSeguro"), disabled: !editingId },
                  ] as Array<{ value: string; label: string; disabled?: boolean }>
                ).map(tab => (
                  <TabsTrigger key={tab.value} value={tab.value} disabled={tab.disabled}
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 pb-2 text-sm">
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">
              {/* ── Geral Tab ── */}
              <TabsContent value="geral" className="p-6 m-0 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2 sm:col-span-2">
                    <Label>{t("condominios.nome")} *</Label>
                    <Input value={form.nome} onChange={(e) => setForm(f => ({ ...f, nome: e.target.value }))} placeholder={t("condominios.nomePlaceholder")} data-testid="input-condo-nome" />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("condominios.cnpj")}</Label>
                    <Input value={form.cnpj} onChange={(e) => setForm(f => ({ ...f, cnpj: e.target.value }))} placeholder={t("condominios.cnpjPlaceholder")} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("condominios.tipoCondominio")}</Label>
                    <Select value={form.tipoCondominio} onValueChange={(v) => setForm(f => ({ ...f, tipoCondominio: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="residencial">{t("condominios.tipoResidencial")}</SelectItem>
                        <SelectItem value="comercial">{t("condominios.tipoComercial")}</SelectItem>
                        <SelectItem value="misto">{t("condominios.tipoMisto")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("condominios.inscricaoMunicipal")}</Label>
                    <Input value={form.inscricaoMunicipal} onChange={(e) => setForm(f => ({ ...f, inscricaoMunicipal: e.target.value }))} />
                  </div>
                </div>

                <div>
                  <SectionLabel icon={MapPin} label={t("condominios.sectionEndereco")} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2 sm:col-span-2">
                      <Label>{t("condominios.endereco")}</Label>
                      <Input value={form.endereco} onChange={(e) => setForm(f => ({ ...f, endereco: e.target.value }))} placeholder={t("condominios.enderecoPlaceholder")} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("condominios.bairro")}</Label>
                      <Input value={form.bairro} onChange={(e) => setForm(f => ({ ...f, bairro: e.target.value }))} placeholder={t("condominios.bairroPlaceholder")} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("condominios.cep")}</Label>
                      <Input value={form.cep} onChange={(e) => setForm(f => ({ ...f, cep: e.target.value }))} placeholder={t("condominios.cepPlaceholder")} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("condominios.cidade")}</Label>
                      <Input value={form.cidade} onChange={(e) => setForm(f => ({ ...f, cidade: e.target.value }))} placeholder={t("condominios.cidadePlaceholder")} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("condominios.estado")}</Label>
                      <Input value={form.estado} onChange={(e) => setForm(f => ({ ...f, estado: e.target.value }))} placeholder={t("condominios.estadoPlaceholder")} maxLength={2} />
                    </div>
                  </div>
                </div>

                <div>
                  <SectionLabel icon={Building2} label={t("condominios.sectionEstrutura")} />
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="space-y-2">
                      <Label>{t("condominios.totalUnidades")}</Label>
                      <Input type="number" min="0" value={form.totalUnidades} onChange={(e) => setForm(f => ({ ...f, totalUnidades: e.target.value }))} placeholder="120" />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("condominios.totalBlocos")}</Label>
                      <Input type="number" min="0" value={form.totalBlocos} onChange={(e) => setForm(f => ({ ...f, totalBlocos: e.target.value }))} placeholder="4" />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("condominios.totalAndares")}</Label>
                      <Input type="number" min="0" value={form.totalAndares} onChange={(e) => setForm(f => ({ ...f, totalAndares: e.target.value }))} placeholder="20" />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("condominios.anoConstrucao")}</Label>
                      <Input type="number" min="1900" max="2099" value={form.anoConstrucao} onChange={(e) => setForm(f => ({ ...f, anoConstrucao: e.target.value }))} placeholder="2015" />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("condominios.areaTotalM2")}</Label>
                      <Input type="number" min="0" step="0.1" value={form.areaTotalM2} onChange={(e) => setForm(f => ({ ...f, areaTotalM2: e.target.value }))} placeholder="5000" />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("condominios.areaLazerM2")}</Label>
                      <Input type="number" min="0" step="0.1" value={form.areaLazerM2} onChange={(e) => setForm(f => ({ ...f, areaLazerM2: e.target.value }))} placeholder="800" />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("condominios.numElevadores")}</Label>
                      <Input type="number" min="0" value={form.numElevadores} onChange={(e) => setForm(f => ({ ...f, numElevadores: e.target.value }))} placeholder="4" />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("condominios.tipoPortaria")}</Label>
                      <Select value={form.tipoPortaria || "__none__"} onValueChange={(v) => setForm(f => ({ ...f, tipoPortaria: v === "__none__" ? "" : v }))}>
                        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">—</SelectItem>
                          <SelectItem value="propria">{t("condominios.tipoPortariaPropria")}</SelectItem>
                          <SelectItem value="terceirizada">{t("condominios.tipoPortariaTerceirizada")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div>
                  <SectionLabel icon={Phone} label={t("condominios.sectionContatos")} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>{t("condominios.telefone")}</Label>
                      <Input value={form.telefone} onChange={(e) => setForm(f => ({ ...f, telefone: e.target.value }))} placeholder={t("condominios.telefonePlaceholder")} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("condominios.email")}</Label>
                      <Input type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} placeholder={t("condominios.emailPlaceholder")} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("condominios.sindicoNome")}</Label>
                      <Input value={form.sindico} onChange={(e) => setForm(f => ({ ...f, sindico: e.target.value }))} placeholder={t("condominios.sindicoPlaceholder")} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("condominios.zelador")}</Label>
                      <Input value={form.zelador} onChange={(e) => setForm(f => ({ ...f, zelador: e.target.value }))} placeholder={t("condominios.zeladorPlaceholder")} />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>{t("condominios.administradora")}</Label>
                      <Input value={form.administradora} onChange={(e) => setForm(f => ({ ...f, administradora: e.target.value }))} placeholder={t("condominios.administradoraPlaceholder")} />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Switch checked={form.ativo} onCheckedChange={(v) => setForm(f => ({ ...f, ativo: v }))} id="ativo-switch" />
                  <Label htmlFor="ativo-switch">{t("condominios.ativo")}</Label>
                </div>
              </TabsContent>

              {/* ── Equipe Tab ── */}
              <TabsContent value="equipe" className="p-6 m-0 space-y-6">
                <div>
                  <SectionLabel icon={Shield} label={t("condominios.equipeSubSindico")} />
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label>{t("condominios.equipeNome")}</Label>
                      <Input value={form.equipeSubSindicoNome} onChange={(e) => setForm(f => ({ ...f, equipeSubSindicoNome: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("condominios.equipeTelefone")}</Label>
                      <Input value={form.equipeSubSindicoTelefone} onChange={(e) => setForm(f => ({ ...f, equipeSubSindicoTelefone: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("condominios.equipeEmail")}</Label>
                      <Input type="email" value={form.equipeSubSindicoEmail} onChange={(e) => setForm(f => ({ ...f, equipeSubSindicoEmail: e.target.value }))} />
                    </div>
                  </div>
                </div>

                <div>
                  <SectionLabel icon={Wrench} label={t("condominios.equipeZelador")} />
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="space-y-2">
                      <Label>{t("condominios.equipeTipo")}</Label>
                      <Select value={form.equipeZeladorTipo || "__none__"} onValueChange={(v) => setForm(f => ({ ...f, equipeZeladorTipo: v === "__none__" ? "" : v }))}>
                        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">—</SelectItem>
                          <SelectItem value="clt">{t("condominios.equipeTipoClt")}</SelectItem>
                          <SelectItem value="terceirizado">{t("condominios.equipeTipoTerceirizado")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t("condominios.equipeNome")}</Label>
                      <Input value={form.equipeZeladorNome} onChange={(e) => setForm(f => ({ ...f, equipeZeladorNome: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("condominios.equipeTelefone")}</Label>
                      <Input value={form.equipeZeladorTelefone} onChange={(e) => setForm(f => ({ ...f, equipeZeladorTelefone: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("condominios.equipeEmpresaTerceirizadora")}</Label>
                      <Input value={form.equipeZeladorEmpresa} onChange={(e) => setForm(f => ({ ...f, equipeZeladorEmpresa: e.target.value }))} />
                    </div>
                  </div>
                </div>

                <div>
                  <SectionLabel icon={Building2} label={t("condominios.equipePortaria")} />
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>{t("condominios.equipeTipo")}</Label>
                      <Select value={form.equipePortariaTipo || "__none__"} onValueChange={(v) => setForm(f => ({ ...f, equipePortariaTipo: v === "__none__" ? "" : v }))}>
                        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">—</SelectItem>
                          <SelectItem value="propria">{t("condominios.equipeTipoPropria")}</SelectItem>
                          <SelectItem value="terceirizada">{t("condominios.equipeTipoTerceirizada")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t("condominios.equipeEmpresa")}</Label>
                      <Input value={form.equipePortariaEmpresa} onChange={(e) => setForm(f => ({ ...f, equipePortariaEmpresa: e.target.value }))} />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <SectionLabel icon={Users} label={t("condominios.equipeAsg")} />
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>{t("condominios.equipeQtd")}</Label>
                        <Input type="number" min="0" value={form.equipeAsgQtd} onChange={(e) => setForm(f => ({ ...f, equipeAsgQtd: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("condominios.equipeEmpresa")}</Label>
                        <Input value={form.equipeAsgEmpresa} onChange={(e) => setForm(f => ({ ...f, equipeAsgEmpresa: e.target.value }))} />
                      </div>
                    </div>
                  </div>
                  <div>
                    <SectionLabel icon={Shield} label={t("condominios.equipeSeguranca")} />
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>{t("condominios.equipeQtd")}</Label>
                        <Input type="number" min="0" value={form.equipeSegurancaQtd} onChange={(e) => setForm(f => ({ ...f, equipeSegurancaQtd: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("condominios.equipeEmpresa")}</Label>
                        <Input value={form.equipeSegurancaEmpresa} onChange={(e) => setForm(f => ({ ...f, equipeSegurancaEmpresa: e.target.value }))} />
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* ── Áreas & Itens Tab ── */}
              <TabsContent value="areas-itens" className="p-6 m-0">
                {editingId ? <AreasItensTab condominioId={editingId} /> : <SaveFirstMessage t={t} />}
              </TabsContent>

              {/* ── Sub-entity Tabs ── */}
              <TabsContent value="contratos" className="p-6 m-0">
                {editingId ? <ContratosPanel condominioId={editingId} /> : <SaveFirstMessage t={t} />}
              </TabsContent>
              <TabsContent value="prestadores" className="p-6 m-0">
                {editingId ? <PrestadoresPanel condominioId={editingId} /> : <SaveFirstMessage t={t} />}
              </TabsContent>
              <TabsContent value="documentos" className="p-6 m-0">
                {editingId ? <DocumentosPanel condominioId={editingId} /> : <SaveFirstMessage t={t} />}
              </TabsContent>
              <TabsContent value="seguro" className="p-6 m-0">
                {editingId ? <SeguroPanel condominioId={editingId} /> : <SaveFirstMessage t={t} />}
              </TabsContent>
            </div>
          </Tabs>

          <div className="flex-shrink-0 px-6 py-4 border-t flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("common.cancel")}</Button>
            {isGeralOrEquipe && (
              <Button onClick={handleSave} disabled={!form.nome.trim() || isSaving} data-testid="button-save-condo">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                {t("common.save")}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
