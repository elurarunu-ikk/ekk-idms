// ekk-mobile/utils/offlineQueue.js

import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ACTIVITIES,
  LAYERS,
  STRUCTURE_TYPES,
  STRUCTURE_ELEMENT_ACTIVITY_MAP,
} from '../constants/data';

const QUEUE_KEY = 'ekk_offline_queue';
const MODE_KEY  = 'ekk_network_mode';
const RETRY_QUEUE_KEY = 'ekk_media_retry_queue';
const SUBMITTED_ENTRY_IDS_KEY = 'ekk_submitted_entry_ids';
const SQLITE_MIGRATION_KEY = 'ekk_sqlite_migrated_v1';
const QUEUE_METADATA_MIGRATION_KEY = 'ekk_queue_metadata_migrated_v2';

const SUBMITTED_RETENTION_DAYS = 7;
const SUBMITTED_MAX_COUNT = 50;

const WORK_TYPE_ORDER = ['ROAD', 'STRUCTURE', 'DRAIN', 'ANCILLARY', 'MISC'];
const LAYER_CODE_SET = new Set(LAYERS.map((layer) => layer.code));
const STRUCTURE_ELEMENT_SET = new Set(
  Object.values(STRUCTURE_ELEMENT_ACTIVITY_MAP).flatMap((elementMap) => Object.keys(elementMap))
);

const modeListeners = new Set();

function inferWorkType(stageCode, activityCode) {
  if (LAYER_CODE_SET.has(stageCode)) return 'ROAD';
  if (STRUCTURE_ELEMENT_SET.has(stageCode)) return 'STRUCTURE';
  if (['DRAIN', 'ANCILLARY', 'MISC'].includes(stageCode)) return stageCode;

  const activity = ACTIVITIES.find((item) => item.code === activityCode);
  if (!activity) return '';

  for (const workType of WORK_TYPE_ORDER) {
    if (activity.workTypes.includes(workType)) return workType;
  }

  return '';
}

function inferStructureTypeSafe(elementCode, activityCode) {
  if (!elementCode) return '';

  const candidates = STRUCTURE_TYPES.filter((type) => {
    const mappedActivities = STRUCTURE_ELEMENT_ACTIVITY_MAP[type.code]?.[elementCode] || [];
    if (!mappedActivities.length) return false;
    return !activityCode || mappedActivities.includes(activityCode);
  });

  return candidates.length === 1 ? candidates[0].code : '';
}

function enrichLegacyPayload(payload) {
  if (!payload || typeof payload !== 'object') return payload;

  const next = { ...payload };
  const stageCode = next.stage || '';
  const activityCode = next.activity_code || '';

  const workType = next.work_type || inferWorkType(stageCode, activityCode);
  if (workType && !next.work_type) next.work_type = workType;

  if (workType === 'ROAD' && !next.layer_code && LAYER_CODE_SET.has(stageCode)) {
    next.layer_code = stageCode;
  }

  if (workType === 'STRUCTURE' && !next.element_code && STRUCTURE_ELEMENT_SET.has(stageCode)) {
    next.element_code = stageCode;
  }

  if (workType === 'STRUCTURE' && !next.structure_type) {
    const inferred = inferStructureTypeSafe(next.element_code || stageCode, activityCode);
    if (inferred) next.structure_type = inferred;
  }

  return next;
}

async function runQueueMetadataMigrationOnce() {
  const migrationDone = await getRaw(QUEUE_METADATA_MIGRATION_KEY);
  if (migrationDone === '1') return;

  let queue = [];
  try {
    const raw = await getRaw(QUEUE_KEY);
    queue = raw ? JSON.parse(raw) : [];
  } catch {
    queue = [];
  }

  if (Array.isArray(queue) && queue.length > 0) {
    let changed = false;
    const migrated = queue.map((item) => {
      if (!item?.payload || typeof item.payload !== 'object') return item;
      const nextPayload = enrichLegacyPayload(item.payload);
      if (JSON.stringify(nextPayload) !== JSON.stringify(item.payload)) changed = true;
      return changed ? { ...item, payload: nextPayload } : item;
    });

    if (changed) {
      await setRaw(QUEUE_KEY, JSON.stringify(migrated));
    }
  }

  await setRaw(QUEUE_METADATA_MIGRATION_KEY, '1');
}

