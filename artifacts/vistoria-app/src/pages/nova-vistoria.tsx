import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Mic, Square, Camera, X, Check, Loader2, Save, AlertCircle, Building2,
  Stethoscope, Wrench, Zap, TrendingUp, ClipboardCheck, HardHat, Calendar,
  CalendarDays, Key, Siren, MapPin, Users, Clock, WifiOff
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  useGenerateReport, useSaveInspection,
  useListCondominios, useListAreas, useListAssets,
  getListInspectionsQueryKey, getListCondominiosQueryKey, getListAreasQueryKey, getListAssetsQueryKey,
  InspectionReport, Area
} from "@workspace/api-client-react";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { saveOfflineInspection } from "@/lib/offline-db";
import { v4 as uuidv4 } from "uuid";

const TIPO_EVENTO_OPTIONS = [
  { value: "vistoria", icon: Stethoscope, labelKey: "novaVistoria_tipoEvento.vistoria", color: "text-blue-600 border-blue-300 bg-blue-50" },
  { value: "manutencao", icon: Wrench, labelKey: "novaVistoria_tipoEvento.manutencao", color: "text-orange-600 border-orange-300 bg-orange-50" },
  { value: "incidente", icon: Zap, labelKey: "novaVistoria_tipoEvento.incidente", color: "text-red-600 border-red-300 bg-red-50" },
  { value: "melhoria", icon: TrendingUp, labelKey: "novaVistoria_tipoEvento.melhoria", color: "text-purple-600 border-purple-300 bg-purple-50" },
];

const TIPO_VISTORIA_OPTIONS = [
  { value: "tecnica", icon: Stethoscope, labelKey: "novaVistoria_tipoVistoria.tecnica", color: "text-blue-700 border-blue-200 bg-blue-50" },
  { value: "predial", icon: HardHat, labelKey: "novaVistoria_tipoVistoria.predial", color: "text-amber-700 border-amber-200 bg-amber-50" },
  { value: "checklist", icon: ClipboardCheck, labelKey: "novaVistoria_tipoVistoria.checklist", color: "text-green-700 border-green-200 bg-green-50" },
  { value: "acompanhamento_diario", icon: Calendar, labelKey: "novaVistoria_tipoVistoria.acompanhamento_diario", color: "text-cyan-700 border-cyan-200 bg-cyan-50" },
  { value: "acompanhamento_semanal", icon: CalendarDays, labelKey: "novaVistoria_tipoVistoria.acompanhamento_semanal", color: "text-indigo-700 border-indigo-200 bg-indigo-50" },
  { value: "entrega_chaves", icon: Key, labelKey: "novaVistoria_tipoVistoria.entrega_chaves", color: "text-emerald-700 border-emerald-200 bg-emerald-50" },
  { value: "emergencial", icon: Siren, labelKey: "novaVistoria_tipoVistoria.emergencial", color: "text-red-700 border-red-200 bg-red-50" },
];

const AREA_TIPO_COLORS: Record<string, string> = {
  comum: "bg-blue-50 text-blue-700",
  lazer: "bg-green-50 text-green-700",
  esportiva: "bg-orange-50 text-orange-700",
  social: "bg-purple-50 text-purple-700",
  servico: "bg-gray-50 text-gray-700",
  estacionamento: "bg-yellow-50 text-yellow-800",
  infantil: "bg-pink-50 text-pink-700",
  predial: "bg-red-50 text-red-700",
  administrativa: "bg-indigo-50 text-indigo-700",
  manutencao: "bg-amber-50 text-amber-800",
  circulacao: "bg-sky-50 text-sky-700",
  outros: "bg-gray-100 text-gray-700",
};

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function AreaTypeName({ tipo, t }: { tipo: string; t: (k: string) => string }) {
  const labels: Record<string, string> = {
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
    outros: t("condominios.tipoOutros"),
  };
  return <>{labels[tipo] ?? t("condominios.tipoOutros")}</>;
}

