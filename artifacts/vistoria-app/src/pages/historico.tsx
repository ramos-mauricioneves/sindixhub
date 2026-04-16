import { useState } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import { ptBR, enUS } from "date-fns/locale";
import { History, Filter, RefreshCw, ChevronRight, AlertCircle, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useListInspections, useListCondominios, getListInspectionsQueryKey, getListCondominiosQueryKey, ListInspectionsUrgencia, ListInspectionsStatus } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  rascunho: "bg-gray-100 text-gray-700 border-gray-200",
  gerado: "bg-blue-100 text-blue-700 border-blue-200",
  pronto_para_envio: "bg-yellow-100 text-yellow-700 border-yellow-200",
  enviado: "bg-green-100 text-green-700 border-green-200",
};

export default function HistoricoPage() {
  const { t, i18n } = useTranslation();
  const [urgenciaFilter, setUrgenciaFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [condominioFilter, setCondominioFilter] = useState<string>("all");

  const queryParams = {
    ...(urgenciaFilter !== "all" ? { urgencia: urgenciaFilter as ListInspectionsUrgencia } : {}),
    ...(statusFilter !== "all" ? { status: statusFilter as ListInspectionsStatus } : {}),
    ...(condominioFilter !== "all" ? { condominioId: parseInt(condominioFilter, 10) } : {}),
  };

  const { data, isPending, isError, refetch, isRefetching } = useListInspections(queryParams, {
    query: { queryKey: getListInspectionsQueryKey(queryParams) }
  });

  const { data: condominios } = useListCondominios({
    query: { queryKey: getListCondominiosQueryKey() }
  });

  const locale = i18n.language === "pt" ? ptBR : enUS;

  const getUrgenciaColor = (u: string) => {
    if (u === "alta") return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300";
    if (u === "média" || u === "media") return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300";
    return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300";
  };

  const getUrgenciaLabel = (u: string) => {
    if (u === "alta") return t("historico.high");
    if (u === "média" || u === "media") return t("historico.medium");
    return t("historico.low");
  };

  const getStatusLabel = (s: string) => t(`historico.status.${s}` as any) || s;

  const hasFilters = urgenciaFilter !== "all" || statusFilter !== "all" || condominioFilter !== "all";

  const clearFilters = () => {
    setUrgenciaFilter("all");
    setStatusFilter("all");
    setCondominioFilter("all");
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("historico.title")}</h1>
          <p className="text-muted-foreground">{t("historico.subtitle")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching} className="w-full sm:w-auto">
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? "animate-spin" : ""}`} />
          {t("common.refresh")}
        </Button>
      </div>

      <Card className="p-3">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">{t("common.select")}</span>
          {hasFilters && (
            <button onClick={clearFilters} className="ml-auto text-xs text-primary hover:underline">
              {t("historico.clearFilters")}
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Select value={urgenciaFilter} onValueChange={setUrgenciaFilter}>
            <SelectTrigger className="text-sm" data-testid="select-filter-urgencia">
              <SelectValue placeholder={t("historico.filterByUrgency")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("historico.allUrgencies")}</SelectItem>
              <SelectItem value="baixa">{t("historico.low")}</SelectItem>
              <SelectItem value="média">{t("historico.medium")}</SelectItem>
              <SelectItem value="alta">{t("historico.high")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="text-sm" data-testid="select-filter-status">
              <SelectValue placeholder={t("historico.filterByStatus")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("historico.allStatuses")}</SelectItem>
              <SelectItem value="rascunho">{t("historico.status.rascunho")}</SelectItem>
              <SelectItem value="gerado">{t("historico.status.gerado")}</SelectItem>
              <SelectItem value="pronto_para_envio">{t("historico.status.pronto_para_envio")}</SelectItem>
              <SelectItem value="enviado">{t("historico.status.enviado")}</SelectItem>
            </SelectContent>
          </Select>
          {condominios && condominios.length > 0 && (
            <Select value={condominioFilter} onValueChange={setCondominioFilter}>
              <SelectTrigger className="text-sm" data-testid="select-filter-condominio">
                <SelectValue placeholder={t("historico.filterByCondominio")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("historico.allCondominios")}</SelectItem>
                {condominios.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </Card>

      {isPending ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : isError ? (
        <div className="text-center py-12 text-destructive">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>{t("historico.errorLoading")}</p>
          <Button variant="outline" className="mt-4" onClick={() => refetch()}>{t("common.retry")}</Button>
        </div>
      ) : data?.inspections?.length === 0 ? (
        <div className="text-center py-16 px-4 border rounded-xl bg-card border-dashed">
          <History className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-20" />
          <h3 className="text-lg font-medium text-foreground">{t("historico.noInspections")}</h3>
          <p className="text-muted-foreground mb-6 mt-1">
            {hasFilters ? t("historico.noInspectionsFilter") : t("historico.noInspectionsEmpty")}
          </p>
          {hasFilters ? (
            <Button variant="outline" onClick={clearFilters}>{t("historico.clearFilters")}</Button>
          ) : (
            <Link href="/app/nova-vistoria"><Button>{t("historico.createFirst")}</Button></Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {data!.inspections.map((inspection) => (
            <Link key={inspection.id} href={`/app/vistoria/${inspection.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer group">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {inspection.tipoEvento && inspection.tipoEvento !== "vistoria" && (
                          <Badge variant="outline" className={`text-xs ${
                            inspection.tipoEvento === "manutencao" ? "bg-orange-50 text-orange-700 border-orange-200"
                            : inspection.tipoEvento === "incidente" ? "bg-red-50 text-red-700 border-red-200"
                            : inspection.tipoEvento === "melhoria" ? "bg-purple-50 text-purple-700 border-purple-200"
                            : "bg-blue-50 text-blue-700 border-blue-200"
                          }`}>
                            {inspection.tipoEvento === "manutencao" ? "Manutenção"
                              : inspection.tipoEvento === "incidente" ? "Incidente"
                              : inspection.tipoEvento === "melhoria" ? "Melhoria"
                              : inspection.tipoEvento}
                          </Badge>
                        )}
                        <Badge variant="outline" className="bg-background text-xs font-normal">{inspection.tipo}</Badge>
                        <Badge variant="outline" className={`${getUrgenciaColor(inspection.urgencia)} text-xs font-semibold uppercase tracking-wider`}>
                          {getUrgenciaLabel(inspection.urgencia)}
                        </Badge>
                        <Badge variant="outline" className={`${STATUS_COLORS[inspection.status] || ""} text-xs`}>
                          {getStatusLabel(inspection.status)}
                        </Badge>
                      </div>
                      <h3 className="font-semibold text-base sm:text-lg text-foreground line-clamp-2 leading-tight">{inspection.resumo}</h3>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          {format(new Date(inspection.createdAt), i18n.language === "pt" ? "dd 'de' MMM, yyyy 'às' HH:mm" : "MMM dd, yyyy 'at' h:mm a", { locale })}
                        </div>
                        {(inspection.local || inspection.condominio) && (
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="hidden sm:inline text-border">•</span>
                            <span className="truncate">{[inspection.local, inspection.condominio].filter(Boolean).join(" — ")}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="hidden sm:flex items-center justify-center h-10 w-10 rounded-full bg-muted/50 group-hover:bg-primary/10 group-hover:text-primary transition-colors shrink-0">
                      <ChevronRight className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