let dbPromise = null;
let readyPromise = null;

function isWeb() {
  return Platform.OS === 'web';
}

async function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('ekk_local.db');
      await db.execAsync(
        'CREATE TABLE IF NOT EXISTS kv_store (k TEXT PRIMARY KEY NOT NULL, v TEXT);'
      );
      return db;
    })();
  }
  return dbPromise;
}

async function getKV(key) {
  const db = await getDb();
  const row = await db.getFirstAsync('SELECT v FROM kv_store WHERE k = ?;', [key]);
  return row?.v ?? null;
}

async function setKV(key, value) {
  const db = await getDb();
  await db.runAsync('INSERT OR REPLACE INTO kv_store (k, v) VALUES (?, ?);', [key, value]);
}

async function ensureReady() {
  if (isWeb()) return;
  if (!readyPromise) {
    readyPromise = (async () => {
      await getDb();
      const migrated = await getKV(SQLITE_MIGRATION_KEY);
      if (migrated === '1') return;

      // One-time migration from existing AsyncStorage keys.
      const [queueRaw, modeRaw, retryRaw] = await Promise.all([
        AsyncStorage.getItem(QUEUE_KEY),
        AsyncStorage.getItem(MODE_KEY),
        AsyncStorage.getItem(RETRY_QUEUE_KEY),
      ]);

      if (queueRaw != null) await setKV(QUEUE_KEY, queueRaw);
      if (modeRaw != null) await setKV(MODE_KEY, modeRaw);
      if (retryRaw != null) await setKV(RETRY_QUEUE_KEY, retryRaw);

      await setKV(SQLITE_MIGRATION_KEY, '1');
    })();
  }
  await readyPromise;
}

async function getRaw(key) {
  if (isWeb()) return await AsyncStorage.getItem(key);
  await ensureReady();
  return await getKV(key);
}

async function setRaw(key, value) {
  if (isWeb()) {
    await AsyncStorage.setItem(key, value);
    return;
  }
  await ensureReady();
  await setKV(key, value);
}

// ── Mode ──────────────────────────────────────────────────────────────────────
export async function getMode() {
  const mode = await getRaw(MODE_KEY);
  return mode || 'online';
}

export async function setMode(mode) {
  await setRaw(MODE_KEY, mode);
  for (const listener of modeListeners) {
    try {
      listener(mode);
    } catch {
      // Ignore listener errors to avoid breaking mode persistence.
    }
  }
}

export function subscribeModeChange(listener) {
  if (typeof listener !== 'function') return () => {};
  modeListeners.add(listener);
  return () => modeListeners.delete(listener);
}

