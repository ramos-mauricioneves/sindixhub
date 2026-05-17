import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Building2, Plus, Trash2, ChevronDown, ChevronUp, Loader2, AlertCircle,
  Pencil, X, Check, MapPin, Users, Clock, Hash, Phone, Mail, Shield, Wrench
} from "lucide-react";
import {
  useListCondominios, useCreateCondominio, useUpdateCondominio,
  useListAreas, useCreateArea, useUpdateArea, useDeleteArea,
  Condominio, Area, AreaBodyPrivacidade, AreaPrivacidade,
  getListCondominiosQueryKey, getListAreasQueryKey,
} from "@workspace/api-client-react";
import { AREA_CATEGORIES, AreaTemplate, KNOWN_AREA_TIPOS } from "@/lib/area-templates";
import { useQueryClient } from "@tanstack/react-query";
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

const AREA_TIPOS = ["comum", "lazer", "esportiva", "social", "servico", "estacionamento", "infantil", "predial", "administrativa", "manutencao", "circulacao"] as const;

const AREA_TIPO_COLORS: Record<string, string> = {
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

type CondominioForm = {
  nome: string; cnpj: string; tipoCondominio: string;
  endereco: string; cep: string; bairro: string; cidade: string; estado: string;
  totalUnidades: string; totalBlocos: string; totalAndares: string; anoConstrucao: string;
  telefone: string; email: string; sindico: string; zelador: string; administradora: string;
  ativo: boolean;
};

const emptyForm = (): CondominioForm => ({
  nome: "", cnpj: "", tipoCondominio: "residencial",
  endereco: "", cep: "", bairro: "", cidade: "", estado: "",
  totalUnidades: "", totalBlocos: "", totalAndares: "", anoConstrucao: "",
  telefone: "", email: "", sindico: "", zelador: "", administradora: "",
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
  descricao: "", capacidade: "", reservavel: false,
  horarioAbertura: "", horarioFechamento: "",
});

type PendingArea = {
  id: string; nome: string; tipo: string;
  privacidade: "publica" | "privada" | "mista";
  bloco: string; andar: string;
};

function AreaTipoBadge({ tipo, t }: { tipo: string; t: (k: string) => string }) {
  const colors = AREA_TIPO_COLORS[tipo] || "text-gray-600 bg-gray-50";
  const labelMap: Record<string, string> = {
    comum: t("condominios.tipoComum"),
    lazer: t("condominios.tipoLazer"),
    esportiva: t("condominios.tipoEsportiva"),
    social: t("condominios.tipoSocial"),
    servico: t("condominios.tipoServico"),
    estacionamento: t("condominios.tipoEstacionamento"),
    infantil: t("condominios.tipoInfantil"),
    predial: t("condominios.tipoPredial"),
    administrativa: t("condominios.tipoAdministrativa"),
    manutencao: t("condominios.tipoManutencao"),
    circulacao: t("condominios.tipoCirculacao"),
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors}`}>
      {labelMap[tipo] || tipo}
    </span>
  );
}

function PrivacidadeBadge({ privacidade, t }: { privacidade: string; t: (k: string) => string }) {
  if (privacidade === "publica") return null;
  const colors = PRIVACIDADE_COLORS[privacidade] || "text-gray-600 bg-gray-50";
  const labelMap: Record<string, string> = {
    privada: t("condominios.privacidadePrivada"),
    mista: t("condominios.privacidadeMista"),
  };
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${colors}`}>
      {labelMap[privacidade] || privacidade}
    </span>
  );
}

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
  const categoryLabel = (key: string) =>
    t(`condominios.catalog${key.charAt(0).toUpperCase() + key.slice(1)}`);

  const toggleTemplate = (template: AreaTemplate) => {
    const uid = `${template.tipo}__${template.nome}`;
    const exists = pending.some(p => p.id === uid);
    if (exists) {
      setPending(p => p.filter(x => x.id !== uid));
    } else {
      setPending(p => [...p, {
        id: uid, nome: template.nome, tipo: template.tipo,
        privacidade: template.privacidade, bloco: "", andar: "",
      }]);
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
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                activeCategory === cat.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/60"
              }`}
            >
              {categoryLabel(cat.key)}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 overflow-y-auto max-h-44">
          {currentCategory.templates.map(template => {
            const uid = `${template.tipo}__${template.nome}`;
            const isSelected = pending.some(p => p.id === uid);
            return (
              <button
                key={template.nome}
                onClick={() => toggleTemplate(template)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-left text-sm transition-colors ${
                  isSelected
                    ? "border-primary bg-primary/10 text-primary font-medium"
                    : "border-border bg-background hover:bg-muted"
                }`}
              >
                {isSelected
                  ? <Check className="h-3.5 w-3.5 shrink-0" />
                  : <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                <span className="truncate">{template.nome}</span>
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
                <input
                  className="flex-1 min-w-0 text-sm px-2 py-1.5 rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  value={area.nome}
                  aria-label={t("condominios.catalogNameLabel")}
                  onChange={(e) => setPending(p => p.map((x, i) => i === idx ? { ...x, nome: e.target.value } : x))}
                />
                <input
                  className="w-24 text-xs px-2 py-1.5 rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder={t("condominios.catalogBlocoLabel")}
                  value={area.bloco}
                  onChange={(e) => setPending(p => p.map((x, i) => i === idx ? { ...x, bloco: e.target.value } : x))}
                />
                <input
                  className="w-14 text-xs px-2 py-1.5 rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  type="number"
                  placeholder={t("condominios.catalogAndarLabel")}
                  value={area.andar}
                  onChange={(e) => setPending(p => p.map((x, i) => i === idx ? { ...x, andar: e.target.value } : x))}
                />
                <button onClick={() => setPending(p => p.filter((_, i) => i !== idx))} className="text-muted-foreground hover:text-destructive shrink-0">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <DialogFooter className="gap-2 border-t pt-2">
          <Button variant="ghost" size="sm" className="mr-auto text-muted-foreground text-xs" onClick={() => { handleClose(); setTimeout(onOpenCustomArea, 50); }}>
            <Plus className="h-3 w-3 mr-1" />
            {t("condominios.catalogCustomArea")}
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

function AreasPanel({ condominioId }: { condominioId: number }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [areaForm, setAreaForm] = useState<AreaForm>(emptyAreaForm());
  const [editingAreaId, setEditingAreaId] = useState<number | null>(null);
  const [areaDialogOpen, setAreaDialogOpen] = useState(false);
  const [catalogDialogOpen, setCatalogDialogOpen] = useState(false);

  const { data: areas, isPending } = useListAreas(condominioId, {
    query: { queryKey: getListAreasQueryKey(condominioId) }
  });
  const createArea = useCreateArea();
  const updateArea = useUpdateArea();
  const deleteArea = useDeleteArea();

  const openNewArea = () => {
    setAreaForm(emptyAreaForm());
    setEditingAreaId(null);
    setAreaDialogOpen(true);
  };

  const openEditArea = (area: Area) => {
    const isKnown = KNOWN_AREA_TIPOS.has(area.tipo);
    setAreaForm({
      nome: area.nome,
      tipo: isKnown ? area.tipo : "__custom__",
      tipoCustom: isKnown ? "" : area.tipo,
      bloco: area.bloco || "",
      andar: area.andar != null ? String(area.andar) : "",
      privacidade: (area.privacidade as AreaBodyPrivacidade) || "publica",
      descricao: area.descricao || "",
      capacidade: area.capacidade?.toString() || "",
      reservavel: area.reservavel,
      horarioAbertura: area.horarioAbertura || "",
      horarioFechamento: area.horarioFechamento || "",
    });
    setEditingAreaId(area.id);
    setAreaDialogOpen(true);
  };

  const handleSaveArea = () => {
    if (!areaForm.nome.trim()) return;
    const effectiveTipo = areaForm.tipo === "__custom__" ? areaForm.tipoCustom.trim() : areaForm.tipo;
    if (!effectiveTipo) return;
    const payload = {
      nome: areaForm.nome.trim(),
      tipo: effectiveTipo,
      bloco: areaForm.bloco.trim() || undefined,
      andar: areaForm.andar !== "" ? parseInt(areaForm.andar) : undefined,
      privacidade: areaForm.privacidade,
      descricao: areaForm.descricao || undefined,
      capacidade: areaForm.capacidade ? parseInt(areaForm.capacidade) : undefined,
      reservavel: areaForm.reservavel,
      horarioAbertura: areaForm.horarioAbertura || undefined,
      horarioFechamento: areaForm.horarioFechamento || undefined,
    };

    const onSuccess = () => {
      qc.invalidateQueries({ queryKey: getListAreasQueryKey(condominioId) });
      toast({ title: editingAreaId ? t("condominios.areaUpdated") : t("condominios.areaAdded") });
      setAreaDialogOpen(false);
    };
    const onError = () => toast({ title: t("condominios.errorAddingArea"), variant: "destructive" });

    if (editingAreaId) {
      updateArea.mutate({ condominioId, areaId: editingAreaId, data: payload }, { onSuccess, onError });
    } else {
      createArea.mutate({ condominioId, data: payload }, { onSuccess, onError });
    }
  };

  const handleDelete = (areaId: number) => {
    deleteArea.mutate({ condominioId, areaId }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListAreasQueryKey(condominioId) });
        toast({ title: t("condominios.areaDeleted") });
      },
    });
  };

  const groupedByBlocoAndTipo = (areas || []).reduce<Record<string, Record<string, Area[]>>>((acc, area) => {
    const bloco = area.bloco || "__sem_bloco__";
    const tipo = area.tipo;
    if (!acc[bloco]) acc[bloco] = {};
    if (!acc[bloco][tipo]) acc[bloco][tipo] = [];
    acc[bloco][tipo].push(area);
    return acc;
  }, {});

  const blocoKeys = Object.keys(groupedByBlocoAndTipo).sort((a, b) => {
    if (a === "__sem_bloco__") return 1;
    if (b === "__sem_bloco__") return -1;
    return a.localeCompare(b);
  });

  const knownTipoOrder = AREA_TIPOS as readonly string[];
  const customTipos = (areas || [])
    .map(a => a.tipo)
    .filter(t => !KNOWN_AREA_TIPOS.has(t));
  const tipoOrder = [...knownTipoOrder, ...new Set(customTipos)];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{t("condominios.areas")}</p>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="outline" onClick={() => setCatalogDialogOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            {t("condominios.catalogTitle")}
          </Button>
          <Button size="sm" variant="ghost" className="text-muted-foreground text-xs px-2" onClick={openNewArea}>
            {t("condominios.catalogCustomArea")}
          </Button>
        </div>
      </div>

      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : !areas || areas.length === 0 ? (
        <div className="text-center py-8 border border-dashed rounded-lg">
          <MapPin className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-30" />
          <p className="text-sm text-muted-foreground">{t("condominios.noAreas")}</p>
          <div className="flex justify-center gap-2 mt-3">
            <Button size="sm" variant="outline" onClick={() => setCatalogDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              {t("condominios.catalogTitle")}
            </Button>
            <Button size="sm" variant="ghost" className="text-muted-foreground text-xs" onClick={openNewArea}>
              {t("condominios.catalogCustomArea")}
            </Button>
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
                {blocoKey !== "__sem_bloco__" ? (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary uppercase tracking-wide">
                    {blocoKey}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground font-medium">{t("condominios.semBloco")}</span>
                )}
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
                      {tipoMap[tipo].map((area) => (
                  <div key={area.id} className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2 border ml-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{area.nome}</span>
                        <PrivacidadeBadge privacidade={area.privacidade as AreaPrivacidade} t={t} />
                        {area.andar != null && (
                          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {t("condominios.andarDisplay", { andar: area.andar })}
                          </span>
                        )}
                        {area.reservavel && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {t("condominios.areaReservavel")}
                          </Badge>
                        )}
                        {!area.ativo && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Inativo</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                        {area.capacidade && (
                          <span className="flex items-center gap-0.5">
                            <Users className="h-3 w-3" />
                            {area.capacidade} {t("condominios.pessoas")}
                          </span>
                        )}
                        {area.horarioAbertura && area.horarioFechamento && (
                          <span className="flex items-center gap-0.5">
                            <Clock className="h-3 w-3" />
                            {area.horarioAbertura}–{area.horarioFechamento}
                          </span>
                        )}
                        {area.descricao && (
                          <span className="truncate max-w-[200px]">{area.descricao}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => openEditArea(area)} className="p-1 text-muted-foreground hover:text-foreground">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => handleDelete(area.id)} className="p-1 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
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
          <DialogHeader>
            <DialogTitle>
              {editingAreaId ? t("condominios.editAreaDialog") : t("condominios.addAreaDialog")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("condominios.areaName")} *</Label>
                <Input
                  value={areaForm.nome}
                  onChange={(e) => setAreaForm(f => ({ ...f, nome: e.target.value }))}
                  placeholder={t("condominios.areaNamePlaceholder")}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("condominios.areaType")} *</Label>
                <Select value={areaForm.tipo} onValueChange={(v) => setAreaForm(f => ({ ...f, tipo: v, tipoCustom: "" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AREA_TIPOS.map(tipo => (
                      <SelectItem key={tipo} value={tipo}>
                        {t(`condominios.tipo${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`)}
                      </SelectItem>
                    ))}
                    <SelectItem value="__custom__">{t("condominios.tipoCustom")}</SelectItem>
                  </SelectContent>
                </Select>
                {areaForm.tipo === "__custom__" && (
                  <Input
                    className="mt-1"
                    value={areaForm.tipoCustom}
                    onChange={(e) => setAreaForm(f => ({ ...f, tipoCustom: e.target.value }))}
                    placeholder={t("condominios.tipoCustomPlaceholder")}
                  />
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2 col-span-2">
                <Label>{t("condominios.areaBloco")}</Label>
                <Input
                  value={areaForm.bloco}
                  onChange={(e) => setAreaForm(f => ({ ...f, bloco: e.target.value }))}
                  placeholder={t("condominios.areaBlocoPlaceholder")}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("condominios.areaAndar")}</Label>
                <Input
                  type="number"
                  value={areaForm.andar}
                  onChange={(e) => setAreaForm(f => ({ ...f, andar: e.target.value }))}
                  placeholder={t("condominios.areaAndarPlaceholder")}
                />
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
              <Textarea
                value={areaForm.descricao}
                onChange={(e) => setAreaForm(f => ({ ...f, descricao: e.target.value }))}
                placeholder={t("condominios.areaDescricaoPlaceholder")}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>{t("condominios.areaCapacidade")}</Label>
                <Input
                  type="number" min="0"
                  value={areaForm.capacidade}
                  onChange={(e) => setAreaForm(f => ({ ...f, capacidade: e.target.value }))}
                  placeholder="50"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("condominios.areaHorarioAbertura")}</Label>
                <Input
                  type="time"
                  value={areaForm.horarioAbertura}
                  onChange={(e) => setAreaForm(f => ({ ...f, horarioAbertura: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("condominios.areaHorarioFechamento")}</Label>
                <Input
                  type="time"
                  value={areaForm.horarioFechamento}
                  onChange={(e) => setAreaForm(f => ({ ...f, horarioFechamento: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={areaForm.reservavel}
                onCheckedChange={(v) => setAreaForm(f => ({ ...f, reservavel: v }))}
                id="area-reservavel"
              />
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

      <CatalogDialog
        condominioId={condominioId}
        open={catalogDialogOpen}
        onOpenChange={setCatalogDialogOpen}
        onDone={() => qc.invalidateQueries({ queryKey: getListAreasQueryKey(condominioId) })}
        onOpenCustomArea={openNewArea}
      />
    </div>
  );
}

function CondominioCard({ condo, onEdit }: { condo: Condominio; onEdit: (c: Condominio) => void }) {
  const { t } = useTranslation();
  const [showAreas, setShowAreas] = useState(false);

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
              <Badge variant="outline" className="text-xs shrink-0">
                {tipoLabel[condo.tipoCondominio] || condo.tipoCondominio}
              </Badge>
              {!condo.ativo && <Badge variant="secondary" className="text-xs">Inativo</Badge>}
            </div>
            {(condo.cidade || condo.estado || condo.endereco || condo.bairro) && (
              <p className="text-sm text-muted-foreground truncate flex items-center gap-1">
                <MapPin className="h-3 w-3 shrink-0" />
                {[condo.endereco, condo.bairro, condo.cidade, condo.estado].filter(Boolean).join(", ")}
              </p>
            )}
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              {condo.totalUnidades && (
                <span className="flex items-center gap-1">
                  <Hash className="h-3 w-3" />
                  {condo.totalUnidades} {t("condominios.unidades")}
                </span>
              )}
              {condo.totalBlocos && (
                <span>{condo.totalBlocos} {t("condominios.totalBlocos").toLowerCase()}</span>
              )}
              {condo.totalAndares && (
                <span>{condo.totalAndares} {t("condominios.totalAndares").toLowerCase()}</span>
              )}
              {condo.sindico && (
                <span className="flex items-center gap-1">
                  <Shield className="h-3 w-3" />
                  {condo.sindico}
                </span>
              )}
              {condo.cnpj && <span className="font-mono">{condo.cnpj}</span>}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(condo)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setShowAreas(!showAreas)}>
              {showAreas ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        {showAreas && (
          <div className="mt-4 border-t pt-4">
            <AreasPanel condominioId={condo.id} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function CondominiosPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<CondominioForm>(emptyForm());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: condominios, isPending, isError } = useListCondominios({
    query: { queryKey: getListCondominiosQueryKey() }
  });
  const createCondominio = useCreateCondominio();
  const updateCondominio = useUpdateCondominio();

  const openNew = () => {
    setForm(emptyForm());
    setEditingId(null);
    setDialogOpen(true);
  };

  const openEdit = (c: Condominio) => {
    setForm({
      nome: c.nome,
      cnpj: c.cnpj ?? "",
      tipoCondominio: c.tipoCondominio ?? "residencial",
      endereco: c.endereco ?? "",
      cep: c.cep ?? "",
      bairro: c.bairro ?? "",
      cidade: c.cidade ?? "",
      estado: c.estado ?? "",
      totalUnidades: c.totalUnidades?.toString() ?? "",
      totalBlocos: c.totalBlocos?.toString() ?? "",
      totalAndares: c.totalAndares?.toString() ?? "",
      anoConstrucao: c.anoConstrucao?.toString() ?? "",
      telefone: c.telefone ?? "",
      email: c.email ?? "",
      sindico: c.sindico ?? "",
      zelador: c.zelador ?? "",
      administradora: c.administradora ?? "",
      ativo: c.ativo,
    });
    setEditingId(c.id);
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.nome.trim()) return;
    const payload: Record<string, unknown> = {
      nome: form.nome.trim(),
      cnpj: form.cnpj || undefined,
      tipoCondominio: form.tipoCondominio,
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
      ativo: form.ativo,
    };
    const onSuccess = () => {
      qc.invalidateQueries({ queryKey: getListCondominiosQueryKey() });
      toast({ title: t("condominios.savedSuccess") });
      setDialogOpen(false);
    };
    const onError = () => toast({ title: t("condominios.errorSaving"), variant: "destructive" });

    if (editingId) {
      updateCondominio.mutate({ id: editingId, data: payload as any }, { onSuccess, onError });
    } else {
      createCondominio.mutate({ data: payload as any }, { onSuccess, onError });
    }
  };

  const isSaving = createCondominio.isPending || updateCondominio.isPending;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("condominios.title")}</h1>
          <p className="text-muted-foreground">{t("condominios.subtitle")}</p>
        </div>
        <Button onClick={openNew} className="shrink-0" data-testid="button-new-condominio">
          <Plus className="h-4 w-4 mr-2" />
          {t("condominios.newCondominio")}
        </Button>
      </div>

      {isPending ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
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
          {condominios.map((c) => (
            <CondominioCard key={c.id} condo={c} onEdit={openEdit} />
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? t("condominios.editCondominio") : t("condominios.newCondominio")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
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
            </div>

            <div>
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                {t("condominios.sectionEndereco")}
              </p>
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
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                {t("condominios.sectionEstrutura")}
              </p>
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
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" />
                {t("condominios.sectionContatos")}
              </p>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleSave} disabled={!form.nome.trim() || isSaving} data-testid="button-save-condo">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
