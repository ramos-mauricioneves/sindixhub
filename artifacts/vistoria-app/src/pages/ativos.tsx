import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useListCondominios, useListAssets, useListAreas, useCreateAsset,
  useUpdateAsset, useDeleteAsset, getListAssetsQueryKey, getListAreasQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Package, Plus, Pencil, Trash2, Filter, Loader2, AlertTriangle, CheckCircle2, Wrench, PackageX, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose
} from "@/components/ui/dialog";
import { useUser } from "@/components/layout";
import { useLocation } from "wouter";

const CRITICIDADE_COLORS: Record<string, string> = {
  alta: "bg-red-100 text-red-700 border-red-200",
  media: "bg-yellow-100 text-yellow-700 border-yellow-200",
  baixa: "bg-green-100 text-green-700 border-green-200",
};

const STATUS_COLORS: Record<string, string> = {
  operacional: "bg-green-100 text-green-700 border-green-200",
  em_manutencao: "bg-yellow-100 text-yellow-700 border-yellow-200",
  inativo: "bg-gray-100 text-gray-600 border-gray-200",
};

const STATUS_ICONS: Record<string, any> = {
  operacional: CheckCircle2,
  em_manutencao: Wrench,
  inativo: PackageX,
};

type AssetForm = {
  nome: string;
  tipo: string;
  criticidade: string;
  status: string;
  descricao: string;
  areaId: string;
};

const DEFAULT_FORM: AssetForm = {
  nome: "",
  tipo: "equipamento",
  criticidade: "media",
  status: "operacional",
  descricao: "",
  areaId: "",
};

