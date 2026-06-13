import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getDashboardStats, listCaptures, getLevelRegisterSummary, getCapturesByLayer } from '../services/apiService';
import { formatChainage, formatChainageRange, getWorkTypeLabel, getLayerLabel } from '../utils/captureUtils';
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
  const [levelSummary, setLevelSummary] = useState([]);
  const [capturesByLayer, setCapturesByLayer] = useState([]);
  const [referenceLoading, setReferenceLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      setLoading(true);
      setReferenceLoading(true);
      try {
        const levelProjectId = selectedProject?.project_code || 'VSRP';
        const [statsData, entriesData, levelData, layerData] = await Promise.all([
          getDashboardStats(selectedProjectId),
          listCaptures({ project_id: selectedProjectId, skip: 0, limit: 50 }),
          getLevelRegisterSummary(levelProjectId),
          getCapturesByLayer(selectedProjectId),
        ]);

        const sorted = [...(entriesData.entries || [])]
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, 10);

        setStats(statsData);
        setRecentEntries(sorted);
        setLevelSummary(levelData?.layers || []);
        setCapturesByLayer(layerData || []);
      } catch (err) {
        toast.error(err.response?.data?.detail || 'Something went wrong');
      } finally {
        setLoading(false);
        setReferenceLoading(false);
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
      {/* Mobile app download banner */}
      <a
        href="/downloads/ekk-idms.apk"
        download
        className="flex items-center justify-between gap-3 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 px-5 py-3 text-white shadow-sm transition hover:from-primary-700 hover:to-primary-800"
      >
        <div className="flex items-center gap-3">
          <svg className="h-6 w-6 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 18.5l-4-4m4 4l4-4m-4 4V5M5 20h14" />
          </svg>
          <div>
            <p className="text-sm font-semibold leading-tight">Download EKK IDMS Mobile App</p>
            <p className="text-xs text-primary-200">Android APK · ekk-idms.apk</p>
          </div>
        </div>
        <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">Download APK</span>
      </a>

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

      {/* Project info banner */}
      {selectedProject && (
        <div className="rounded-xl border border-primary-100 bg-primary-50 px-5 py-3.5
                        flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg
                            bg-primary-600 text-xs font-black text-white flex-shrink-0">
              {selectedProject.project_code?.slice(0, 2)}
            </div>
            <div>
              <p className="text-sm font-semibold text-primary-900">{selectedProject.name}</p>
              <p className="text-xs text-primary-600">{selectedProject.project_code}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-primary-700">
            <span>
              <span className="font-semibold">{levelSummary.length}</span> layers loaded
            </span>
            <span>
              <span className="font-semibold">
                {levelSummary.reduce((s, l) => s + l.total_records, 0).toLocaleString()}
              </span> level register records
            </span>
            <span>
              <span className="font-semibold">{stats.total}</span> total captures
            </span>
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <StatCard key={card.title} {...card} />
        ))}
      </div>

      {/* Level Register Coverage */}
      {!referenceLoading && levelSummary.length > 0 && (
        <div className="rounded-xl bg-white shadow-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Level Register Coverage</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Design data loaded per layer · {levelSummary.reduce((s, l) => s + l.total_records, 0).toLocaleString()} total records
              </p>
            </div>
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
              {levelSummary.length} layers loaded
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  <th className="px-6 py-3">Layer</th>
                  <th className="px-6 py-3">Records</th>
                  <th className="px-6 py-3">Chainage Range</th>
                  <th className="px-6 py-3">Coverage (km)</th>
                  <th className="px-6 py-3">FRL Range (m)</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[...levelSummary]
                  .sort((a, b) => {
                    const order = ['EMB','SG','GSB','CTSB','CTB','WMM','BASE','DBM','BC','SDBC'];
                    return (order.indexOf(a.layer_code) ?? 99) - (order.indexOf(b.layer_code) ?? 99);
                  })
                  .map(layer => {
                    const coverageM = layer.chainage_max - layer.chainage_min;
                    const coverageKm = (coverageM / 1000).toFixed(2);
                    return (
                      <tr key={layer.layer_code} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-2">
                            <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                            <span className="font-medium text-gray-900">
                              {getLayerLabel(layer.layer_code)}
                            </span>
                            <span className="font-mono text-xs text-gray-400">({layer.layer_code})</span>
                          </div>
                        </td>
                        <td className="px-6 py-3.5 text-gray-700">
                          {layer.total_records.toLocaleString()}
                        </td>
                        <td className="px-6 py-3.5 font-mono text-xs text-gray-700">
                          {formatChainage(layer.chainage_min / 1000)} → {formatChainage(layer.chainage_max / 1000)}
                        </td>
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="w-24 bg-gray-100 rounded-full h-1.5">
                              <div
                                className="bg-green-500 h-1.5 rounded-full"
                                style={{ width: `${Math.min(100, (parseFloat(coverageKm) / 66) * 100)}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-600">{coverageKm} km</span>
                          </div>
                        </td>
                        <td className="px-6 py-3.5 text-xs text-gray-500 font-mono">
                          {layer.frl_min?.toFixed(3)} — {layer.frl_max?.toFixed(3)}
                        </td>
                        <td className="px-6 py-3.5">
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100
                                           px-2.5 py-1 text-xs font-medium text-green-700">
                            ✓ Loaded
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Capture Progress by Layer */}
      {!referenceLoading && capturesByLayer.length > 0 && (
        <div className="rounded-xl bg-white shadow-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Capture Progress by Layer</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                All field captures grouped by work type and layer
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  <th className="px-6 py-3">Work Type</th>
                  <th className="px-6 py-3">Layer</th>
                  <th className="px-6 py-3 text-center">Total</th>
                  <th className="px-6 py-3 text-center">Approved</th>
                  <th className="px-6 py-3 text-center">Pending</th>
                  <th className="px-6 py-3 text-center">Rejected</th>
                  <th className="px-6 py-3 text-right">Total LM</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {capturesByLayer.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3.5">
                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                        {getWorkTypeLabel(row.work_type)}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-gray-700">
                      {row.layer_code === '—' ? (
                        <span className="text-gray-400 italic text-xs">—</span>
                      ) : (
                        getLayerLabel(row.layer_code)
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-center font-semibold text-gray-900">
                      {row.total}
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      {row.approved > 0 ? (
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full
                                         bg-green-100 text-green-700 text-xs font-semibold">
                          {row.approved}
                        </span>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      {row.pending > 0 ? (
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full
                                         bg-amber-100 text-amber-700 text-xs font-semibold">
                          {row.pending}
                        </span>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      {row.rejected > 0 ? (
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full
                                         bg-red-100 text-red-700 text-xs font-semibold">
                          {row.rejected}
                        </span>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono text-xs text-gray-700">
                      {row.total_lm > 0
                        ? row.total_lm >= 1000
                          ? `${(row.total_lm / 1000).toFixed(2)} km`
                          : `${row.total_lm.toFixed(0)} LM`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
                    <td className="px-6 py-3.5 text-gray-600 font-mono text-xs">
                      {formatChainageRange(entry.chainage_from, entry.chainage_to)}
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
