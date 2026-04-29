const SESSION_KEY = 'idms_session';
const TOKEN_KEY = 'token';
const USERNAME_KEY = 'username';
const PROJECT_KEY = 'selected_project_id';

export const getStoredSession = () => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const getAccessibleProjects = () => getStoredSession()?.projects || [];

export const getUserProfile = () => getStoredSession()?.user || null;

export const resolveSelectedProjectId = () => {
  const projects = getAccessibleProjects();
  if (!projects.length) return '';
  const stored = localStorage.getItem(PROJECT_KEY);
  if (stored && projects.some((project) => project.id === stored)) {
    return stored;
  }
  return projects[0].id;
};

export const saveSession = ({ accessToken, session }) => {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(USERNAME_KEY, session.user.username || session.user.email);
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  const selectedProjectId = resolveSelectedProjectId();
  if (selectedProjectId) {
    localStorage.setItem(PROJECT_KEY, selectedProjectId);
  }
  window.dispatchEvent(new Event('session-changed'));
  window.dispatchEvent(new Event('project-changed'));
};

export const clearSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USERNAME_KEY);
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(PROJECT_KEY);
  window.dispatchEvent(new Event('session-changed'));
  window.dispatchEvent(new Event('project-changed'));
};

export const setSelectedProjectId = (projectId) => {
  localStorage.setItem(PROJECT_KEY, projectId);
  window.dispatchEvent(new Event('project-changed'));
};

export const getSelectedProjectId = () => resolveSelectedProjectId();

export const getSelectedProject = () =>
  getAccessibleProjects().find((project) => project.id === getSelectedProjectId()) || null;

export const getCurrentProjectPermissions = () => getSelectedProject()?.permissions || {};

export const hasPermission = (moduleName, action) => {
  const permissions = getCurrentProjectPermissions();
  return Boolean(permissions?.[moduleName]?.[action]);
};