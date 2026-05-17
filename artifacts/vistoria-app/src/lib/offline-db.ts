import { openDB, DBSchema, IDBPDatabase } from "idb";

export type OfflineInspectionStatus = "pending" | "syncing" | "error";

export interface OfflineInspection {
  id: string;
  createdAt: number;
  status: OfflineInspectionStatus;
  errorMessage?: string;
  condominioId?: number;
  condominioName?: string;
  areaId?: number;
  assetId?: number;
  local?: string;
  notes?: string;
  tipoEvento: string;
  selectedAssetIds?: number[];
  audioBlob: Blob;
  imageBlobs: Blob[];
  imageNames: string[];
}

interface VistoriaOfflineDB extends DBSchema {
  offlineInspections: {
    key: string;
    value: OfflineInspection;
    indexes: { "by-status": OfflineInspectionStatus; "by-createdAt": number };
  };
}

let dbPromise: Promise<IDBPDatabase<VistoriaOfflineDB>> | null = null;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<VistoriaOfflineDB>("vistoria-offline-db", 1, {
      upgrade(db) {
        const store = db.createObjectStore("offlineInspections", { keyPath: "id" });
        store.createIndex("by-status", "status");
        store.createIndex("by-createdAt", "createdAt");
      },
    });
  }
  return dbPromise;
}

export async function saveOfflineInspection(inspection: OfflineInspection): Promise<void> {
  const db = await getDB();
  await db.put("offlineInspections", inspection);
}

export async function getAllOfflineInspections(): Promise<OfflineInspection[]> {
  const db = await getDB();
  const all = await db.getAll("offlineInspections");
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function getPendingOfflineInspections(): Promise<OfflineInspection[]> {
  const db = await getDB();
  const index = db.transaction("offlineInspections").store.index("by-status");
  const pending = await index.getAll("pending");
  return pending.sort((a, b) => a.createdAt - b.createdAt);
}

export async function updateOfflineInspectionStatus(
  id: string,
  status: OfflineInspectionStatus,
  errorMessage?: string
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("offlineInspections", "readwrite");
  const item = await tx.store.get(id);
  if (item) {
    item.status = status;
    if (errorMessage !== undefined) item.errorMessage = errorMessage;
    else delete item.errorMessage;
    await tx.store.put(item);
  }
  await tx.done;
}

export async function deleteOfflineInspection(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("offlineInspections", id);
}

export async function countPendingInspections(): Promise<number> {
  const db = await getDB();
  const index = db.transaction("offlineInspections").store.index("by-status");
  return index.count("pending");
}
