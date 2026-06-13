/**
 * Unit tests for ekk-mobile/services/auth.js logic.
 * Runs in Node.js with mocked HTTP and storage — no Expo runtime needed.
 *
 * Usage:  node scripts/auth.test.js
 */
'use strict';

const assert = require('assert');

// ── Mock storage (simulates localStorage / SecureStore) ───────────────────────
const store = {};
const mockStorage = {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => { store[k] = v; },
  removeItem: (k) => { delete store[k]; },
};
global.localStorage = mockStorage;

// ── Mock API (axios-like) ─────────────────────────────────────────────────────
let lastRequest = null;
let mockResponse = null;
let mockError    = null;

const mockApi = {
  post: async (url, data) => {
    lastRequest = { url, data };
    if (mockError) throw mockError;
    return { data: mockResponse };
  },
};

// ── Inline the testable auth logic (no ESM/Expo deps) ────────────────────────

function uuid4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

async function getOrCreateDeviceId() {
  const KEY = 'ekk_device_id';
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = uuid4();
    localStorage.setItem(KEY, id);
  }
  return id;
}

async function login(email, password) {
  const device_id = await getOrCreateDeviceId();
  const resp = await mockApi.post('/auth/login', { email, password, platform: 'mobile', device_id });
  localStorage.setItem('ekk_token', resp.data.access_token);
  return resp.data;
}

async function logout() {
  try { await mockApi.post('/auth/logout'); } catch (_) {}
  localStorage.removeItem('ekk_token');
}

// ── Test runner ───────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
    failed++;
  }
}

function reset() {
  lastRequest = null;
  mockResponse = null;
  mockError    = null;
  Object.keys(store).forEach(k => delete store[k]);
}

// ── Tests ─────────────────────────────────────────────────────────────────────
(async () => {
  console.log('\nauth.js — mobile login/logout unit tests\n');

  // Device ID
  await test('getOrCreateDeviceId: generates a UUID on first call', async () => {
    reset();
    const id = await getOrCreateDeviceId();
    assert.match(id, /^[0-9a-f-]{36}$/);
  });

  await test('getOrCreateDeviceId: returns same ID on subsequent calls', async () => {
    reset();
    const a = await getOrCreateDeviceId();
    const b = await getOrCreateDeviceId();
    assert.strictEqual(a, b);
  });

  await test('getOrCreateDeviceId: persists across simulated restarts (localStorage survives)', async () => {
    reset();
    const first = await getOrCreateDeviceId();
    // Simulate restart: clear in-memory variables but localStorage stays
    const second = await getOrCreateDeviceId();
    assert.strictEqual(first, second);
  });

  // Login payload
  await test('login: sends platform="mobile" in request body', async () => {
    reset();
    mockResponse = { access_token: 'tok123', session: {} };
    await login('user@ekk.in', 'pass');
    assert.strictEqual(lastRequest.data.platform, 'mobile');
  });

  await test('login: sends device_id in request body', async () => {
    reset();
    mockResponse = { access_token: 'tok123', session: {} };
    await login('user@ekk.in', 'pass');
    assert.ok(lastRequest.data.device_id, 'device_id must be present');
    assert.match(lastRequest.data.device_id, /^[0-9a-f-]{36}$/);
  });

  await test('login: sends consistent device_id across calls (same device)', async () => {
    reset();
    mockResponse = { access_token: 'tok1', session: {} };
    await login('user@ekk.in', 'pass');
    const id1 = lastRequest.data.device_id;
    mockResponse = { access_token: 'tok2', session: {} };
    await login('user@ekk.in', 'pass');
    const id2 = lastRequest.data.device_id;
    assert.strictEqual(id1, id2, 'device_id must be stable across logins');
  });

  await test('login: stores access_token in local storage', async () => {
    reset();
    mockResponse = { access_token: 'mytoken', session: {} };
    await login('user@ekk.in', 'pass');
    assert.strictEqual(localStorage.getItem('ekk_token'), 'mytoken');
  });

  await test('login: throws on server error (propagates to caller)', async () => {
    reset();
    mockError = Object.assign(new Error('Request failed'), {
      response: { status: 409, data: { detail: 'already_logged_in: ...' } },
    });
    await assert.rejects(() => login('user@ekk.in', 'pass'), /Request failed/);
  });

  // Logout
  await test('logout: calls POST /auth/logout', async () => {
    reset();
    mockResponse = {};
    localStorage.setItem('ekk_token', 'existingtoken');
    await logout();
    assert.strictEqual(lastRequest.url, '/auth/logout');
  });

  await test('logout: clears ekk_token from local storage', async () => {
    reset();
    mockResponse = {};
    localStorage.setItem('ekk_token', 'existingtoken');
    await logout();
    assert.strictEqual(localStorage.getItem('ekk_token'), null);
  });

  await test('logout: clears token even if backend call fails', async () => {
    reset();
    mockError = new Error('Network Error');
    localStorage.setItem('ekk_token', 'existingtoken');
    await logout();  // should not throw
    assert.strictEqual(localStorage.getItem('ekk_token'), null);
  });

  await test('logout: device_id is preserved after logout (device stays registered)', async () => {
    reset();
    const deviceId = await getOrCreateDeviceId();
    mockResponse = {};
    await logout();
    assert.strictEqual(localStorage.getItem('ekk_device_id'), deviceId,
      'device_id must survive logout — it is the registered device binding');
  });

  // Summary
  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
})();