export default function AtivosPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const user = useUser();
  const [, setLocation] = useLocation();

  const [condominioId, setCondominioId] = useState<string>("");
  const [tipoFilter, setTipoFilter] = useState<string>("all");
  const [criticidadeFilter, setCriticidadeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<AssetForm>(DEFAULT_FORM);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: condominios } = useListCondominios();
  const condominioIdNum = condominioId ? parseInt(condominioId, 10) : undefined;

  const queryParams = {
    ...(tipoFilter !== "all" ? { tipo: tipoFilter as any } : {}),
    ...(criticidadeFilter !== "all" ? { criticidade: criticidadeFilter as any } : {}),
    ...(statusFilter !== "all" ? { status: statusFilter as any } : {}),
  };

  const { data: assets, isPending, refetch } = useListAssets(
    condominioIdNum ?? 0,
    queryParams,
    { query: { enabled: !!condominioIdNum, queryKey: getListAssetsQueryKey(condominioIdNum ?? 0, queryParams) } }
  );

  const { data: areas } = useListAreas(
    condominioIdNum ?? 0,
    { query: { enabled: !!condominioIdNum, queryKey: getListAreasQueryKey(condominioIdNum ?? 0) } }
  );

  const createAsset = useCreateAsset();
  const updateAsset = useUpdateAsset();
  const deleteAsset = useDeleteAsset();

  const canEdit = user?.role === "admin" || user?.role === "sindico";

  const invalidate = () => {
    if (condominioIdNum) {
      queryClient.invalidateQueries({ queryKey: getListAssetsQueryKey(condominioIdNum, queryParams) });
      queryClient.invalidateQueries({ queryKey: ["listAssets"] });
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(DEFAULT_FORM);
    setShowDialog(true);
  };

  const openEdit = (asset: NonNullable<typeof assets>[0]) => {
    setEditingId(asset.id);
    setForm({
      nome: asset.nome,
      tipo: asset.tipo,
      criticidade: asset.criticidade,
      status: asset.status,
      descricao: asset.descricao ?? "",
      areaId: asset.areaId ? String(asset.areaId) : "",
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!condominioIdNum || !form.nome.trim()) return;

    const body = {
      nome: form.nome.trim(),
      tipo: form.tipo as any,
      criticidade: form.criticidade as any,
      status: form.status as any,
      descricao: form.descricao.trim() || undefined,
      areaId: form.areaId ? parseInt(form.areaId, 10) : undefined,
    };

    try {
      if (editingId) {
        await updateAsset.mutateAsync({ condominioId: condominioIdNum, assetId: editingId, data: body });
        toast({ title: t("ativos.updatedSuccess") });
      } else {
        await createAsset.mutateAsync({ condominioId: condominioIdNum, data: body });
        toast({ title: t("ativos.createdSuccess") });
      }
      setShowDialog(false);
      invalidate();
    } catch {
      toast({ title: t("ativos.errorSaving"), variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!condominioIdNum || deleteId === null) return;
    try {
      await deleteAsset.mutateAsync({ condominioId: condominioIdNum, assetId: deleteId });
      toast({ title: t("ativos.deletedSuccess") });
      setDeleteId(null);
      invalidate();
    } catch {
      toast({ title: t("ativos.errorDeleting"), variant: "destructive" });
    }
  };

  const isSaving = createAsset.isPending || updateAsset.isPending;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" />
            {t("ativos.title")}
          </h1>
          <p className="text-muted-foreground">{t("ativos.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {condominioIdNum && (
            <Button size="sm" variant="outline" onClick={() => setLocation("/app/ativos/etiquetas")}>
              <QrCode className="h-4 w-4 mr-1" />
              Etiquetas
            </Button>
          )}
          {canEdit && condominioIdNum && (
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" />
              {t("ativos.addAsset")}
            </Button>
          )}
        </div>
      </div>

      {/* Condomínio selector */}
      <Card className="p-3">
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">{t("ativos.selectCondominio")}</Label>
            <Select value={condominioId} onValueChange={setCondominioId}>
              <SelectTrigger>
                <SelectValue placeholder={t("novaVistoria.condominioPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {(condominios ?? []).map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {condominioIdNum && (
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={tipoFilter} onValueChange={setTipoFilter}>
                <SelectTrigger className="h-8 w-auto text-xs">
                  <SelectValue placeholder={t("ativos.tipo")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("ativos.allTipos")}</SelectItem>
                  <SelectItem value="equipamento">{t("ativos.tipoEquipamento")}</SelectItem>
                  <SelectItem value="estrutura">{t("ativos.tipoEstrutura")}</SelectItem>
                  <SelectItem value="sistema">{t("ativos.tipoSistema")}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={criticidadeFilter} onValueChange={setCriticidadeFilter}>
                <SelectTrigger className="h-8 w-auto text-xs">
                  <SelectValue placeholder={t("ativos.criticidade")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("ativos.allCriticidades")}</SelectItem>
                  <SelectItem value="alta">{t("ativos.criticidadeAlta")}</SelectItem>
                  <SelectItem value="media">{t("ativos.criticidadeMedia")}</SelectItem>
                  <SelectItem value="baixa">{t("ativos.criticidadeBaixa")}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 w-auto text-xs">
                  <SelectValue placeholder={t("ativos.status")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("ativos.allStatus")}</SelectItem>
                  <SelectItem value="operacional">{t("ativos.statusOperacional")}</SelectItem>
                  <SelectItem value="em_manutencao">{t("ativos.statusEmManutencao")}</SelectItem>
                  <SelectItem value="inativo">{t("ativos.statusInativo")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </Card>

      {/* Asset list */}
      {!condominioIdNum ? (
        <div className="text-center py-16">
          <Package className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">{t("ativos.selectCondominioFirst")}</p>
        </div>
      ) : isPending ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !assets || assets.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <Package className="h-12 w-12 text-muted-foreground/30 mx-auto" />
          <p className="text-muted-foreground">{t("ativos.noAssets")}</p>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" />
              {t("ativos.addFirst")}
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {assets.map((asset) => {
            const StatusIcon = STATUS_ICONS[asset.status] ?? Package;
            return (
              <Card key={asset.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${STATUS_COLORS[asset.status] ?? ""} flex-shrink-0`}>
                      <StatusIcon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-sm">{asset.nome}</p>
                          <p className="text-xs text-muted-foreground capitalize mt-0.5">
                            {asset.tipo}
                            {areas?.find(a => a.id === asset.areaId) ? ` · ${areas.find(a => a.id === asset.areaId)!.nome}` : ""}
                          </p>
                        </div>
                        {canEdit && (
                          <div className="flex gap-1 flex-shrink-0">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(asset)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(asset.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <Badge className={`text-xs border ${CRITICIDADE_COLORS[asset.criticidade] ?? ""}`} variant="outline">
                          {t(`ativos.criticidade${asset.criticidade.charAt(0).toUpperCase() + asset.criticidade.slice(1)}`)}
                        </Badge>
                        <Badge className={`text-xs border ${STATUS_COLORS[asset.status] ?? ""}`} variant="outline">
                          {t(`ativos.status${asset.status === "em_manutencao" ? "EmManutencao" : asset.status.charAt(0).toUpperCase() + asset.status.slice(1)}`)}
                        </Badge>
                      </div>
                      {asset.descricao && (
                        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{asset.descricao}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingId ? t("ativos.editAsset") : t("ativos.newAsset")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">{t("ativos.nome")} *</Label>
              <Input
                value={form.nome}
                onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                placeholder={t("ativos.nomePlaceholder")}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{t("ativos.tipo")} *</Label>
                <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="equipamento">{t("ativos.tipoEquipamento")}</SelectItem>
                    <SelectItem value="estrutura">{t("ativos.tipoEstrutura")}</SelectItem>
                    <SelectItem value="sistema">{t("ativos.tipoSistema")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">{t("ativos.criticidade")} *</Label>
                <Select value={form.criticidade} onValueChange={v => setForm(f => ({ ...f, criticidade: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alta">{t("ativos.criticidadeAlta")}</SelectItem>
                    <SelectItem value="media">{t("ativos.criticidadeMedia")}</SelectItem>
                    <SelectItem value="baixa">{t("ativos.criticidadeBaixa")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{t("ativos.status")} *</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="operacional">{t("ativos.statusOperacional")}</SelectItem>
                    <SelectItem value="em_manutencao">{t("ativos.statusEmManutencao")}</SelectItem>
                    <SelectItem value="inativo">{t("ativos.statusInativo")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">{t("ativos.area")}</Label>
                <Select value={form.areaId || "none"} onValueChange={v => setForm(f => ({ ...f, areaId: v === "none" ? "" : v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder={t("common.none")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("common.none")}</SelectItem>
                    {(areas ?? []).map(a => {
                      const label = [
                        a.bloco ? a.bloco : null,
                        a.andar != null ? t("condominios.andarDisplay", { andar: a.andar }) : null,
                        a.nome,
                      ].filter(Boolean).join(" · ");
                      return <SelectItem key={a.id} value={String(a.id)}>{label}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">{t("ativos.descricao")}</Label>
              <Textarea
                value={form.descricao}
                onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                placeholder={t("ativos.descricaoPlaceholder")}
                rows={2}
                className="mt-1 resize-none"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 mt-2">
            <DialogClose asChild>
              <Button variant="outline" size="sm">{t("common.cancel")}</Button>
            </DialogClose>
            <Button size="sm" onClick={handleSave} disabled={isSaving || !form.nome.trim()}>
              {isSaving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("ativos.deleteConfirm")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t("ativos.deleteWarning")}</p>
          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteId(null)}>{t("common.cancel")}</Button>
            <Button size="sm" variant="destructive" onClick={handleDelete} disabled={deleteAsset.isPending}>
              {deleteAsset.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
