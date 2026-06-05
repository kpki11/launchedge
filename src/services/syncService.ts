// src/services/syncService.ts
// Offline-first sync queue — batches local changes and pushes
// each table as a CSV to the user's Google Drive folder on demand.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTables } from './database';
import { exportTableToCSV } from './exportService';

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

const SYNC_QUEUE_KEY = 'launchedge_sync_queue';
const LAST_SYNC_KEY  = 'launchedge_last_sync_ts';

export interface SyncQueueItem {
  id: string;
  tableId: string;
  tableName: string;
  action: 'upsert' | 'delete';
  timestamp: string;
}

export interface SyncResult {
  synced: number;
  errors: string[];
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Queue helpers
// ---------------------------------------------------------------------------

export async function addToSyncQueue(item: SyncQueueItem): Promise<void> {
  const raw = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
  const queue: SyncQueueItem[] = raw ? JSON.parse(raw) : [];
  // Avoid duplicates for the same table+action within the same session
  const alreadyQueued = queue.some(
    q => q.tableId === item.tableId && q.action === item.action
  );
  if (!alreadyQueued) {
    queue.push(item);
    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  }
}

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  const raw = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function clearSyncQueue(): Promise<void> {
  await AsyncStorage.removeItem(SYNC_QUEUE_KEY);
}

export async function getLastSyncTime(): Promise<string | null> {
  return AsyncStorage.getItem(LAST_SYNC_KEY);
}

async function setLastSyncTime(): Promise<void> {
  await AsyncStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
}

// ---------------------------------------------------------------------------
// Sync execution
// ---------------------------------------------------------------------------

/**
 * Exports every table as CSV and shares via the share sheet.
 * In a full Drive integration, replace exportTableToCSV with
 * uploadCSVToDrive(accessToken, folderId, ...).
 *
 * @param businessId  Active business ID (used to load table list)
 * @param fieldMap    Map of tableId → ordered field name array
 */
export async function performFullSync(
  businessId: string,
  fieldMap: Record<string, string[]>
): Promise<SyncResult> {
  const tables = await getTables(businessId);
  let synced = 0;
  const errors: string[] = [];

  for (const table of tables) {
    try {
      await exportTableToCSV(table.id, table.name, fieldMap[table.id] ?? []);
      synced++;
    } catch (e: any) {
      errors.push(`${table.name}: ${e.message ?? 'Unknown error'}`);
    }
  }

  if (errors.length === 0) {
    await clearSyncQueue();
    await setLastSyncTime();
  }

  return {
    synced,
    errors,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Returns true if there are pending items in the sync queue
 * (i.e. local changes not yet pushed to Drive).
 */
export async function hasPendingSync(): Promise<boolean> {
  const queue = await getSyncQueue();
  return queue.length > 0;
}
