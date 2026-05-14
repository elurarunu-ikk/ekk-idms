import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { listPending } from '../services/apiService';
import ChatWidget from './ChatWidget';
import useProjectSession from '../hooks/useProjectSession';
import { clearSession } from '../services/session';

const Icon = ({ path, className = 'h-[18px] w-[18px]' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d={path} />
  </svg>
);

const ICONS = {
  dashboard:
    'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  captures:
    'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
  pending:
    'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0',
  report:
    'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  chat:
    'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
  companies:
    'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  projects:
    'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
  users:
    'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  logout:
    'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1',
};

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: 'dashboard', permission: 'dashboard', end: true },
  { to: '/captures', label: 'Captures', icon: 'captures', permission: 'capture' },
  { to: '/pending', label: 'Pending', icon: 'pending', permission: 'approvals', badge: true },
  { to: '/report', label: 'Report', icon: 'report', permission: 'report' },
  { to: '/chat', label: 'AI Assistant', icon: 'chat', permission: 'chat' },
];

const ADMIN_ITEMS = [
  { to: '/companies', label: 'Companies', icon: 'companies', permission: 'companies' },
  { to: '/projects', label: 'Projects', icon: 'projects', permission: 'projects' },
  { to: '/users', label: 'Users', icon: 'users', permission: 'users' },
];

const Navbar = () => {
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState(0);
  const { user, projects, selectedProjectId, selectedProject, setSelectedProjectId, hasPermission } =
    useProjectSession();
  const username = user?.username || user?.email || 'User';
  const initial = username[0]?.toUpperCase() || 'U';

  useEffect(() => {
    const fetchPendingCount = async () => {
      try {
        const data = await listPending(selectedProjectId || undefined);
        setPendingCount(data.total || 0);
      } catch {
        setPendingCount(0);
      }
    };
    if (selectedProjectId) fetchPendingCount();
  }, [selectedProjectId]);

  const handleLogout = () => {
    clearSession();
    navigate('/login');
  };

  const linkClass = ({ isActive }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
      isActive
        ? 'bg-primary-50 text-primary-700'
        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
    }`;

  const hasAdminItems = ADMIN_ITEMS.some(({ permission }) => hasPermission(permission, 'view'));

  return (
    <div className="flex min-h-screen bg-surface-50">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col border-r border-gray-100 bg-white shadow-sidebar">
        {/* Logo */}
        <div className="flex h-16 flex-shrink-0 items-center gap-3 border-b border-gray-100 px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-xs font-black text-white">
            EKK
          </div>
          <span className="text-base font-bold text-gray-900">IDMS</span>
        </div>

        {/* Project selector */}
        {projects.length > 0 && (
          <div className="border-b border-gray-100 px-4 py-3">
            {projects.length > 1 ? (
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs font-medium text-gray-700 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.project_code} · {project.name}
                  </option>
                ))}
              </select>
            ) : selectedProject ? (
              <div className="rounded-lg bg-primary-50 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-primary-500">
                  Active Project
                </p>
                <p className="mt-0.5 truncate text-xs font-semibold text-primary-900">
                  {selectedProject.project_code} · {selectedProject.name}
                </p>
              </div>
            ) : null}
          </div>
        )}

        {/* Main nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-0.5">
            {NAV_ITEMS.map(({ to, label, icon, permission, badge, end }) =>
              hasPermission(permission, 'view') ? (
                <NavLink key={to} to={to} end={end} className={linkClass}>
                  <Icon path={ICONS[icon]} />
                  <span className="flex-1">{label}</span>
                  {badge && pendingCount > 0 && (
                    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                      {pendingCount}
                    </span>
                  )}
                </NavLink>
              ) : null
            )}
          </div>

          {hasAdminItems && (
            <div className="mt-6">
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Administration
              </p>
              <div className="space-y-0.5">
                {ADMIN_ITEMS.map(({ to, label, icon, permission }) =>
                  hasPermission(permission, 'view') ? (
                    <NavLink key={to} to={to} className={linkClass}>
                      <Icon path={ICONS[icon]} />
                      <span>{label}</span>
                    </NavLink>
                  ) : null
                )}
              </div>
            </div>
          )}
        </nav>

        {/* User profile */}
        <div className="border-t border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900">{username}</p>
              <p className="text-xs text-gray-400">Signed in</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="Sign out"
              className="rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-500"
            >
              <Icon path={ICONS.logout} className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex min-h-screen flex-1 flex-col pl-60">
        <main className="flex-1 p-6">
          <Outlet />
        </main>
        {hasPermission('chat', 'view') && <ChatWidget />}
      </div>
    </div>
  );
};

export default Navbar;
