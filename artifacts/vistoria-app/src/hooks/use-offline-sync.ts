import { useState, useEffect, useCallback, useRef } from "react";
import {
  getAllOfflineInspections,
  getPendingOfflineInspections,
  updateOfflineInspectionStatus,
  deleteOfflineInspection,
  countPendingInspections,
  OfflineInspection,
} from "@/lib/offline-db";
import { useOnlineStatus } from "./use-online-status";

async function syncInspection(inspection: OfflineInspection): Promise<void> {
  const formData = new FormData();
  formData.append("audio", inspection.audioBlob, "audio.webm");
  inspection.imageBlobs.forEach((blob, i) => {
    formData.append("images", blob, inspection.imageNames[i] ?? `image-${i}.jpg`);
  });
  if (inspection.notes) formData.append("notes", inspection.notes);

  const reportRes = await fetch("/api/report/generate-report", {
    method: "POST",
    body: formData,
  });

  if (!reportRes.ok) {
    const errData = await reportRes.json().catch(() => ({}));
    throw new Error(errData.error ?? `HTTP ${reportRes.status}`);
  }

  const report = await reportRes.json();

  const savePayload = {
    tipo: report.tipo,
    urgencia: report.urgencia,
    acao: report.acao,
    resumo: report.resumo,
    comunicado: report.comunicado,
    transcricao: report.transcricao,
    analise_imagens: report.analise_imagens,
    local: inspection.local,
    condominio: inspection.condominioName,
    condominioId: inspection.condominioId,
    areaId: inspection.areaId,
    assetId: inspection.assetId,
    tipoEvento: inspection.tipoEvento,
  };

  const saveRes = await fetch("/api/inspections", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(savePayload),
  });

  if (!saveRes.ok) {
    const errData = await saveRes.json().catch(() => ({}));
    throw new Error(errData.error ?? `HTTP ${saveRes.status}`);
  }
}

export function useOfflineSync() {
  const isOnline = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [inspections, setInspections] = useState<OfflineInspection[]>([]);
  const syncingRef = useRef(false);

  const refreshInspections = useCallback(async () => {
    const all = await getAllOfflineInspections();
    setInspections(all);
    const count = all.filter((i) => i.status === "pending").length;
    setPendingCount(count);
  }, []);

  const syncPending = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setIsSyncing(true);

    try {
      const pending = await getPendingOfflineInspections();
      for (const inspection of pending) {
        if (!navigator.onLine) break;
        await updateOfflineInspectionStatus(inspection.id, "syncing");
        await refreshInspections();
        try {
          await syncInspection(inspection);
          await deleteOfflineInspection(inspection.id);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Sync failed";
          await updateOfflineInspectionStatus(inspection.id, "error", msg);
        }
        await refreshInspections();
      }
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
      await refreshInspections();
    }
  }, [refreshInspections]);

  const retryInspection = useCallback(async (id: string) => {
    await updateOfflineInspectionStatus(id, "pending");
    await refreshInspections();
    if (navigator.onLine) {
      syncPending();
    }
  }, [refreshInspections, syncPending]);

  const removeInspection = useCallback(async (id: string) => {
    await deleteOfflineInspection(id);
    await refreshInspections();
  }, [refreshInspections]);

  useEffect(() => {
    refreshInspections();
  }, [refreshInspections]);

  useEffect(() => {
    if (isOnline) {
      countPendingInspections().then((count) => {
        if (count > 0) {
          syncPending();
        }
      });
    }
  }, [isOnline, syncPending]);

  return {
    isOnline,
    pendingCount,
    isSyncing,
    inspections,
    refreshInspections,
    syncPending,
    retryInspection,
    removeInspection,
  };
}
