import { createContext, useContext, ReactNode } from "react";
import { useOfflineSync } from "@/hooks/use-offline-sync";
import { OfflineInspection } from "@/lib/offline-db";

interface OfflineSyncContextValue {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  inspections: OfflineInspection[];
  refreshInspections: () => Promise<void>;
  syncPending: () => Promise<void>;
  retryInspection: (id: string) => Promise<void>;
  removeInspection: (id: string) => Promise<void>;
}

const OfflineSyncContext = createContext<OfflineSyncContextValue | null>(null);

export function OfflineSyncProvider({ children }: { children: ReactNode }) {
  const value = useOfflineSync();
  return (
    <OfflineSyncContext.Provider value={value}>
      {children}
    </OfflineSyncContext.Provider>
  );
}

export function useOfflineSyncContext() {
  const ctx = useContext(OfflineSyncContext);
  if (!ctx) throw new Error("useOfflineSyncContext must be used within OfflineSyncProvider");
  return ctx;
}
