import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useGetDashboardSummary } from "@workspace/api-client-react";
import { format } from "date-fns";
import { ptBR, enUS } from "date-fns/locale";
import {
  LayoutDashboard, AlertTriangle, CheckCircle2, Wrench, PackageX,
  TrendingUp, Activity, ChevronRight, RefreshCw, Package,
  Loader2, Shield, Zap, Building2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const TIPO_EVENTO_COLORS: Record<string, string> = {
  vistoria: "bg-blue-100 text-blue-700 border-blue-200",
  manutencao: "bg-orange-100 text-orange-700 border-orange-200",
  incidente: "bg-red-100 text-red-700 border-red-200",
  melhoria: "bg-purple-100 text-purple-700 border-purple-200",
};

const CRITICIDADE_COLORS: Record<string, string> = {
  alta: "bg-red-100 text-red-700 border-red-200",
  media: "bg-yellow-100 text-yellow-700 border-yellow-200",
  baixa: "bg-green-100 text-green-700 border-green-200",
};

const STATUS_ASSET_COLORS: Record<string, string> = {
  operacional: "bg-green-100 text-green-700",
  em_manutencao: "bg-yellow-100 text-yellow-700",
  inativo: "bg-gray-100 text-gray-700",
};

export default function DashboardPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "pt" ? ptBR : enUS;

  const { data, isPending, isError, refetch, isRefetching } = useGetDashboardSummary();

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="text-center py-16 space-y-4">
        <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
        <p className="text-muted-foreground">{t("dashboard.errorLoading")}</p>
        <Button variant="outline" onClick={() => refetch()}>{t("common.retry")}</Button>
      </div>
    );
  }

  const getUrgenciaColor = (u: string) => {
    if (u === "alta") return "bg-red-100 text-red-800 border-red-200";
    if (u === "média" || u === "media") return "bg-yellow-100 text-yellow-800 border-yellow-200";
    return "bg-green-100 text-green-800 border-green-200";
  };

  const getTipoEventoLabel = (t_: string) => {
    const map: Record<string, string> = {
      vistoria: "Vistoria",
      manutencao: "Manutenção",
      incidente: "Incidente",
      melhoria: "Melhoria",
    };
    return map[t_] ?? t_;
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <LayoutDashboard className="h-6 w-6 text-primary" />
            {t("dashboard.title")}
          </h1>
          <p className="text-muted-foreground">{t("dashboard.subtitle")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching} className="w-full sm:w-auto">
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? "animate-spin" : ""}`} />
          {t("common.refresh")}
        </Button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{t("dashboard.totalAssets")}</p>
                <p className="text-2xl font-bold mt-1">{data.totalAssets}</p>
              </div>
              <Package className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{t("dashboard.assetsCriticos")}</p>
                <p className="text-2xl font-bold mt-1 text-red-600">{data.assetsCriticos}</p>
              </div>
              <Shield className="h-5 w-5 text-red-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{t("dashboard.eventos30d")}</p>
                <p className="text-2xl font-bold mt-1">{data.totalEventos30d}</p>
              </div>
              <Activity className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{t("dashboard.eventosAlta")}</p>
                <p className="text-2xl font-bold mt-1 text-orange-600">{data.eventosAlta}</p>
              </div>
              <Zap className="h-5 w-5 text-orange-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Asset status breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            {t("dashboard.assetStatus")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col items-center gap-1 p-3 rounded-lg bg-green-50 dark:bg-green-900/10">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span className="text-lg font-bold text-green-700">{data.assetsOperacional}</span>
              <span className="text-xs text-muted-foreground text-center">{t("dashboard.operacional")}</span>
            </div>
            <div className="flex flex-col items-center gap-1 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/10">
              <Wrench className="h-5 w-5 text-yellow-600" />
              <span className="text-lg font-bold text-yellow-700">{data.assetsEmManutencao}</span>
              <span className="text-xs text-muted-foreground text-center">{t("dashboard.emManutencao")}</span>
            </div>
            <div className="flex flex-col items-center gap-1 p-3 rounded-lg bg-gray-50 dark:bg-gray-900/10">
              <PackageX className="h-5 w-5 text-gray-500" />
              <span className="text-lg font-bold text-gray-600">{data.assetsInativo}</span>
              <span className="text-xs text-muted-foreground text-center">{t("dashboard.inativo")}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Critical assets */}
      {data.criticalAssets.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                {t("dashboard.criticalAssets")}
              </CardTitle>
              <Link href="/app/ativos">
                <Button variant="ghost" size="sm" className="text-xs">{t("dashboard.viewAll")}</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.criticalAssets.map((asset) => (
              <div
                key={asset.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{asset.nome}</p>
                  <p className="text-xs text-muted-foreground capitalize">{asset.tipo}</p>
                </div>
                <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                  <Badge className={`text-xs border ${STATUS_ASSET_COLORS[asset.status] ?? ""}`} variant="outline">
                    {asset.status === "operacional" ? t("dashboard.operacional")
                      : asset.status === "em_manutencao" ? t("dashboard.emManutencao")
                      : t("dashboard.inativo")}
                  </Badge>
                  <Badge className="text-xs border bg-red-100 text-red-700 border-red-200" variant="outline">
                    {t("dashboard.criticidadeAlta")}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recent events */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" />
              {t("dashboard.recentEvents")}
            </CardTitle>
            <Link href="/app/historico">
              <Button variant="ghost" size="sm" className="text-xs">{t("dashboard.viewAll")}</Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {data.recentEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">{t("dashboard.noEvents")}</p>
          ) : (
            <div className="space-y-2">
              {data.recentEvents.map((event) => (
                <Link key={event.id} href={`/app/vistoria/${event.id}`}>
                  <div className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={`text-xs border ${TIPO_EVENTO_COLORS[event.tipoEvento ?? "vistoria"] ?? ""}`} variant="outline">
                          {getTipoEventoLabel(event.tipoEvento ?? "vistoria")}
                        </Badge>
                        <Badge className={`text-xs border ${getUrgenciaColor(event.urgencia)}`} variant="outline">
                          {event.urgencia}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium mt-1 truncate">{event.tipo}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(event.createdAt), "d MMM", { locale })}
                        {event.condominio ? ` · ${event.condominio}` : ""}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/app/nova-vistoria">
          <Button className="w-full h-auto py-4 flex flex-col gap-1" variant="default">
            <Activity className="h-5 w-5" />
            <span className="text-sm">{t("dashboard.newEvent")}</span>
          </Button>
        </Link>
        <Link href="/app/ativos">
          <Button className="w-full h-auto py-4 flex flex-col gap-1" variant="outline">
            <Building2 className="h-5 w-5" />
            <span className="text-sm">{t("dashboard.manageAssets")}</span>
          </Button>
        </Link>
      </div>
    </div>
  );
}
