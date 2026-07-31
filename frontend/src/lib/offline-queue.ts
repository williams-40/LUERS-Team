import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { CreateReportInput } from '../types/domain';

export interface QueuedReport {
  id: string;
  payload: CreateReportInput;
  /** Whether evidence was selected but had to be dropped since it can't be queued offline (see lib/offline-sync.ts). */
  hadDroppedEvidence: boolean;
  createdAt: string;
  retryCount: number;
  lastError?: string;
}

interface OfflineDB extends DBSchema {
  outbox: {
    key: string;
    value: QueuedReport;
  };
}

const DB_NAME = 'luers-offline';
const DB_VERSION = 1;
const STORE_NAME = 'outbox';

/** Shared TanStack Query key — used by useOfflineQueue and by any component that mutates the queue directly. */
export const OFFLINE_QUEUE_KEY = ['offline', 'queue'] as const;

let dbPromise: Promise<IDBPDatabase<OfflineDB>> | null = null;

function getDB() {
  dbPromise ??= openDB<OfflineDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    },
  });
  return dbPromise;
}

export async function enqueueReport(
  payload: CreateReportInput,
  hadDroppedEvidence: boolean,
): Promise<QueuedReport> {
  const item: QueuedReport = {
    id: crypto.randomUUID(),
    payload,
    hadDroppedEvidence,
    createdAt: new Date().toISOString(),
    retryCount: 0,
  };
  const db = await getDB();
  await db.put(STORE_NAME, item);
  return item;
}

export async function getQueuedReports(): Promise<QueuedReport[]> {
  const db = await getDB();
  const all = await db.getAll(STORE_NAME);
  return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function removeQueuedReport(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_NAME, id);
}

export async function updateQueuedReport(id: string, patch: Partial<QueuedReport>): Promise<void> {
  const db = await getDB();
  const existing = await db.get(STORE_NAME, id);
  if (!existing) return;
  await db.put(STORE_NAME, { ...existing, ...patch });
}
