import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { ptBR, enUS } from "date-fns/locale";
import { Clock, RefreshCw, Trash2, AlertCircle, CheckCircle, WifiOff, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useOfflineSyncContext } from "@/contexts/offline-sync-context";
import { OfflineInspectionStatus } from "@/lib/offline-db";

function StatusBadge({ status }: { status: OfflineInspectionStatus }) {
  const { t } = useTranslation();
  if (status === "pending") {
    return (
      <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-300">
        <Clock className="h-3 w-3 mr-1" />
        {t("offline.status.pending")}
      </Badge>
    );
  }
  if (status === "syncing") {
    return (
      <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-300">
        <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
        {t("offline.status.syncing")}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="bg-red-100 text-red-800 border-red-300">
      <AlertCircle className="h-3 w-3 mr-1" />
      {t("offline.status.error")}
    </Badge>
  );
}

export default function FilaOfflinePage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "pt" ? ptBR : enUS;
  const {
    isOnline,
    isSyncing,
    inspections,
    syncPending,
    retryInspection,
    removeInspection,
  } = useOfflineSyncContext();

  const pendingCount = inspections.filter((i) => i.status === "pending").length;

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-12">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("offline.queueTitle")}</h1>
          <p className="text-muted-foreground">{t("offline.queueSubtitle")}</p>
        </div>
        {isOnline && pendingCount > 0 && (
          <Button
            onClick={() => syncPending()}
            disabled={isSyncing}
            size="sm"
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? t("offline.syncing") : t("offline.syncNow")}
          </Button>
        )}
      </div>

      {/* Connection Status Banner */}
      <div className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium ${
        isOnline
          ? "bg-green-50 text-green-800 border border-green-200"
          : "bg-amber-50 text-amber-800 border border-amber-200"
      }`}>
        {isOnline ? (
          <><Wifi className="h-4 w-4" />{t("offline.statusOnline")}</>
        ) : (
          <><WifiOff className="h-4 w-4" />{t("offline.statusOffline")}</>
        )}
      </div>

      {inspections.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <CheckCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">{t("offline.emptyQueue")}</p>
          <p className="text-sm">{t("offline.emptyQueueDesc")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {inspections.map((item) => (
            <Card key={item.id} className={item.status === "error" ? "border-red-200" : ""}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <StatusBadge status={item.status} />
                      <span className="text-xs text-muted-foreground capitalize">{item.tipoEvento}</span>
                      {item.imageBlobs.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {item.imageBlobs.length} {t("offline.images")}
                        </span>
                      )}
                    </div>
                    {item.condominioName && (
                      <p className="text-sm font-medium truncate">{item.condominioName}</p>
                    )}
                    {item.local && (
                      <p className="text-xs text-muted-foreground truncate">{item.local}</p>
                    )}
                    {item.notes && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{item.notes}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(item.createdAt), "d MMM yyyy, HH:mm", { locale })}
                    </p>
                    {item.status === "error" && item.errorMessage && (
                      <p className="text-xs text-red-600 mt-1 flex items-start gap-1">
                        <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        {item.errorMessage}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {item.status === "error" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => retryInspection(item.id)}
                        className="h-8 px-2 text-xs"
                      >
                        <RefreshCw className="h-3.5 w-3.5 mr-1" />
                        {t("common.retry")}
                      </Button>
                    )}
                    {item.status !== "syncing" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => removeInspection(item.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
