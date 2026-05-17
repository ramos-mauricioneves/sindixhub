import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Wifi, WifiOff, RefreshCw, Clock } from "lucide-react";
import { useOfflineSyncContext } from "@/contexts/offline-sync-context";

interface ConnectionStatusProps {
  onSyncComplete?: () => void;
}

export default function ConnectionStatus({ onSyncComplete }: ConnectionStatusProps) {
  const { t } = useTranslation();
  const { isOnline, pendingCount, isSyncing, syncPending } = useOfflineSyncContext();

  if (isOnline && pendingCount === 0 && !isSyncing) {
    return null;
  }

  const handleSync = () => {
    syncPending().then(() => onSyncComplete?.());
  };

  if (!isOnline) {
    return (
      <div className="flex items-center gap-2 bg-amber-50 border-b border-amber-200 px-4 py-2 text-amber-800 text-sm">
        <WifiOff className="h-4 w-4 flex-shrink-0" />
        <span className="font-medium">{t("offline.statusOffline")}</span>
        {pendingCount > 0 && (
          <Link href="/app/fila-offline" className="ml-auto flex items-center gap-1 text-amber-700 hover:underline">
            <Clock className="h-3.5 w-3.5" />
            <span>{t("offline.pendingCount", { count: pendingCount })}</span>
          </Link>
        )}
      </div>
    );
  }

  if (isSyncing) {
    return (
      <div className="flex items-center gap-2 bg-blue-50 border-b border-blue-200 px-4 py-2 text-blue-800 text-sm">
        <RefreshCw className="h-4 w-4 flex-shrink-0 animate-spin" />
        <span className="font-medium">{t("offline.syncing")}</span>
        <Link href="/app/fila-offline" className="ml-auto text-blue-700 hover:underline text-xs">
          {t("offline.viewQueue")}
        </Link>
      </div>
    );
  }

  if (isOnline && pendingCount > 0) {
    return (
      <div className="flex items-center gap-2 bg-green-50 border-b border-green-200 px-4 py-2 text-green-800 text-sm">
        <Wifi className="h-4 w-4 flex-shrink-0" />
        <span className="font-medium">{t("offline.onlineWithPending", { count: pendingCount })}</span>
        <button
          onClick={handleSync}
          className="ml-auto flex items-center gap-1 text-green-700 hover:underline text-xs font-medium"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {t("offline.syncNow")}
        </button>
      </div>
    );
  }

  return null;
}