export default function NovaVistoriaPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();

  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const [images, setImages] = useState<File[]>([]);
  const [local, setLocal] = useState("");
  const [notes, setNotes] = useState("");
  const NONE_VALUE = "__none__";
  const [condominioId, setCondominioId] = useState<string>("");
  const [areaId, setAreaId] = useState<string>("");
  const [assetId, setAssetId] = useState<string>("");
  const [tipoEvento, setTipoEvento] = useState<string>("vistoria");
  const [tipoVistoria, setTipoVistoria] = useState<string>("tecnica");
  const [escopo, setEscopo] = useState<string>("completa");
  const [selectedAreaIds, setSelectedAreaIds] = useState<Set<number>>(new Set());

  const { data: condominios } = useListCondominios({
    query: { queryKey: getListCondominiosQueryKey() }
  });

  const selectedCondominioIdNum = condominioId ? parseInt(condominioId, 10) : undefined;
  const { data: areas } = useListAreas(selectedCondominioIdNum!, {
    query: { enabled: !!selectedCondominioIdNum, queryKey: getListAreasQueryKey(selectedCondominioIdNum!) }
  });
  const { data: assets } = useListAssets(selectedCondominioIdNum ?? 0, {}, {
    query: { enabled: !!selectedCondominioIdNum, queryKey: getListAssetsQueryKey(selectedCondominioIdNum ?? 0, {}) }
  });

  const generateReport = useGenerateReport();
  const saveInspection = useSaveInspection();

  const [report, setReport] = useState<InspectionReport | null>(null);
  const [editedComunicado, setEditedComunicado] = useState("");
  const [loadingMessage, setLoadingMessage] = useState("");
  const [isSavingOffline, setIsSavingOffline] = useState(false);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    if (!generateReport.isPending) return;
    setLoadingMessage(t("novaVistoria.transcribing"));
    const t1 = setTimeout(() => setLoadingMessage(t("novaVistoria.analyzingImages")), 10000);
    const t2 = setTimeout(() => setLoadingMessage(t("novaVistoria.generatingReport")), 20000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [generateReport.isPending, t]);

  useEffect(() => {
    setAreaId(""); setAssetId(""); setSelectedAreaIds(new Set()); setEscopo("completa");
  }, [condominioId]);

  const toggleAreaSelection = (id: number) => {
    setSelectedAreaIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const KNOWN_TIPOS_SET = new Set(["comum", "lazer", "esportiva", "social", "servico", "estacionamento", "infantil", "predial", "administrativa", "manutencao", "circulacao"]);
  const groupedAreas = (areas || []).reduce<Record<string, Area[]>>((acc, area) => {
    if (!area.ativo) return acc;
    const tipo = KNOWN_TIPOS_SET.has(area.tipo) ? area.tipo : "outros";
    if (!acc[tipo]) acc[tipo] = [];
    acc[tipo].push(area);
    return acc;
  }, {});

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        stream.getTracks().forEach(tr => tr.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingSeconds(0);
      setAudioBlob(null);
      setReport(null);
      timerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000);
    } catch {
      toast({ title: t("novaVistoria.errorMicTitle"), description: t("novaVistoria.errorMicDesc"), variant: "destructive" });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleImageCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setImages(prev => [...prev, ...Array.from(e.target.files!)]);
  };

  const removeImage = (index: number) => setImages(prev => prev.filter((_, i) => i !== index));

  const handleSaveOffline = async () => {
    if (!audioBlob) {
      toast({ title: t("novaVistoria.audioRequired"), description: t("novaVistoria.audioRequiredDesc"), variant: "destructive" });
      return;
    }
    setIsSavingOffline(true);
    try {
      const condominioName = condominioId
        ? condominios?.find(c => c.id === parseInt(condominioId, 10))?.nome
        : undefined;

      await saveOfflineInspection({
        id: uuidv4(),
        createdAt: Date.now(),
        status: "pending",
        condominioId: condominioId ? parseInt(condominioId, 10) : undefined,
        condominioName,
        areaId: areaId ? parseInt(areaId, 10) : undefined,
        assetId: assetId ? parseInt(assetId, 10) : undefined,
        local: local || undefined,
        notes: notes || undefined,
        tipoEvento,
        audioBlob,
        imageBlobs: images.map(f => f as Blob),
        imageNames: images.map(f => f.name),
      });

      toast({
        title: t("offline.savedOffline"),
        description: t("offline.savedOfflineDesc"),
      });
      setLocation("/app/fila-offline");
    } catch {
      toast({ title: t("novaVistoria.errorSaving"), description: t("novaVistoria.errorSavingDesc"), variant: "destructive" });
    } finally {
      setIsSavingOffline(false);
    }
  };

  const handleSubmit = () => {
    if (!audioBlob) {
      toast({ title: t("novaVistoria.audioRequired"), description: t("novaVistoria.audioRequiredDesc"), variant: "destructive" });
      return;
    }

    if (!isOnline) {
      handleSaveOffline();
      return;
    }

    generateReport.mutate({ data: { audio: audioBlob, images: images.length > 0 ? images : undefined, notes: notes || undefined } }, {
      onSuccess: (data) => {
        setReport(data);
        setEditedComunicado(data.comunicado);
        toast({ title: t("novaVistoria.reportGenerated"), description: t("novaVistoria.reviewBeforeSave") });
      },
      onError: () => toast({ title: t("novaVistoria.errorGenerating"), description: t("novaVistoria.errorGeneratingDesc"), variant: "destructive" }),
    });
  };

  const handleSave = () => {
    if (!report) return;

    const isVistoria = tipoEvento === "vistoria";
    const selectedAreasArray = Array.from(selectedAreaIds);

    if (isVistoria && escopo === "areas_especificas" && selectedAreasArray.length === 0) {
      toast({ title: t("novaVistoria_escopo.selectAreas"), variant: "destructive" });
      return;
    }

    const condominioName = condominioId ? condominios?.find(c => c.id === parseInt(condominioId, 10))?.nome : undefined;
    const primaryAreaId = escopo === "areas_especificas" && selectedAreasArray.length > 0
      ? selectedAreasArray[0]
      : (areaId ? parseInt(areaId, 10) : undefined);

    saveInspection.mutate({
      data: {
        tipo: report.tipo,
        urgencia: report.urgencia,
        acao: report.acao,
        resumo: report.resumo,
        comunicado: editedComunicado,
        transcricao: report.transcricao,
        analise_imagens: report.analise_imagens,
        local: local || undefined,
        condominio: condominioName,
        condominioId: condominioId ? parseInt(condominioId, 10) : undefined,
        areaId: primaryAreaId,
        assetId: assetId ? parseInt(assetId, 10) : undefined,
        tipoEvento: tipoEvento as any,
        tipoVistoria: isVistoria ? tipoVistoria as any : undefined,
        escopo: isVistoria ? escopo as any : undefined,
        areasIds: isVistoria && selectedAreasArray.length > 0 ? selectedAreasArray.join(",") : undefined,
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListInspectionsQueryKey() });
        toast({ title: t("novaVistoria.savedSuccess"), description: t("novaVistoria.savedSuccessDesc") });
        setLocation("/app/historico");
      },
      onError: () => toast({ title: t("novaVistoria.errorSaving"), description: t("novaVistoria.errorSavingDesc"), variant: "destructive" }),
    });
  };

  const getUrgenciaColor = (u: string) => {
    if (u === "alta") return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    if (u === "média" || u === "media") return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
    return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
  };

  const showTipoVistoria = tipoEvento === "vistoria";

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("novaVistoria.title")}</h1>
        <p className="text-muted-foreground">{t("novaVistoria.subtitle")}</p>
      </div>

      {!isOnline && (
        <div className="flex items-center gap-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-amber-800 text-sm">
          <WifiOff className="h-4 w-4 flex-shrink-0" />
          <p>{t("offline.offlineBanner")}</p>
        </div>
      )}

      <Card>
        <CardContent className="pt-6 space-y-6">
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t("novaVistoria_tipoEvento.label")}</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {TIPO_EVENTO_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isSelected = tipoEvento === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTipoEvento(opt.value)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
                      isSelected ? `${opt.color} border-current` : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{t(opt.labelKey as any)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {showTipoVistoria && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t("novaVistoria_tipoVistoria.label")}</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {TIPO_VISTORIA_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = tipoVistoria === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setTipoVistoria(opt.value)}
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border-2 text-xs font-medium transition-all ${
                        isSelected ? `${opt.color} border-current` : "border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate">{t(opt.labelKey as any)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-col items-center justify-center py-6 space-y-4 rounded-lg bg-muted/50 border border-dashed">
            {!audioBlob ? (
              <>
                <Button
                  size="lg"
                  variant={isRecording ? "destructive" : "default"}
                  className={`w-24 h-24 rounded-full shadow-lg ${isRecording ? "animate-pulse" : ""}`}
                  onClick={isRecording ? stopRecording : startRecording}
                  data-testid="button-record"
                >
                  {isRecording ? <Square className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
                </Button>
                <div className="text-center">
                  <p className="font-medium text-lg">
                    {isRecording ? formatDuration(recordingSeconds) : t("novaVistoria.startRecording")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isRecording ? t("novaVistoria.tapToStop") : t("novaVistoria.describeIssue")}
                  </p>
                </div>
              </>
            ) : (
              <div className="w-full max-w-sm space-y-4 px-4">
                <div className="flex items-center justify-between bg-background p-3 rounded-md border">
                  <div className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-green-500" />
                    <span className="font-medium">{t("novaVistoria.audioRecorded")}</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setAudioBlob(null)}>
                    {t("novaVistoria.reRecord")}
                  </Button>
                </div>
                <audio src={URL.createObjectURL(audioBlob)} controls className="w-full" />
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                {t("novaVistoria.condominioLabel")}
              </Label>
              {condominios && condominios.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("novaVistoria.noCondominios")}</p>
              ) : (
                <Select value={condominioId || NONE_VALUE} onValueChange={(v) => setCondominioId(v === NONE_VALUE ? "" : v)}>
                  <SelectTrigger data-testid="select-condominio">
                    <SelectValue placeholder={t("novaVistoria.condominioPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>{t("common.none")}</SelectItem>
                    {condominios?.map(c => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.nome}
                        {c.cidade && <span className="text-muted-foreground text-xs ml-1">— {c.cidade}/{c.estado}</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {condominioId && areas && (
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  {t("novaVistoria_escopo.label")}
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => { setEscopo("completa"); setSelectedAreaIds(new Set()); }}
                    className={`flex flex-col items-start p-3 rounded-lg border-2 text-left transition-all ${
                      escopo === "completa"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <span className="font-medium text-sm">{t("novaVistoria_escopo.completa")}</span>
                    <span className="text-xs mt-0.5 opacity-75">{t("novaVistoria_escopo.completaDesc")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEscopo("areas_especificas")}
                    className={`flex flex-col items-start p-3 rounded-lg border-2 text-left transition-all ${
                      escopo === "areas_especificas"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <span className="font-medium text-sm">{t("novaVistoria_escopo.areas_especificas")}</span>
                    <span className="text-xs mt-0.5 opacity-75">{t("novaVistoria_escopo.areas_especificasDesc")}</span>
                  </button>
                </div>

                {escopo === "areas_especificas" && (
                  <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
                    {areas.length === 0 ? (
                      <div className="text-center py-4">
                        <MapPin className="h-6 w-6 mx-auto mb-2 text-muted-foreground opacity-40" />
                        <p className="text-sm text-muted-foreground">{t("novaVistoria_escopo.noAreasRegistered")}</p>
                        <p className="text-xs text-muted-foreground mt-1">{t("novaVistoria_escopo.registerAreasHint")}</p>
                      </div>
                    ) : (
                      <>
                        {selectedAreaIds.size > 0 && (
                          <p className="text-xs font-medium text-primary">
                            {selectedAreaIds.size} {t("novaVistoria_escopo.selectedAreas")}
                          </p>
                        )}
                        {Object.keys(groupedAreas).map(tipo => (
                          <div key={tipo}>
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${AREA_TIPO_COLORS[tipo] || "bg-gray-100 text-gray-700"}`}>
                                <AreaTypeName tipo={tipo} t={t} />
                              </span>
                            </div>
                            <div className="space-y-1 ml-1">
                              {groupedAreas[tipo].map(area => (
                                <label
                                  key={area.id}
                                  className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors ${
                                    selectedAreaIds.has(area.id) ? "bg-primary/10 border border-primary/20" : "hover:bg-muted border border-transparent"
                                  }`}
                                >
                                  <Checkbox
                                    checked={selectedAreaIds.has(area.id)}
                                    onCheckedChange={() => toggleAreaSelection(area.id)}
                                    id={`area-${area.id}`}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <span className="text-sm font-medium">{area.nome}</span>
                                    {area.capacidade && (
                                      <span className="text-xs text-muted-foreground ml-2">
                                        <Users className="inline h-3 w-3 mr-0.5" />{area.capacidade}
                                      </span>
                                    )}
                                  </div>
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}

                {escopo === "completa" && condominioId && (
                  <div className="space-y-2">
                    <Label>{t("novaVistoria.areaLabel")}</Label>
                    <Select value={areaId || NONE_VALUE} onValueChange={(v) => setAreaId(v === NONE_VALUE ? "" : v)}>
                      <SelectTrigger data-testid="select-area">
                        <SelectValue placeholder={t("novaVistoria.areaPlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_VALUE}>{t("common.none")}</SelectItem>
                        {areas?.map(a => {
                          const label = [
                            a.bloco ? a.bloco : null,
                            a.andar != null ? t("condominios.andarDisplay", { andar: a.andar }) : null,
                            a.nome,
                          ].filter(Boolean).join(" · ");
                          return (
                            <SelectItem key={a.id} value={String(a.id)}>
                              {label}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            {condominioId && assets && assets.length > 0 && (
              <div className="space-y-2">
                <Label>{t("novaVistoria_tipoEvento.assetLabel")}</Label>
                <Select value={assetId || NONE_VALUE} onValueChange={(v) => setAssetId(v === NONE_VALUE ? "" : v)}>
                  <SelectTrigger data-testid="select-asset">
                    <SelectValue placeholder={t("novaVistoria_tipoEvento.assetPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>{t("common.none")}</SelectItem>
                    {assets.map(a => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        {a.nome} <span className="text-muted-foreground text-xs ml-1">({a.tipo})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="local">{t("novaVistoria.localLabel")}</Label>
              <Input
                id="local"
                placeholder={t("novaVistoria.localPlaceholder")}
                value={local}
                onChange={(e) => setLocal(e.target.value)}
                data-testid="input-local"
              />
            </div>

            <div className="space-y-2">
              <Label>{t("novaVistoria.images")}</Label>
              <div className="flex flex-wrap gap-2">
                {images.map((img, i) => (
                  <div key={i} className="relative w-20 h-20 rounded-md overflow-hidden border">
                    <img src={URL.createObjectURL(img)} alt={`Preview ${i}`} className="w-full h-full object-cover" />
                    <button className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1" onClick={() => removeImage(i)}>
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <label className="w-20 h-20 flex flex-col items-center justify-center border border-dashed rounded-md cursor-pointer hover:bg-muted/50 transition-colors">
                  <Camera className="h-6 w-6 text-muted-foreground" />
                  <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={handleImageCapture} data-testid="input-camera" />
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">{t("novaVistoria.notesLabel")}</Label>
              <Textarea id="notes" placeholder={t("novaVistoria.notesPlaceholder")} value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} data-testid="input-notes" />
            </div>
          </div>
        </CardContent>

        {!report && (
          <CardFooter className="bg-muted/20 border-t pt-6 flex flex-col gap-2">
            {!isOnline ? (
              <Button
                className="w-full h-12 text-lg bg-amber-600 hover:bg-amber-700"
                onClick={handleSaveOffline}
                disabled={!audioBlob || isSavingOffline}
                data-testid="button-save-offline"
              >
                {isSavingOffline ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" />{t("common.loading")}</>
                ) : (
                  <><WifiOff className="mr-2 h-5 w-5" />{t("offline.savedOffline")}</>
                )}
              </Button>
            ) : (
              <Button
                className="w-full h-12 text-lg"
                onClick={handleSubmit}
                disabled={!audioBlob || generateReport.isPending}
                data-testid="button-submit-report"
              >
                {generateReport.isPending ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" />{loadingMessage}</>
                ) : t("novaVistoria.generateReport")}
              </Button>
            )}
          </CardFooter>
        )}
      </Card>

      {report && (
        <Card className="border-primary/20 shadow-md overflow-hidden animate-in slide-in-from-bottom-4">
          <div className="bg-primary/5 px-6 py-4 border-b">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="bg-background">{report.tipo}</Badge>
                  {showTipoVistoria && tipoVistoria && (
                    <Badge variant="secondary" className="text-xs">
                      {t(`novaVistoria_tipoVistoria.${tipoVistoria}` as any)}
                    </Badge>
                  )}
                  {escopo === "areas_especificas" && selectedAreaIds.size > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {selectedAreaIds.size} {t("novaVistoria_escopo.selectedAreas")}
                    </Badge>
                  )}
                </div>
                <h2 className="text-xl font-bold">{report.resumo}</h2>
              </div>
              <Badge className={getUrgenciaColor(report.urgencia)} variant="secondary">
                {report.urgencia.toUpperCase()}
              </Badge>
            </div>
          </div>
          <CardContent className="pt-6 space-y-6">
            <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 p-4 rounded-md">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm">{t("novaVistoria.recommendedAction")}</p>
                <p className="text-sm">{report.acao}</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="comunicado" className="text-base font-semibold">{t("novaVistoria.residentNotice")}</Label>
              <p className="text-sm text-muted-foreground">{t("novaVistoria.editBeforeSave")}</p>
              <Textarea id="comunicado" value={editedComunicado} onChange={(e) => setEditedComunicado(e.target.value)} rows={6} className="resize-y" data-testid="input-comunicado" />
            </div>
          </CardContent>
          <CardFooter className="bg-muted/20 border-t pt-6">
            <Button className="w-full h-12 text-lg" onClick={handleSave} disabled={saveInspection.isPending} data-testid="button-save-inspection">
              {saveInspection.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
              {t("novaVistoria.saveInspection")}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
