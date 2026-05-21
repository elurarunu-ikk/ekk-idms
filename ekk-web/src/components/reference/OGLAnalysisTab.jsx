import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { downloadOGLAnalysis, listOGLAnalysisPaged } from '../../services/apiService';
import DataTable from './DataTable';

const fmt = (v, d = 4) => (v == null ? '—' : Number(v).toFixed(d));

const TYPE_STYLES = {
  CUT:  { bg: 'bg-red-900/20',   text: 'text-red-400',   badge: 'bg-red-900/50 text-red-300' },
  FILL: { bg: 'bg-green-900/20', text: 'text-green-400', badge: 'bg-green-900/50 text-green-300' },
  ZERO: { bg: 'bg-slate-800/60', text: 'text-slate-400', badge: 'bg-slate-700 text-slate-300' },
};

const COLUMNS = [
  { key: 'chainage',      label: 'Chainage',      width: 90 },
  { key: 'road_side',     label: 'Side',          width: 52 },
  { key: 'ogl_rl',        label: 'OGL RL',        width: 86, render: (v) => fmt(v) },
  { key: 'emb_frl',       label: 'EMB FRL',       width: 86, render: (v) => fmt(v) },
  {
    key: 'cut_fill_m',
    label: 'Cut/Fill (m)',
    width: 90,
    render: (v, row) => {
      const s = TYPE_STYLES[row.cut_fill_type] ?? TYPE_STYLES.ZERO;
      return (
        <span className={`font-mono font-semibold ${s.text}`}>
          {v != null ? (v > 0 ? '+' : '') + Number(v).toFixed(4) : '—'}
        </span>
      );
    },
  },
  {
    key: 'cut_fill_type',
    label: 'Type',
    width: 68,
    render: (v) => {
      const s = TYPE_STYLES[v] ?? TYPE_STYLES.ZERO;
      return (
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${s.badge}`}>{v ?? '—'}</span>
      );
    },
  },
  { key: 'volume_cum', label: 'Volume (m³)', width: 90, render: (v) => fmt(v, 2) },
];

const StatCard = ({ label, value, color = 'text-[#F1F5F9]', sub }) => (
  <div className="rounded-lg border border-[#1E293B] bg-[#0D1420] px-4 py-3">
    <p className="text-[10px] font-medium uppercase tracking-wide text-[#64748B]">{label}</p>
    <p className={`mt-0.5 text-xl font-bold ${color}`}>{value}</p>
    {sub && <p className="text-[10px] text-[#475569]">{sub}</p>}
  </div>
);

const OGLAnalysisTab = ({ projectId }) => {
  const [roadSide, setRoadSide] = useState(null);
  const [typeFilter, setTypeFilter] = useState(null);
  const [stats, setStats] = useState({ total: 0, cut: 0, fill: 0, zero: 0 });
  const [downloading, setDownloading] = useState(false);

  // Fetch stats (first call, skip=0, limit=1 just to get counts)
  useEffect(() => {
    if (!projectId) return;
    listOGLAnalysisPaged({ project_id: projectId, skip: 0, limit: 1 })
      .then((d) => setStats({ total: d.total, cut: d.cut_chainages, fill: d.fill_chainages, zero: d.zero_chainages }))
      .catch(() => {});
  }, [projectId]);

  const filters = { project_id: projectId, road_side: roadSide, cut_fill_type: typeFilter };

  const fetchPage = useCallback(
    (params) => listOGLAnalysisPaged(params),
    [projectId, roadSide, typeFilter]
  );

  const totalNz = stats.cut + stats.fill + stats.zero || 1;
  const cutPct  = Math.round((stats.cut  / totalNz) * 100);
  const fillPct = Math.round((stats.fill / totalNz) * 100);
  const zeroPct = 100 - cutPct - fillPct;

  const handleDownload = async () => {
    if (!projectId) return;
    setDownloading(true);
    try {
      const blob = await downloadOGLAnalysis(projectId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectId}_OGL_Analysis.xlsx`;
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

  const rowStyle = (row) => {
    const s = TYPE_STYLES[row.cut_fill_type];
    if (!s) return undefined;
    const bgs = { CUT: '#1A0A0A', FILL: '#0A1A0F', ZERO: '#0D1420' };
    return { background: bgs[row.cut_fill_type] ?? '#0D1420' };
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Records" value={stats.total.toLocaleString()} />
        <StatCard label="CUT" value={stats.cut.toLocaleString()} color="text-red-400" sub={`${cutPct}%`} />
        <StatCard label="FILL" value={stats.fill.toLocaleString()} color="text-green-400" sub={`${fillPct}%`} />
        <StatCard label="ZERO" value={stats.zero.toLocaleString()} color="text-slate-400" sub={`${zeroPct}%`} />
      </div>

      {/* Stacked bar */}
      {stats.total > 0 && (
        <div className="rounded-lg border border-[#1E293B] bg-[#0D1420] px-4 py-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">
            Cut / Fill / Zero Distribution
          </p>
          <div className="flex h-5 w-full overflow-hidden rounded-full bg-[#1E293B]">
            {cutPct  > 0 && <div className="h-full bg-red-500/70"   style={{ width: `${cutPct}%` }} title={`CUT ${cutPct}%`} />}
            {fillPct > 0 && <div className="h-full bg-green-500/70" style={{ width: `${fillPct}%` }} title={`FILL ${fillPct}%`} />}
            {zeroPct > 0 && <div className="h-full bg-slate-500/50" style={{ width: `${zeroPct}%` }} title={`ZERO ${zeroPct}%`} />}
          </div>
          <div className="mt-1.5 flex gap-4 text-[10px]">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500/70" />CUT {cutPct}%</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500/70" />FILL {fillPct}%</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-500/50" />ZERO {zeroPct}%</span>
          </div>
        </div>
      )}

      {/* Filters + download */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-[#64748B]">Side:</span>
        {[null, 'L', 'R'].map((side) => (
          <button
            key={side ?? 'all'}
            onClick={() => setRoadSide(side)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              roadSide === side
                ? 'border-[#3B82F6] bg-[#3B82F6] text-white'
                : 'border-[#1E293B] bg-[#0D1420] text-[#94A3B8] hover:border-[#334155]'
            }`}
          >
            {side ?? 'All'}
          </button>
        ))}

        <span className="ml-3 text-xs text-[#64748B]">Type:</span>
        {[null, 'CUT', 'FILL', 'ZERO'].map((t) => {
          const s = t ? TYPE_STYLES[t] : null;
          return (
            <button
              key={t ?? 'all'}
              onClick={() => setTypeFilter(t)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                typeFilter === t
                  ? t
                    ? `${s.badge} border-transparent`
                    : 'border-[#3B82F6] bg-[#3B82F6] text-white'
                  : 'border-[#1E293B] bg-[#0D1420] text-[#94A3B8] hover:border-[#334155]'
              }`}
            >
              {t ?? 'All'}
            </button>
          );
        })}

        <div className="ml-auto">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-1.5 rounded-lg border border-[#3B1E4E] bg-[#1A0D2E] px-3 py-1.5 text-xs font-medium text-[#C084FC] transition-colors hover:bg-[#3B1E4E] disabled:opacity-50"
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
        key={`ogla-${projectId}-${roadSide}-${typeFilter}`}
        columns={COLUMNS}
        fetchPage={fetchPage}
        filters={filters}
        rowStyle={rowStyle}
      />
    </div>
  );
};

export default OGLAnalysisTab;
