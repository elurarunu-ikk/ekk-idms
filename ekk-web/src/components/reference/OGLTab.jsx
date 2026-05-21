import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { downloadOGL, listOGL } from '../../services/apiService';
import DataTable from './DataTable';

const fmt = (v, d = 4) => (v == null ? '—' : Number(v).toFixed(d));

const COLUMNS = [
  { key: 'chainage',   label: 'Chainage',    width: 90 },
  { key: 'road_side',  label: 'Side',        width: 52 },
  { key: 'ogl_cl',     label: 'OGL CL RL',   width: 90, render: (v) => fmt(v) },
  { key: 'frl_center', label: 'FRL Center',  width: 90, render: (v) => fmt(v) },
  { key: 'rl_at_2m',   label: 'RL@2m',       width: 80, render: (v) => fmt(v) },
  { key: 'rl_at_6m',   label: 'RL@6m',       width: 80, render: (v) => fmt(v) },
  { key: 'rl_at_edge', label: 'RL@Edge',     width: 80, render: (v) => fmt(v) },
  { key: 'version',    label: 'Ver',         width: 44 },
];

const StatCard = ({ label, value, sub }) => (
  <div className="rounded-lg border border-[#1E293B] bg-[#0D1420] px-4 py-3">
    <p className="text-[10px] font-medium uppercase tracking-wide text-[#64748B]">{label}</p>
    <p className="mt-0.5 text-xl font-bold text-[#F1F5F9]">{value}</p>
    {sub && <p className="text-[10px] text-[#475569]">{sub}</p>}
  </div>
);

const OGLTab = ({ projectId }) => {
  const [roadSide, setRoadSide] = useState(null);
  const [totalCount, setTotalCount] = useState(null);
  const [downloading, setDownloading] = useState(false);

  // Get total count for stats (load first page and capture total)
  useEffect(() => {
    if (!projectId) return;
    listOGL({ project_id: projectId, skip: 0, limit: 1 })
      .then((d) => setTotalCount(d.total ?? 0))
      .catch(() => {});
  }, [projectId]);

  const filters = { project_id: projectId, road_side: roadSide };

  const fetchPage = useCallback(
    (params) => listOGL(params),
    [projectId, roadSide]
  );

  const handleDownload = async () => {
    if (!projectId) return;
    setDownloading(true);
    try {
      const blob = await downloadOGL(projectId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectId}_OGL.xlsx`;
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

  return (
    <div className="flex flex-col gap-4">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Total OGL Records" value={(totalCount ?? '—').toLocaleString?.() ?? '—'} />
        <StatCard label="Data Type" value="OGL" sub="Original Ground Level" />
        <StatCard label="Sides" value="L + R" sub="Both road sides" />
      </div>

      {/* Side filter + download */}
      <div className="flex items-center gap-2">
        {[null, 'L', 'R'].map((side) => (
          <button
            key={side ?? 'all'}
            onClick={() => setRoadSide(side)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              roadSide === side
                ? 'border-[#10B981] bg-[#10B981] text-white'
                : 'border-[#1E293B] bg-[#0D1420] text-[#94A3B8] hover:border-[#334155]'
            }`}
          >
            {side ?? 'All'}
          </button>
        ))}

        <div className="ml-auto">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-1.5 rounded-lg border border-[#134E2A] bg-[#0A2A1A] px-3 py-1.5 text-xs font-medium text-[#34D399] transition-colors hover:bg-[#134E2A] disabled:opacity-50"
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
        key={`ogl-${projectId}-${roadSide}`}
        columns={COLUMNS}
        fetchPage={fetchPage}
        filters={filters}
      />
    </div>
  );
};

export default OGLTab;
