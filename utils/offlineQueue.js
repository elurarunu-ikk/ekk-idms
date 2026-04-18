// ekk-mobile/utils/offlineQueue.js

import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = 'ekk_offline_queue';
const MODE_KEY  = 'ekk_network_mode';
const RETRY_QUEUE_KEY = 'ekk_media_retry_queue';
const SQLITE_MIGRATION_KEY = 'ekk_sqlite_migrated_v1';

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
}

// ── Queue ops ─────────────────────────────────────────────────────────────────
export async function loadQueue() {
  try {
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