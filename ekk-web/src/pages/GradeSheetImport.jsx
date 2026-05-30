import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';
import useProjectSession from '../hooks/useProjectSession';
import {
  getApiErrorMessage,
  getLevelRegisterSummary,
  uploadGradeSheet,
} from '../services/apiService';

const LAYER_ORDER = ['EMB', 'SG', 'GSB', 'CTSB', 'CTB', 'WMM', 'DBM', 'BC'];

const sortLayers = (layers) =>
  [...layers].sort(
    (a, b) =>
      (LAYER_ORDER.indexOf(a.layer_code) + 1 || 99) -
      (LAYER_ORDER.indexOf(b.layer_code) + 1 || 99)
  );

const GradeSheetImport = () => {
  const { selectedProject } = useProjectSession();
  const fileRef = useRef(null);

  const [projectId, setProjectId] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // Pre-fill project_id from selected project code
  useEffect(() => {
    if (selectedProject?.project_code) {
      setProjectId(selectedProject.project_code);
    }
  }, [selectedProject]);

  const loadSummary = async (pid) => {
    if (!pid?.trim()) return;
    setLoadingSummary(true);
    try {
      const data = await getLevelRegisterSummary(pid.trim());
      setSummary(data);
    } catch {
      setSummary(null);
    } finally {
      setLoadingSummary(false);
    }
  };

  // Load status on mount once project_id is known
  useEffect(() => {
    if (projectId) loadSummary(projectId);
  }, [projectId]);

  const handleUpload = async () => {
    if (!projectId.trim()) {
      toast.error('Enter a Project ID');
      return;
    }
    if (!file) {
      toast.error('Select an .xlsx file first');
      return;
    }

    setUploading(true);
    setResult(null);
    try {
      const data = await uploadGradeSheet(projectId.trim(), file);
      setResult(data);
      toast.success(data.message);
      loadSummary(projectId.trim());
      // Reset file input
      if (fileRef.current) fileRef.current.value = '';
      setFile(null);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Grade Sheet Import</h1>
        <p className="mt-1 text-sm text-gray-500">
          Upload the site Grade Sheet (.xlsx). All layer sheets (BC, DBM, WMM, CTB, GSB,
          SUBGRADE, EMBANKMENT TOP), OGL, and GPS are parsed automatically — no
          reformatting needed.
        </p>
      </div>

      {/* Upload card */}
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-gray-700">Upload Grade Sheet</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Project ID
            </label>
            <input
              type="text"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              placeholder="e.g. TBRP"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
            <p className="mt-1 text-[10px] text-gray-400">
              Must match the project_id used in layer config (e.g. TBRP)
            </p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Grade Sheet File (.xlsx only)
            </label>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx"
              onChange={(e) => setFile(e.target.files[0] || null)}
              className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-primary-50 file:px-3 file:py-1 file:text-xs file:font-medium file:text-primary-700 hover:file:bg-primary-100 focus:outline-none"
            />
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading && (
              <svg
                className="h-4 w-4 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 3v3m0 12v3M3 12h3m12 0h3m-2.636-6.364l-2.121 2.121M7.757 16.243l-2.121 2.121M16.243 16.243l2.121 2.121M7.757 7.757L5.636 5.636" />
              </svg>
            )}
            {uploading ? 'Uploading…' : 'Upload & Import'}
          </button>
          {file && !uploading && (
            <span className="text-xs text-gray-500 truncate max-w-xs">{file.name}</span>
          )}
        </div>
      </div>

      {/* Upload result */}
      {result && (
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <h2 className="text-sm font-semibold text-gray-700">Upload Result</h2>
            <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
              {result.total_records.toLocaleString()} records inserted
            </span>
            {result.ogl_computed ? (
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                OGL Analysis computed
              </span>
            ) : (
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">
                OGL Analysis pending (need both OGL + EMB sheets)
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                  <th className="pb-2 pr-6">Sheet</th>
                  <th className="pb-2 pr-6">Layer</th>
                  <th className="pb-2 pr-6 text-right">Inserted</th>
                  <th className="pb-2 pr-6 text-right">Skipped</th>
                  <th className="pb-2">Errors</th>
                </tr>
              </thead>
              <tbody>
                {result.sheets.map((s) => (
                  <tr key={s.sheet_name} className="border-b border-gray-50 last:border-0">
                    <td className="py-2 pr-6 font-medium text-gray-800">{s.sheet_name}</td>
                    <td className="py-2 pr-6">
                      {s.layer_code && s.layer_code !== '' && s.layer_code !== 'UNKNOWN' ? (
                        <span className="rounded bg-primary-50 px-2 py-0.5 text-xs font-bold text-primary-700">
                          {s.layer_code}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-2 pr-6 text-right font-mono text-gray-800">{s.inserted}</td>
                    <td
                      className={`py-2 pr-6 text-right font-mono ${
                        s.skipped > 0 ? 'text-amber-600 font-semibold' : 'text-gray-400'
                      }`}
                    >
                      {s.skipped}
                    </td>
                    <td className="py-2 text-xs text-red-500 max-w-xs truncate">
                      {s.errors.length > 0 ? s.errors[0] : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Level register status */}
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-700">
              Loaded Data Status
              {projectId && (
                <span className="ml-2 font-mono text-xs text-primary-600 bg-primary-50 px-2 py-0.5 rounded">
                  {projectId}
                </span>
              )}
            </h2>
            <p className="mt-0.5 text-xs text-gray-400">
              Active records in level_register for this project
            </p>
          </div>
          <button
            onClick={() => loadSummary(projectId)}
            disabled={loadingSummary || !projectId}
            className="text-xs font-medium text-primary-600 hover:underline disabled:opacity-40 disabled:no-underline"
          >
            Refresh
          </button>
        </div>

        {loadingSummary ? (
          <LoadingSpinner message="Loading status…" />
        ) : !summary || summary.layers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="mb-2 text-3xl">📊</div>
            <p className="text-sm font-medium text-gray-600">No data loaded yet</p>
            <p className="mt-1 text-xs text-gray-400">
              Upload a Grade Sheet to populate level_register, ogl, and gps_coordinates.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                  <th className="pb-2 pr-6">Layer</th>
                  <th className="pb-2 pr-6 text-right">Records</th>
                  <th className="pb-2 pr-6">Chainage Range</th>
                  <th className="pb-2">FRL Range (m RL)</th>
                </tr>
              </thead>
              <tbody>
                {sortLayers(summary.layers).map((l) => (
                  <tr key={l.layer_code} className="border-b border-gray-50 last:border-0">
                    <td className="py-2.5 pr-6">
                      <span className="rounded bg-primary-50 px-2.5 py-0.5 text-xs font-bold text-primary-700">
                        {l.layer_code}
                      </span>
                    </td>
                    <td className="py-2.5 pr-6 text-right font-mono text-sm text-gray-700">
                      {l.total_records.toLocaleString()}
                    </td>
                    <td className="py-2.5 pr-6 font-mono text-xs text-gray-600">
                      CH {l.chainage_min?.toLocaleString()} – {l.chainage_max?.toLocaleString()}
                    </td>
                    <td className="py-2.5 font-mono text-xs text-gray-600">
                      {l.frl_min != null ? l.frl_min.toFixed(3) : '—'}
                      {' '}–{' '}
                      {l.frl_max != null ? l.frl_max.toFixed(3) : '—'}
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

export default GradeSheetImport;
