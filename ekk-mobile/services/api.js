import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform, NativeModules } from 'react-native';
import Constants from 'expo-constants';

const PUBLIC_API_BASE = 'https://solely-deposit-evanescence-jessica.trycloudflare.com';
function hostFromUri(raw) {
  if (!raw || typeof raw !== 'string') return '';
  try {
    // URL may be exp://, http://, or websocket forms in dev.
    return new URL(raw).hostname || '';
  } catch {
    // Fallback parser for non-standard URL strings.
    const cleaned = raw.replace(/^.*?:\/\//, '');
    return cleaned.split('/')[0].split(':')[0] || '';
  }
}

function detectRuntimeHost() {
  const fromExpoConfig = hostFromUri(Constants?.expoConfig?.hostUri);
  if (fromExpoConfig) return fromExpoConfig;

  const fromManifestHost = hostFromUri(Constants?.manifest2?.extra?.expoClient?.hostUri);
  if (fromManifestHost) return fromManifestHost;

  const scriptURL = NativeModules?.SourceCode?.scriptURL;
  const fromScript = hostFromUri(scriptURL);
  if (fromScript) return fromScript;

  return '';
}

// defaultPort: '80' for native (nginx), '8000' for web dev (direct API)
function normalizeApiBase(rawBase, defaultPort = '80', fallbackProtocol = 'http') {
  if (!rawBase || typeof rawBase !== 'string') return '';

  const trimmed = rawBase.trim().replace(/\/+$/, '');
  if (!trimmed) return '';

  const addPort = (parsed) => {
    // Only force port for http:// — https:// uses 443 by default and CDN/tunnel
    // hosts reject connections attempted on port 80 over HTTPS
    if (!parsed.port && parsed.protocol === 'http:') {
      parsed.port = defaultPort;
    }
    return parsed.toString().replace(/\/+$/, '');
  };

  try {
    return addPort(new URL(trimmed));
  } catch {
    const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
      ? trimmed
      : `${fallbackProtocol}://${trimmed}`;
    try {
      return addPort(new URL(withProtocol));
    } catch {
      return '';
    }
  }
}

function resolveApiBase() {
  if (Platform.OS === 'web') {
    const webHost = typeof window !== 'undefined' ? window.location.hostname : '';

    if (webHost.endsWith('.trycloudflare.com')) {
      return PUBLIC_API_BASE;
    }

    // Explicit override (e.g. EXPO_PUBLIC_WEB_API_BASE=http://myserver.local)
    const envWebBase = normalizeApiBase(process.env.EXPO_PUBLIC_WEB_API_BASE, '8000');
    if (envWebBase) return envWebBase;

    // Dynamic: mirror the browser's host, hit port 8000 directly (same machine, no firewall).
    if (webHost && webHost !== '127.0.0.1') {
      return `http://${webHost}:8000`;
    }

    return 'http://localhost:8000';
  }

  // Native (Android/iOS) — always go through nginx on port 80.
  // Port 8000 (direct API) is not reachable from other LAN devices on Mac/Docker Desktop.
  const envBase = normalizeApiBase(process.env.EXPO_PUBLIC_API_BASE, '80');
  if (envBase) return envBase;

  if (!__DEV__) {
    return PUBLIC_API_BASE;
  }

  const host = detectRuntimeHost();
  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    return `http://${host}`;  // port 80 via nginx
  }

  // Fallback for native APK/phone if runtime host cannot be detected.
  return 'http://192.168.1.22';  // port 80 via nginx
}

export const API_BASE = resolveApiBase();

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
});

export function getApiErrorMessage(error) {
  if (error?.response?.data) {
    return JSON.stringify(error.response.data);
  }

  if (error?.message === 'Network Error') {
    return `Cannot reach API at ${API_BASE}. Check: phone and laptop on same Wi-Fi, open ${API_BASE}/health in phone browser, and ensure backend is running.`;
  }

  return error?.message || 'Unknown error';
}

api.interceptors.request.use(async (config) => {
  try {
    const token = await SecureStore.getItemAsync('ekk_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  } catch (e) {
    // SecureStore not available on web — use localStorage
    const token = localStorage.getItem('ekk_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;