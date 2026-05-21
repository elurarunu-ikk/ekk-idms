import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  downloadLevelRegister,
  getLevelRegisterSummary,
  listLevelRegister,
} from '../../services/apiService';
import DataTable from './DataTable';

const LAYERS = ['EMB', 'SG', 'GSB', 'CTB', 'WMM', 'DBM', 'BC'];

const LAYER_COLORS = {
  EMB: { pill: 'bg-green-900/40 text-green-300 border-green-700', active: 'bg-green-600 text-white' },
  SG:  { pill: 'bg-amber-900/40 text-amber-300 border-amber-700', active: 'bg-amber-500 text-white' },
  GSB: { pill: 'bg-purple-900/40 text-purple-300 border-purple-700', active: 'bg-purple-600 text-white' },
  CTB: { pill: 'bg-red-900/40 text-red-300 border-red-700', active: 'bg-red-600 text-white' },
  WMM: { pill: 'bg-cyan-900/40 text-cyan-300 border-cyan-700', active: 'bg-cyan-600 text-white' },
  DBM: { pill: 'bg-orange-900/40 text-orange-300 border-orange-700', active: 'bg-orange-500 text-white' },
  BC:  { pill: 'bg-blue-900/40 text-blue-300 border-blue-700', active: 'bg-blue-600 text-white' },
};

const fmt = (v, d = 4) => (v == null ? '—' : Number(v).toFixed(d));

const COLUMNS = [
  { key: 'chainage',    label: 'Chainage',    width: 90 },
  { key: 'road_side',  label: 'Side',        width: 52 },
  { key: 'frl_center', label: 'FRL Center',  width: 90,  render: (v) => fmt(v) },
  { key: 'camber_pct', label: 'Camber%',     width: 72,  render: (v) => fmt(v, 2) },
  { key: 'camber_type',label: 'Camber Type', width: 90 },
  { key: 'road_width_m', label: 'Width(m)',  width: 72,  render: (v) => fmt(v, 2) },
  { key: 'rl_at_0m',  label: 'RL@0m',       width: 80,  render: (v) => fmt(v) },
  { key: 'rl_at_2m',  label: 'RL@2m',       width: 80,  render: (v) => fmt(v) },
  { key: 'rl_at_6m',  label: 'RL@6m',       width: 80,  render: (v) => fmt(v) },
  { key: 'rl_at_9_5m',label: 'RL@9.5m',     width: 80,  render: (v) => fmt(v) },
  { key: 'rl_at_11m', label: 'RL@11m',      width: 80,  render: (v) => fmt(v) },
  { key: 'rl_at_edge',label: 'RL@Edge',     width: 80,  render: (v) => fmt(v) },
  { key: 'tcs_ref',   label: 'TCS Ref',     width: 160 },
];

const StatCard = ({ label, value, sub }) => (
  <div className="rounded-lg border border-[#1E293B] bg-[#0D1420] px-4 py-3">
    <p className="text-[10px] font-medium uppercase tracking-wide text-[#64748B]">{label}</p>
    <p className="mt-0.5 text-xl font-bold text-[#F1F5F9]">{value}</p>
    {sub && <p className="text-[10px] text-[#475569]">{sub}</p>}
  </div>
);

const LevelRegisterTab = ({ projectId }) => {
  const [selectedLayer, setSelectedLayer] = useState(null);
  const [summary, setSummary] = useState(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    getLevelRegisterSummary(projectId)
      .then(setSummary)
      .catch(() => {});
  }, [projectId]);

  const filters = { project_id: projectId, layer_code: selectedLayer };

  const fetchPage = useCallback(
    (params) => listLevelRegister(params),
    [projectId, selectedLayer]
  );

  const handleDownload = async () => {
    if (!projectId) return;
    setDownloading(true);
    try {
      const blob = await downloadLevelRegister(projectId, selectedLayer);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectId}_Level_Register${selectedLayer ? `_${selectedLayer}` : ''}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Download failed');
    } finally {
      setDownloading(false);
    }
  };

  const totalRecords = summary?.layers?.reduce((s, l) => s + l.total_records, 0) ?? 0;
  const chMin = summary?.layers?.length
    ? Math.min(...summary.layers.map((l) => l.chainage_min))
    : null;
  const chMax = summary?.layers?.length
    ? Math.max(...summary.layers.map((l) => l.chainage_max))
    : null;
  const activeLayers = summary?.layers?.length ?? 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Records" value={totalRecords.toLocaleString()} />
        <StatCard label="Active Layers" value={activeLayers} />
        <StatCard
          label="Chainage Range"
          value={chMin != null ? `${chMin}` : '—'}
          sub={chMax != null ? `to ${chMax}` : undefined}
        />
        <StatCard
          label="Showing Layer"
          value={selectedLayer ?? 'All'}
          sub={
            selectedLayer && summary
              ? `${summary.layers.find((l) => l.layer_code === selectedLayer)?.total_records?.toLocaleString() ?? 0} records`
              : undefined
          }
        />
      </div>

      {/* Layer pills + download */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setSelectedLayer(null)}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            selectedLayer == null
              ? 'border-[#3B82F6] bg-[#3B82F6] text-white'
              : 'border-[#1E293B] bg-[#0D1420] text-[#94A3B8] hover:border-[#334155]'
          }`}
        >
          All
        </button>
        {LAYERS.map((lc) => {
          const colors = LAYER_COLORS[lc] ?? { pill: 'border-[#1E293B] bg-[#0D1420] text-[#94A3B8]', active: 'bg-[#3B82F6] text-white' };
          const count = summary?.layers?.find((l) => l.layer_code === lc)?.total_records;
          return (
            <button
              key={lc}
              onClick={() => setSelectedLayer(lc === selectedLayer ? null : lc)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                selectedLayer === lc ? colors.active : colors.pill
              }`}
            >
              {lc}
              {count != null && (
                <span className="ml-1 opacity-70">({count.toLocaleString()})</span>
              )}
            </button>
          );
        })}

        <div className="ml-auto">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-1.5 rounded-lg border border-[#1E3A5F] bg-[#0D1F3C] px-3 py-1.5 text-xs font-medium text-[#60A5FA] transition-colors hover:bg-[#1E3A5F] disabled:opacity-50"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {downloading ? 'Downloading…' : 'Export Excel'}
          </button>
        </div>
      </div>

      {/* Table */}
      <DataTable
        key={`lr-${projectId}-${selectedLayer}`}
        columns={COLUMNS}
        fetchPage={fetchPage}
        filters={filters}
      />
    </div>
  );
};

export default LevelRegisterTab;
