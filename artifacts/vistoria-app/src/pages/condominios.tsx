import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Building2, Plus, Trash2, ChevronDown, ChevronUp, Loader2, AlertCircle, Pencil, X, Check } from "lucide-react";
import {
  useListCondominios, useCreateCondominio, useUpdateCondominio,
  useListAreas, useCreateArea, useDeleteArea,
  Condominio, Area,
  getListCondominiosQueryKey, getListAreasQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

type CondominioForm = { nome: string; endereco: string; cidade: string; estado: string; ativo: boolean };
const emptyForm = (): CondominioForm => ({ nome: "", endereco: "", cidade: "", estado: "", ativo: true });

function AreasPanel({ condominioId }: { condominioId: number }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [newNome, setNewNome] = useState("");
  const [newTipo, setNewTipo] = useState<"comum" | "predial">("comum");

  const { data: areas, isPending } = useListAreas(condominioId, {
    query: { queryKey: getListAreasQueryKey(condominioId) }
  });
  const createArea = useCreateArea();
  const deleteArea = useDeleteArea();

  const handleAdd = () => {
    if (!newNome.trim()) return;
    createArea.mutate({ condominioId, data: { nome: newNome.trim(), tipo: newTipo } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListAreasQueryKey(condominioId) });
        toast({ title: t("condominios.areaAdded") });
        setNewNome("");
      },
      onError: () => toast({ title: t("condominios.errorAddingArea"), variant: "destructive" }),
    });
  };

  const handleDelete = (areaId: number) => {
    deleteArea.mutate({ condominioId, areaId }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListAreasQueryKey(condominioId) });
        toast({ title: t("condominios.areaDeleted") });
      },
    });
  };

  return (
    <div className="border-t pt-4 space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("condominios.areas")}</p>
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : areas?.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("condominios.noAreas")}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {areas?.map((area: Area) => (
            <Badge key={area.id} variant="secondary" className="flex items-center gap-1 text-xs py-1 px-2">
              <span className={area.tipo === "predial" ? "text-orange-600" : "text-blue-600"}>
                {area.tipo === "predial" ? t("condominios.tipoPredial") : t("condominios.tipoComum")}
              </span>
              <span>•</span>
              <span>{area.nome}</span>
              <button onClick={() => handleDelete(area.id)} className="ml-1 text-muted-foreground hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <Input
          value={newNome}
          onChange={(e) => setNewNome(e.target.value)}
          placeholder={t("condominios.areaNamePlaceholder")}
          className="h-8 text-sm flex-1"
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <Select value={newTipo} onValueChange={(v) => setNewTipo(v as "comum" | "predial")}>
          <SelectTrigger className="h-8 text-sm w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="comum">{t("condominios.tipoComum")}</SelectItem>
            <SelectItem value="predial">{t("condominios.tipoPredial")}</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" className="h-8" onClick={handleAdd} disabled={!newNome.trim() || createArea.isPending}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function CondominioCard({ condo, onEdit }: { condo: Condominio; onEdit: (c: Condominio) => void }) {
  const { t } = useTranslation();
  const [showAreas, setShowAreas] = useState(false);

  return (
    <Card className="hover:border-primary/30 transition-colors">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="h-4 w-4 text-primary shrink-0" />
              <h3 className="font-semibold text-base truncate">{condo.nome}</h3>
              {!condo.ativo && <Badge variant="secondary" className="text-xs">Inativo</Badge>}
            </div>
            {(condo.cidade || condo.estado || condo.endereco) && (
              <p className="text-sm text-muted-foreground truncate">
                {[condo.endereco, condo.cidade, condo.estado].filter(Boolean).join(", ")}
              </p>
            )}
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
        {showAreas && <AreasPanel condominioId={condo.id} />}
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
    setForm({ nome: c.nome, endereco: c.endereco ?? "", cidade: c.cidade ?? "", estado: c.estado ?? "", ativo: c.ativo });
    setEditingId(c.id);
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.nome.trim()) return;
    const payload = { nome: form.nome.trim(), endereco: form.endereco || undefined, cidade: form.cidade || undefined, estado: form.estado || undefined, ativo: form.ativo };
    if (editingId) {
      updateCondominio.mutate({ id: editingId, data: payload }, {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListCondominiosQueryKey() });
          toast({ title: t("condominios.savedSuccess") });
          setDialogOpen(false);
        },
        onError: () => toast({ title: t("condominios.errorSaving"), variant: "destructive" }),
      });
    } else {
      createCondominio.mutate({ data: payload }, {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListCondominiosQueryKey() });
          toast({ title: t("condominios.savedSuccess") });
          setDialogOpen(false);
        },
        onError: () => toast({ title: t("condominios.errorSaving"), variant: "destructive" }),
      });
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? t("condominios.editCondominio") : t("condominios.newCondominio")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("condominios.nome")} *</Label>
              <Input value={form.nome} onChange={(e) => setForm(f => ({ ...f, nome: e.target.value }))} placeholder={t("condominios.nomePlaceholder")} data-testid="input-condo-nome" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("condominios.cidade")}</Label>
                <Input value={form.cidade} onChange={(e) => setForm(f => ({ ...f, cidade: e.target.value }))} placeholder={t("condominios.cidadePlaceholder")} />
              </div>
              <div className="space-y-2">
                <Label>{t("condominios.estado")}</Label>
                <Input value={form.estado} onChange={(e) => setForm(f => ({ ...f, estado: e.target.value }))} placeholder={t("condominios.estadoPlaceholder")} maxLength={2} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("condominios.endereco")}</Label>
              <Input value={form.endereco} onChange={(e) => setForm(f => ({ ...f, endereco: e.target.value }))} placeholder={t("condominios.enderecoPlaceholder")} />
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
