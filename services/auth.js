import api from './api';

const isWeb = typeof localStorage !== 'undefined';

async function saveToken(token) {
  if (isWeb) {
    localStorage.setItem('ekk_token', token);
  } else {
    const SecureStore = await import('expo-secure-store');
    await SecureStore.setItemAsync('ekk_token', token);
  }
}

export async function login(email, password) {
  const resp = await api.post(
    '/auth/login',
    { email, password },
    { headers: { 'Content-Type': 'application/json' } }
  );
  await saveToken(resp.data.access_token);
  return resp.data;
}

export async function logout() {
  if (isWeb) {
    localStorage.removeItem('ekk_token');
  } else {
    const SecureStore = await import('expo-secure-store');
    await SecureStore.deleteItemAsync('ekk_token');
  }
}

export async function getToken() {
  if (isWeb) return localStorage.getItem('ekk_token');
  const SecureStore = await import('expo-secure-store');
  return await SecureStore.getItemAsync('ekk_token');
}