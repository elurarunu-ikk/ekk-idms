import { Platform } from 'react-native';
import Constants from 'expo-constants';
import api from './api';
import { clearSession, getStoredSession, saveSession } from './session';

const isWeb = typeof localStorage !== 'undefined';

// True only on a real native device — Expo web runs in a browser (Platform.OS === 'web')
const isNative = Platform.OS !== 'web';

// ── Stable device ID (generated once, persisted forever) ──────────────────
async function getOrCreateDeviceId() {
  const KEY = 'ekk_device_id';
  let id = isWeb ? localStorage.getItem(KEY) : null;
  if (!id) {
    try {
      const SecureStore = await import('expo-secure-store');
      id = await SecureStore.getItemAsync(KEY);
    } catch (_) {}
  }
  if (!id) {
    id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
    if (isWeb) {
      localStorage.setItem(KEY, id);
    } else {
      try {
        const SecureStore = await import('expo-secure-store');
        await SecureStore.setItemAsync(KEY, id);
      } catch (_) {}
    }
  }
  return id;
}

// ── Storage helpers ────────────────────────────────────────────────────────
async function secureSet(key, value) {
  if (isWeb) {
    localStorage.setItem(key, value);
  } else {
    const SecureStore = await import('expo-secure-store');
    await SecureStore.setItemAsync(key, value);
  }
}

async function secureGet(key) {
  if (isWeb) return localStorage.getItem(key);
  const SecureStore = await import('expo-secure-store');
  return await SecureStore.getItemAsync(key);
}

async function secureDel(key) {
  if (isWeb) {
    localStorage.removeItem(key);
  } else {
    const SecureStore = await import('expo-secure-store');
    await SecureStore.deleteItemAsync(key);
  }
}

// ── Pure-JS SHA-256 (no native modules, works on Hermes) ─────────────────────
function sha256(str) {
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }
  const mathPow = Math.pow;
  const maxWord  = mathPow(2, 32);
  let result = '';
  const words = [];
  const asciiBitLength = str.length * 8;

  let hash = sha256.h = sha256.h || [];
  let k    = sha256.k = sha256.k || [];
  let primeCounter = k.length;

  const isComposite = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (let i = 0; i < 313; i += candidate) isComposite[i] = candidate;
      hash[primeCounter / 8 | 0] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++]           = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  str += '\x80';
  while (str.length % 64 - 56) str += '\x00';
  for (let i = 0; i < str.length; i++) {
    const j = str.charCodeAt(i);
    if (j >> 8) return '';  // non-ASCII guard
    words[i >> 2] |= j << ((3 - i) % 4) * 8;
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;

  for (let j = 0; j < words.length;) {
    const w = words.slice(j, j += 16);
    const oldHash = hash.slice(0);
    hash = hash.slice(0, 8);

    for (let i = 0; i < 64; i++) {
      const i2 = i + j - 16;
      const w15 = w[i - 15], w2 = w[i - 2];
      const a = hash[0], e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] = i < 16 ? w[i] :
          (w[i - 16] +
            (rightRotate(w15, 7)  ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
            w[i - 7] +
            (rightRotate(w2, 17) ^ rightRotate(w2, 19)  ^ (w2 >>> 10))) | 0
        );
      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash = [(temp1 + temp2) | 0, ...hash];
      hash[4] = (hash[4] + temp1) | 0;
      if (hash.length === 9) hash.length = 8;
    }
    hash = hash.map((x, i) => (x + oldHash[i]) | 0);
  }
  hash.forEach(val => {
    for (let i = 7; i >= 0; i--) {
      result += ((val >>> (i * 4)) & 0xF).toString(16);
    }
  });
  return result;
}

function hashPassword(password) {
  return Promise.resolve(sha256(password));
}

// ── Cache credentials after successful online login ───────────────────────
async function cacheCredentials(email, password, token) {
  const hash = await hashPassword(password);
  await secureSet('ekk_token', token);
  await secureSet('ekk_offline_token', token);  // survives logout
  await secureSet('ekk_cached_email', email.toLowerCase().trim());
  await secureSet('ekk_cached_hash', hash);
}

// ── Public API ─────────────────────────────────────────────────────────────
export async function login(email, password) {
  const body = { email, password };
  if (isNative) {
    body.platform    = 'mobile';
    body.device_id   = await getOrCreateDeviceId();
    body.app_version = Constants.expoConfig?.version || '0.0.0';
  } else {
    body.platform = 'web';
  }
  const resp = await api.post('/auth/login', body, {
    headers: { 'Content-Type': 'application/json' },
  });
  await cacheCredentials(email, password, resp.data.access_token);
  await saveSession(resp.data.session);
  return resp.data;
}

/**
 * Attempt login using locally cached credentials (no network required).
 * Returns { ok: true } if credentials match, throws otherwise.
 */
export async function tryOfflineLogin(email, password) {
  const cachedEmail  = await secureGet('ekk_cached_email');
  const cachedHash   = await secureGet('ekk_cached_hash');
  const offlineToken = await secureGet('ekk_offline_token');

  if (!cachedEmail || !cachedHash || !offlineToken) {
    throw new Error('No offline credentials found. Please sign in online at least once.');
  }

  const enteredHash = await hashPassword(password);
  const emailMatch  = cachedEmail === email.toLowerCase().trim();
  const passMatch   = enteredHash === cachedHash;

  if (!emailMatch || !passMatch) {
    throw new Error('Incorrect email or password.');
  }

  const session = await getStoredSession();
  if (!session) {
    throw new Error('No cached project session found. Please sign in online once.');
  }

  // Restore active token so API calls work once network returns
  await secureSet('ekk_token', offlineToken);

  return { access_token: offlineToken, offline: true, session };
}

export async function logout() {
  try { await api.post('/auth/logout'); } catch (_) {}
  await secureDel('ekk_token');
  await clearSession();
}

export async function getToken() {
  return secureGet('ekk_token');
}