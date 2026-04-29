import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { listPending } from '../services/apiService';
import ChatWidget from './ChatWidget';
import useProjectSession from '../hooks/useProjectSession';
import { clearSession } from '../services/session';

const Navbar = () => {
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState(0);
  const { user, projects, selectedProjectId, selectedProject, setSelectedProjectId, hasPermission } = useProjectSession();
  const username = user?.username || user?.email || 'User';

  useEffect(() => {
    const fetchPendingCount = async () => {
      try {
        const data = await listPending(selectedProjectId || undefined);
        setPendingCount(data.total || 0);
      } catch (_error) {
        setPendingCount(0);
      }
    };

    if (selectedProjectId) {
      fetchPendingCount();
    }
  }, [selectedProjectId]);

  const handleLogout = () => {
    clearSession();
    navigate('/login');
  };

  const linkClass = ({ isActive }) =>
    `rounded-lg px-3 py-2 text-sm font-medium transition ${
      isActive ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
    }`;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-8">
            <Link to="/" className="text-xl font-bold text-blue-600">
              IDMS
            </Link>

            <nav className="flex items-center gap-2">
              {hasPermission('dashboard', 'view') && <NavLink to="/" className={linkClass} end>
                Dashboard
              </NavLink>}
              {hasPermission('capture', 'view') && <NavLink to="/captures" className={linkClass}>
                Captures
              </NavLink>}
              {hasPermission('approvals', 'view') && <NavLink to="/pending" className={linkClass}>
                Pending
                {pendingCount > 0 && (
                  <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                    {pendingCount}
                  </span>
                )}
              </NavLink>}
              {hasPermission('report', 'view') && <NavLink to="/report" className={linkClass}>
                Report
              </NavLink>}
              {hasPermission('chat', 'view') && <NavLink to="/chat" className={linkClass}>
                AI Assistant
              </NavLink>}
              {hasPermission('companies', 'view') && <NavLink to="/companies" className={linkClass}>
                Companies
              </NavLink>}
              {hasPermission('projects', 'view') && <NavLink to="/projects" className={linkClass}>
                Projects
              </NavLink>}
              {hasPermission('users', 'view') && <NavLink to="/users" className={linkClass}>
                Users
              </NavLink>}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {projects.length > 1 && (
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.project_code} · {project.name}
                  </option>
                ))}
              </select>
            )}
            {selectedProject && projects.length <= 1 && (
              <span className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-medium text-gray-700">
                {selectedProject.project_code}
              </span>
            )}
            <span className="text-sm text-gray-600">{username}</span>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6">
        <Outlet />
      </main>
      {hasPermission('chat', 'view') && <ChatWidget />}
    </div>
  );
};

export default Navbar;