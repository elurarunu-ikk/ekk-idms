import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform, NativeModules } from 'react-native';
import Constants from 'expo-constants';

const PUBLIC_API_BASE = 'https://pray-fur-hart-favourite.trycloudflare.com';

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

function resolveApiBase() {
  if (Platform.OS === 'web') {
    const webHost = typeof window !== 'undefined' ? window.location.hostname : '';
    if (webHost.endsWith('.trycloudflare.com')) {
      // External testers on mobile must call the public API URL, not localhost.
      return PUBLIC_API_BASE;
    }

    const envWebBase = process.env.EXPO_PUBLIC_WEB_API_BASE?.trim() || process.env.EXPO_PUBLIC_API_BASE?.trim();
    if (envWebBase) return envWebBase;

    return 'http://localhost:8000';
  }

  const envBase = process.env.EXPO_PUBLIC_API_BASE?.trim();
  if (envBase) return envBase;

  if (!__DEV__) {
    return PUBLIC_API_BASE;
  }

  const host = detectRuntimeHost();
  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    return `http://${host}:8000`;
  }

  // Fallback for phone/LAN if runtime host cannot be detected.
  //return 'http://192.168.0.102:8000';
  return 'http://192.168.1.242:8000';
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