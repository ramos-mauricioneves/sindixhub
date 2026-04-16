import { useParams, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { ptBR, enUS } from "date-fns/locale";
import { ArrowLeft, Copy, MessageSquare, Loader2, AlertCircle, Send, CheckCheck } from "lucide-react";
import { useGetInspection, useUpdateInspectionStatus, getGetInspectionQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/components/layout";
import { useQueryClient } from "@tanstack/react-query";

const STATUS_COLORS: Record<string, string> = {
  rascunho: "bg-gray-100 text-gray-700",
  gerado: "bg-blue-100 text-blue-700",
  pronto_para_envio: "bg-yellow-100 text-yellow-700",
  enviado: "bg-green-100 text-green-700",
};

export default function VistoriaDetailPage() {
  const { t, i18n } = useTranslation();
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const currentUser = useUser();
  const qc = useQueryClient();
  const id = parseInt(params.id, 10);
  const locale = i18n.language === "pt" ? ptBR : enUS;

  const { data: inspection, isPending, isError } = useGetInspection(id, {
    query: { enabled: !isNaN(id), queryKey: getGetInspectionQueryKey(id) }
  });

  const updateStatus = useUpdateInspectionStatus();

  const getUrgenciaColor = (u: string) => {
    if (u === "alta") return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    if (u === "média" || u === "media") return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
    return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
  };

  const getUrgenciaLabel = (u: string) => {
    if (u === "alta") return t("historico.high");
    if (u === "média" || u === "media") return t("historico.medium");
    return t("historico.low");
  };

  const getStatusLabel = (s: string) => t(`historico.status.${s}` as any) || s;

  const handleCopy = () => {
    if (!inspection) return;
    navigator.clipboard.writeText(inspection.comunicado).then(() => {
      toast({ title: t("common.copied") });
    });
  };

  const handleWhatsApp = () => {
    if (!inspection) return;
    const text = encodeURIComponent(inspection.comunicado);
    window.open(`https://wa.me/?text=${text}`, "_blank");
    toast({ title: t("detalhe.whatsAppSent") });
  };

  const handleStatusUpdate = (newStatus: "pronto_para_envio" | "enviado") => {
    updateStatus.mutate({ id, data: { status: newStatus } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetInspectionQueryKey(id) });
        toast({ title: t("detalhe.statusUpdated") });
      },
      onError: () => toast({ title: t("detalhe.errorUpdatingStatus"), variant: "destructive" }),
    });
  };

  if (isPending) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !inspection) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive opacity-50" />
        <p className="text-muted-foreground">{t("detalhe.errorLoading")}</p>
        <Button variant="outline" className="mt-4" onClick={() => setLocation("/app/historico")}>{t("common.back")}</Button>
      </div>
    );
  }

  const isSindico = currentUser?.role === "sindico" || currentUser?.role === "admin";
  const canMarkReady = isSindico && inspection.status === "gerado";
  const canMarkSent = isSindico && inspection.status === "pronto_para_envio";

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-12">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/app/historico")} data-testid="button-back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("detalhe.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {format(new Date(inspection.createdAt), i18n.language === "pt" ? "dd 'de' MMMM 'de' yyyy" : "MMMM dd, yyyy", { locale })}
          </p>
        </div>
      </div>

      {/* Header Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {inspection.tipoEvento && (
                  <Badge variant="outline" className={`text-xs ${
                    inspection.tipoEvento === "manutencao" ? "bg-orange-50 text-orange-700 border-orange-200"
                    : inspection.tipoEvento === "incidente" ? "bg-red-50 text-red-700 border-red-200"
                    : inspection.tipoEvento === "melhoria" ? "bg-purple-50 text-purple-700 border-purple-200"
                    : "bg-blue-50 text-blue-700 border-blue-200"
                  }`}>
                    {inspection.tipoEvento === "manutencao" ? "Manutenção"
                      : inspection.tipoEvento === "incidente" ? "Incidente"
                      : inspection.tipoEvento === "melhoria" ? "Melhoria"
                      : "Vistoria"}
                  </Badge>
                )}
                <Badge variant="outline" className="bg-background">{inspection.tipo}</Badge>
              </div>
              <h2 className="text-xl font-bold">{inspection.resumo}</h2>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge className={`${getUrgenciaColor(inspection.urgencia)} shrink-0`} variant="secondary">
                {getUrgenciaLabel(inspection.urgencia)}
              </Badge>
              <Badge className={`${STATUS_COLORS[inspection.status] || ""} shrink-0 text-xs`} variant="secondary">
                {t("detalhe.status")}: {getStatusLabel(inspection.status)}
              </Badge>
            </div>
          </div>

          {(inspection.local || inspection.condominio) && (
            <div className="text-sm text-muted-foreground space-y-1 border-t pt-4">
              {inspection.local && <p><span className="font-medium text-foreground">{t("detalhe.local")}:</span> {inspection.local}</p>}
              {inspection.condominio && <p><span className="font-medium text-foreground">{t("detalhe.condominio")}:</span> {inspection.condominio}</p>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recommended Action */}
      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-900">
        <CardContent className="pt-6">
          <p className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-1">{t("detalhe.acao")}</p>
          <p className="text-blue-800 dark:text-blue-300">{inspection.acao}</p>
        </CardContent>
      </Card>

      {/* Comunicado */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">{t("detalhe.comunicado")}</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCopy} data-testid="button-copy">
                <Copy className="h-4 w-4 mr-1.5" />
                {t("common.copy")}
              </Button>
              <Button variant="outline" size="sm" onClick={handleWhatsApp} data-testid="button-whatsapp">
                <MessageSquare className="h-4 w-4 mr-1.5" />
                WhatsApp
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Textarea value={inspection.comunicado} readOnly rows={8} className="resize-none bg-muted/30" />
        </CardContent>
      </Card>

      {/* Status Actions — síndico only */}
      {isSindico && (canMarkReady || canMarkSent) && (
        <Card className="border-primary/20">
          <CardContent className="pt-6">
            <p className="text-sm font-semibold mb-3">{t("detalhe.status")}</p>
            <div className="flex gap-3 flex-wrap">
              {canMarkReady && (
                <Button onClick={() => handleStatusUpdate("pronto_para_envio")} disabled={updateStatus.isPending} data-testid="button-mark-ready">
                  {updateStatus.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  {t("detalhe.markReady")}
                </Button>
              )}
              {canMarkSent && (
                <Button onClick={() => handleStatusUpdate("enviado")} disabled={updateStatus.isPending} data-testid="button-mark-sent">
                  {updateStatus.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCheck className="h-4 w-4 mr-2" />}
                  {t("detalhe.markSent")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transcript */}
      {inspection.transcricao && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">{t("detalhe.transcricao")}</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground leading-relaxed">{inspection.transcricao}</p></CardContent>
        </Card>
      )}

      {/* Image Analysis */}
      {inspection.analise_imagens && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">{t("detalhe.analiseImagens")}</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground leading-relaxed">{inspection.analise_imagens}</p></CardContent>
        </Card>
      )}
    </div>
  );
}
