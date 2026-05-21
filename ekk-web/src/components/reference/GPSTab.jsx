import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { downloadGPS, listGPS } from '../../services/apiService';
import DataTable from './DataTable';

const fmtCoord = (v) => (v == null ? '—' : Number(v).toFixed(6));
const fmtAlt   = (v) => (v == null ? '—' : Number(v).toFixed(1) + ' m');

const COLUMNS = [
  { key: 'chainage_from', label: 'CH From',   width: 80 },
  { key: 'chainage_to',   label: 'CH To',     width: 80 },
  { key: 'nh_number',     label: 'NH No.',    width: 72 },
  { key: 'state',         label: 'State',     width: 100 },
  { key: 'district',      label: 'District',  width: 110 },
  { key: 'piu',           label: 'PIU',       width: 120 },
  { key: 'lat_start',     label: 'Lat Start', width: 100, render: (v) => fmtCoord(v) },
  { key: 'lon_start',     label: 'Lon Start', width: 100, render: (v) => fmtCoord(v) },
  { key: 'alt_start_m',   label: 'Alt Start', width: 82,  render: (v) => fmtAlt(v) },
  { key: 'lat_end',       label: 'Lat End',   width: 100, render: (v) => fmtCoord(v) },
  { key: 'lon_end',       label: 'Lon End',   width: 100, render: (v) => fmtCoord(v) },
  { key: 'alt_end_m',     label: 'Alt End',   width: 82,  render: (v) => fmtAlt(v) },
];

const StatCard = ({ label, value, sub }) => (
  <div className="rounded-lg border border-[#1E293B] bg-[#0D1420] px-4 py-3">
    <p className="text-[10px] font-medium uppercase tracking-wide text-[#64748B]">{label}</p>
    <p className="mt-0.5 text-xl font-bold text-[#F1F5F9]">{value}</p>
    {sub && <p className="text-[10px] text-[#475569]">{sub}</p>}
  </div>
);

const GPSTab = ({ projectId }) => {
  const [summary, setSummary] = useState({ total: null, chMin: null, chMax: null });
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    listGPS({ project_id: projectId })
      .then((d) => {
        const entries = d.entries ?? [];
        const chMin = entries.length ? Math.min(...entries.map((e) => e.chainage_from)) : null;
        const chMax = entries.length ? Math.max(...entries.map((e) => e.chainage_to)) : null;
        setSummary({ total: d.total ?? 0, chMin, chMax });
      })
      .catch(() => {});
  }, [projectId]);

  const filters = { project_id: projectId };

  const fetchPage = useCallback(
    (params) => listGPS(params),
    [projectId]
  );

  const handleDownload = async () => {
    if (!projectId) return;
    setDownloading(true);
    try {
      const blob = await downloadGPS(projectId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectId}_GPS.xlsx`;
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
        <StatCard
          label="GPS Segments"
          value={summary.total != null ? summary.total.toLocaleString() : '—'}
        />
        <StatCard
          label="CH Start"
          value={summary.chMin != null ? summary.chMin.toLocaleString() : '—'}
          sub="chainage from"
        />
        <StatCard
          label="CH End"
          value={summary.chMax != null ? summary.chMax.toLocaleString() : '—'}
          sub="chainage to"
        />
      </div>

      {/* Download button */}
      <div className="flex items-center">
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex items-center gap-1.5 rounded-lg border border-[#0C3A5E] bg-[#061D30] px-3 py-1.5 text-xs font-medium text-[#38BDF8] transition-colors hover:bg-[#0C3A5E] disabled:opacity-50"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          {downloading ? 'Downloading…' : 'Export Excel'}
        </button>
      </div>

      {/* Table */}
      <DataTable
        key={`gps-${projectId}`}
        columns={COLUMNS}
        fetchPage={fetchPage}
        filters={filters}
      />
    </div>
  );
};

export default GPSTab;