// ── Queue ops ─────────────────────────────────────────────────────────────────
export async function loadQueue() {
  try {
    await runQueueMetadataMigrationOnce();
    const raw = await getRaw(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveQueue(queue) {
  await setRaw(QUEUE_KEY, JSON.stringify(queue));
}

export async function enqueueEntry(payload, mediaItems = []) {
  const queue   = await loadQueue();
  const localId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const item    = {
    localId,
    payload,
    mediaItems,  // Store media items for later upload
    queuedAt:   new Date().toISOString(),
    syncStatus: 'pending',
    failReason: null,
  };
  queue.push(item);
  await saveQueue(queue);
  console.log('[offlineQueue] Enqueued:', localId, 'with', mediaItems.length, 'media items');
  return localId;
}

/** Update payload of an existing queued entry */
export async function updateQueueEntry(localId, newPayload, newMediaItems) {
  const queue = await loadQueue();
  const item  = queue.find(i => i.localId === localId);
  if (item) {
    item.payload    = newPayload;
    item.syncStatus = 'pending';   // reset to pending after edit
    item.failReason = null;
    if (newMediaItems !== undefined) item.mediaItems = newMediaItems;
  }
  await saveQueue(queue);
}

export async function removeFromQueue(localId) {
  const queue   = await loadQueue();
  const updated = queue.filter(i => i.localId !== localId);
  await saveQueue(updated);
}

export async function markFailed(localId, reason) {
  const queue = await loadQueue();
  const item  = queue.find(i => i.localId === localId);
  if (item) { item.syncStatus = 'failed'; item.failReason = reason; }
  await saveQueue(queue);
}

// ── Media retry queue ops ─────────────────────────────────────────────────────
export async function loadRetryQueue() {
  try {
    const raw = await getRaw(RETRY_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveRetryQueue(queue) {
  await setRaw(RETRY_QUEUE_KEY, JSON.stringify(queue));
}

// ── Submitted online entries ────────────────────────────────────────────────

// Items older than SUBMITTED_RETENTION_DAYS are dropped; list capped at SUBMITTED_MAX_COUNT.
// Items with no submittedAt (migrated from old plain-string format) are kept indefinitely.
function applySubmittedRetention(items) {
  const cutoff = Date.now() - SUBMITTED_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return items
    .filter(item => !item.submittedAt || new Date(item.submittedAt).getTime() >= cutoff)
    .slice(0, SUBMITTED_MAX_COUNT);
}

// Internal: returns { id, submittedAt }[] with retention applied.
// Normalizes old plain-string format on read.
async function loadSubmittedEntries() {
  try {
    const raw = await getRaw(SUBMITTED_ENTRY_IDS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    const normalized = parsed.map(item =>
      typeof item === 'string' ? { id: item, submittedAt: new Date().toISOString() } : item
    );
    return applySubmittedRetention(normalized);
  } catch {
    return [];
  }
}

// Public: returns string[] for backward compat with callers that check membership.
export async function loadSubmittedEntryIds() {
  const entries = await loadSubmittedEntries();
  return entries.map(e => e.id);
}

export async function addSubmittedEntryId(entryId) {
  if (!entryId) return [];
  const normalizedId = String(entryId);
  const current = await loadSubmittedEntries();
  const deduped = [
    { id: normalizedId, submittedAt: new Date().toISOString() },
    ...current.filter(e => e.id !== normalizedId),
  ];
  const retained = applySubmittedRetention(deduped);
  await setRaw(SUBMITTED_ENTRY_IDS_KEY, JSON.stringify(retained));
  return retained.map(e => e.id);
}

// Applies retention to stored submitted IDs without requiring a new submission.
// Call on app focus to silently clean up expired entries.
export async function purgeSubmittedEntries() {
  try {
    const entries = await loadSubmittedEntries();
    await setRaw(SUBMITTED_ENTRY_IDS_KEY, JSON.stringify(entries));
  } catch (e) {
    console.warn('[offlineQueue] purgeSubmittedEntries failed:', e.message);
  }
}

// Returns stats for the storage panel UI in EntriesScreen.
export async function getQueueStats() {
  const [queue, submittedEntries] = await Promise.all([
    loadQueue(),
    loadSubmittedEntries(),
  ]);

  const pending = queue.filter(i => i.syncStatus === 'pending').length;
  const failed = queue.filter(i => i.syncStatus === 'failed').length;

  let storageSizeKB = 0;
  try {
    const [queueRaw, submittedRaw] = await Promise.all([
      getRaw(QUEUE_KEY),
      getRaw(SUBMITTED_ENTRY_IDS_KEY),
    ]);
    const totalBytes = (queueRaw?.length ?? 0) + (submittedRaw?.length ?? 0);
    storageSizeKB = Math.round(totalBytes / 1024 * 10) / 10;
  } catch {
    storageSizeKB = 0;
  }

  return {
    pending,
    failed,
    submittedCount: submittedEntries.length,
    totalOffline: queue.length,
    storageSizeKB,
    retentionDays: SUBMITTED_RETENTION_DAYS,
  };
}