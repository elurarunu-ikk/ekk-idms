import * as SecureStore from 'expo-secure-store';

const isWeb = typeof localStorage !== 'undefined';

const SESSION_KEY = 'ekk_session';
const SELECTED_PROJECT_KEY = 'ekk_selected_project_id';

async function secureSet(key, value) {
  if (isWeb) {
    localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function secureGet(key) {
  if (isWeb) {
    return localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function secureDel(key) {
  if (isWeb) {
    localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export async function saveSession(session) {
  if (!session) return;
  await secureSet(SESSION_KEY, JSON.stringify(session));

  const projects = Array.isArray(session.projects) ? session.projects : [];
  if (!projects.length) {
    await secureDel(SELECTED_PROJECT_KEY);
    return;
  }

  const existing = await secureGet(SELECTED_PROJECT_KEY);
  const selected = projects.some((project) => project.id === existing) ? existing : projects[0].id;
  if (selected) {
    await secureSet(SELECTED_PROJECT_KEY, selected);
  }
}

export async function getStoredSession() {
  const raw = await secureGet(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function getAccessibleProjects() {
  const session = await getStoredSession();
  return Array.isArray(session?.projects) ? session.projects : [];
}

export async function getSelectedProjectId() {
  const projects = await getAccessibleProjects();
  if (!projects.length) return '';
  const stored = await secureGet(SELECTED_PROJECT_KEY);
  if (stored && projects.some((project) => project.id === stored)) {
    return stored;
  }
  return projects[0].id;
}

export async function setSelectedProjectId(projectId) {
  if (!projectId) {
    await secureDel(SELECTED_PROJECT_KEY);
    return;
  }
  await secureSet(SELECTED_PROJECT_KEY, projectId);
}

export async function getSelectedProject() {
  const projects = await getAccessibleProjects();
  const selectedProjectId = await getSelectedProjectId();
  return projects.find((project) => project.id === selectedProjectId) || null;
}

export async function clearSession() {
  await secureDel(SESSION_KEY);
  await secureDel(SELECTED_PROJECT_KEY);
}
