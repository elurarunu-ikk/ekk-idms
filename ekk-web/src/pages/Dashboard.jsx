import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getDashboardStats, listCaptures } from '../services/apiService';
import LoadingSpinner from '../components/LoadingSpinner';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import useProjectSession from '../hooks/useProjectSession';

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { selectedProjectId, selectedProject, user } = useProjectSession();
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [recentEntries, setRecentEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      setLoading(true);
      try {
        const [statsData, entriesData] = await Promise.all([
          getDashboardStats(selectedProjectId),
          listCaptures({ project_id: selectedProjectId, skip: 0, limit: 50 }),
        ]);

        const sorted = [...(entriesData.entries || [])]
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, 10);

        setStats(statsData);
        setRecentEntries(sorted);
      } catch (err) {
        toast.error(err.response?.data?.detail || 'Something went wrong');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, [selectedProjectId]);

  const cards = useMemo(
    () => [
      { title: 'Total Entries', value: stats.total, color: 'gray' },
      { title: 'Pending', value: stats.pending, color: 'yellow', onClick: () => navigate('/pending') },
      { title: 'Approved', value: stats.approved, color: 'green' },
      { title: 'Rejected', value: stats.rejected, color: 'red' },
    ],
    [stats, navigate]
  );

  const displayName = user?.username || user?.email || '';

  if (loading) {
    return <LoadingSpinner fullPage={false} message="Loading dashboard..." />;
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {getGreeting()}{displayName ? `, ${displayName.split('@')[0]}` : ''}
          </h1>
          {selectedProject ? (
            <p className="mt-0.5 text-sm text-gray-500">
              {selectedProject.project_code} · {selectedProject.name}
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-gray-500">Overview across all projects</p>
          )}
        </div>
        <span className="text-sm text-gray-400">
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </span>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <StatCard key={card.title} {...card} />
        ))}
      </div>

      {/* Recent entries */}
      <div className="rounded-xl bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">Recent Entries</h2>
          <button
            type="button"
            onClick={() => navigate('/captures')}
            className="text-xs font-medium text-primary-600 hover:text-primary-700 transition"
          >
            View all →
          </button>
        </div>

        {recentEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-gray-400" aria-hidden="true">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-700">No entries yet</p>
            <p className="mt-1 text-xs text-gray-400">Captured entries will appear here</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                  <th className="px-6 py-3">Activity Code</th>
                  <th className="px-6 py-3">Stage</th>
                  <th className="px-6 py-3">Chainage From → To</th>
                  <th className="px-6 py-3">Contractor</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentEntries.map((entry) => (
                  <tr
                    key={entry.id}
                    onClick={() => navigate(`/captures/${entry.id}`)}
                    className="cursor-pointer transition-colors hover:bg-primary-50/50"
                  >
                    <td className="px-6 py-3.5 font-semibold text-gray-900">{entry.activity_code}</td>
                    <td className="px-6 py-3.5 text-gray-600">{entry.stage}</td>
                    <td className="px-6 py-3.5 text-gray-600">
                      {entry.chainage_from} → {entry.chainage_to}
                    </td>
                    <td className="px-6 py-3.5 text-gray-600">{entry.contractor_name}</td>
                    <td className="px-6 py-3.5">
                      <StatusBadge approved={entry.approved} rejected={entry.rejected} />
                    </td>
                    <td className="px-6 py-3.5 text-gray-400">
                      {new Date(entry.created_at).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
