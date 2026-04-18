import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// localhost for browser, your IP for physical phone
//const API_BASE = 'http://localhost:8000';
export const API_BASE = 'http://192.168.0.102:8000';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
});

export function getApiErrorMessage(error) {
  if (error?.response?.data) {
    return JSON.stringify(error.response.data);
  }

  if (error?.message === 'Network Error') {
    return `Cannot reach API at ${API_BASE}. Check: phone and laptop on same Wi-Fi, URL opens in phone browser (/health), and app rebuilt after cleartext change.`;
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