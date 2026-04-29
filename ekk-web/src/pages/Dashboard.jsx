import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getDashboardStats, listCaptures } from '../services/apiService';
import LoadingSpinner from '../components/LoadingSpinner';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import useProjectSession from '../hooks/useProjectSession';

const Dashboard = () => {
  const navigate = useNavigate();
  const { selectedProjectId, selectedProject } = useProjectSession();
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
      {
        title: 'Pending',
        value: stats.pending,
        color: 'yellow',
        onClick: () => navigate('/pending'),
      },
      { title: 'Approved', value: stats.approved, color: 'green' },
      { title: 'Rejected', value: stats.rejected, color: 'red' },
    ],
    [stats, navigate]
  );

  if (loading) {
    return <LoadingSpinner fullPage={false} message="Loading dashboard..." />;
  }

  return (
    <div className="space-y-6">
      {selectedProject && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          Viewing dashboard for <span className="font-semibold">{selectedProject.project_code} - {selectedProject.name}</span>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <StatCard key={card.title} {...card} />
        ))}
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Recent Entries</h2>

        {recentEntries.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">No entries found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-600">
                  <th className="px-3 py-2">Activity Code</th>
                  <th className="px-3 py-2">Stage</th>
                  <th className="px-3 py-2">Chainage From→To</th>
                  <th className="px-3 py-2">Contractor</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentEntries.map((entry, index) => (
                  <tr
                    key={entry.id}
                    onClick={() => navigate(`/captures/${entry.id}`)}
                    className={`cursor-pointer border-b border-gray-100 hover:bg-blue-50 ${
                      index % 2 === 1 ? 'bg-gray-50' : 'bg-white'
                    }`}
                  >
                    <td className="px-3 py-3 font-medium text-gray-900">{entry.activity_code}</td>
                    <td className="px-3 py-3">{entry.stage}</td>
                    <td className="px-3 py-3">
                      {entry.chainage_from} → {entry.chainage_to}
                    </td>
                    <td className="px-3 py-3">{entry.contractor_name}</td>
                    <td className="px-3 py-3">
                      <StatusBadge approved={entry.approved} rejected={entry.rejected} />
                    </td>
                    <td className="px-3 py-3 text-gray-600">
                      {new Date(entry.created_at).toLocaleString()}
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