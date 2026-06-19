import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { listCapturesV2, getApiErrorMessage } from '../services/apiService';
import SmartFilterBar from '../components/SmartFilterBar';
import LoadingSpinner from '../components/LoadingSpinner';
import CapturePreviewPanel from '../components/CapturePreviewPanel';
import useProjectSession from '../hooks/useProjectSession';
import {
  formatChainageRange,
  getWorkTypeLabel,
  getLayerLabel,
  getEntryStatus,
  getStatusBadgeClass,
  getAgeLabel,
} from '../utils/captureUtils';

const PAGE_SIZE = 20;

// ── Sortable column header ────────────────────────────────────────────────────
const SortHeader = ({ label, field, currentSort, currentOrder, onSort, className = '' }) => {
  const isActive = currentSort === field;
  return (
    <th
      className={`px-3 py-2 text-left text-xs font-medium uppercase tracking-wide
                  text-gray-500 cursor-pointer select-none hover:text-gray-700 ${className}`}
      onClick={() => {
        if (isActive) {
          onSort(field, currentOrder === 'asc' ? 'desc' : 'asc');
        } else {
          onSort(field, 'asc');
        }
      }}
    >
      <span className="flex items-center gap-1">
        {label}
        {isActive ? (
          currentOrder === 'asc'
            ? <ChevronUp className="w-3 h-3 text-blue-600" />
            : <ChevronDown className="w-3 h-3 text-blue-600" />
        ) : (
          <ChevronsUpDown className="w-3 h-3 text-gray-300" />
        )}
      </span>
    </th>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────
const CaptureList = () => {
  const navigate = useNavigate();
  const { selectedProjectId, selectedProject, hasPermission } = useProjectSession();

  const [filters, setFilters] = useState({
    search: '',
    workType: 'All',
    layerCode: '',
    status: 'All',
    chainageMin: '',
    chainageMax: '',
    dateFrom: '',
    dateTo: '',
    contractor: '',
  });
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [skip, setSkip] = useState(0);
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [previewEntry, setPreviewEntry] = useState(null);

  const buildParams = (currentSkip = skip) => {
    const params = {
      project_id: selectedProjectId,
      skip: currentSkip,
      limit: PAGE_SIZE,
      sort_by: sortBy,
      sort_order: sortOrder,
    };
    if (filters.search)                          params.search        = filters.search;
    if (filters.workType && filters.workType !== 'All') params.work_type = filters.workType;
    if (filters.layerCode)                       params.layer_code    = filters.layerCode;
    if (filters.status === 'Approved')           params.approved      = true;
    if (filters.status === 'Rejected')           params.rejected      = true;
    if (filters.status === 'Pending')          { params.approved = false; params.rejected = false; }
    if (filters.chainageMin)                     params.chainage_min  = filters.chainageMin;
    if (filters.chainageMax)                     params.chainage_max  = filters.chainageMax;
    if (filters.dateFrom)                        params.date_from     = filters.dateFrom;
    if (filters.dateTo)                          params.date_to       = filters.dateTo;
    if (filters.contractor)                      params.contractor    = filters.contractor;
    return params;
  };

  const fetchEntries = async (currentSkip = skip) => {
    if (!selectedProjectId) return;
    setLoading(true);
    try {
      const data = await listCapturesV2(buildParams(currentSkip));
      setEntries(data.entries || []);
      setTotal(data.total || 0);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to load captures'));
    } finally {
      setLoading(false);
    }
  };

  // Reset to page 1 whenever filters or sort change
  useEffect(() => {
    setSkip(0);
    fetchEntries(0);
  }, [filters, sortBy, sortOrder, selectedProjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch when page changes (skip > 0 only — page 1 handled above)
  useEffect(() => {
    if (skip > 0) fetchEntries(skip);
  }, [skip]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSort = (field, order) => {
    setSortBy(field);
    setSortOrder(order);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageIndex  = Math.floor(skip / PAGE_SIZE) + 1;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Captures</h1>
          {selectedProject && (
            <p className="text-sm text-gray-500">
              {selectedProject.project_code} — {selectedProject.name}
            </p>
          )}
        </div>
        {hasPermission('capture', 'add') && (
          <button
            type="button"
            onClick={() => navigate('/captures/new')}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white
                       transition hover:bg-blue-700"
          >
            + New Capture
          </button>
        )}
      </div>

      {/* Smart filter bar */}
      <SmartFilterBar
        filters={filters}
        onChange={setFilters}
        placeholder="Search chainage, activity, contractor, RFI…"
      />

      {/* Table card */}
      <div className="rounded-xl bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8">
            <LoadingSpinner message="Loading captures…" />
          </div>
        ) : entries.length === 0 ? (
          <p className="py-16 text-center text-sm text-gray-500">
            No captures found for the current filters.
          </p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-500 w-10">#</th>
                    <SortHeader label="Activity"  field="activity_code" currentSort={sortBy} currentOrder={sortOrder} onSort={handleSort} />
                    <SortHeader label="Work type" field="work_type"     currentSort={sortBy} currentOrder={sortOrder} onSort={handleSort} />
                    <SortHeader label="Chainage"  field="chainage_from" currentSort={sortBy} currentOrder={sortOrder} onSort={handleSort} />
                    <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">Layer / Stage</th>
                    <SortHeader label="Qty (LM)"  field="quantity_lm"   currentSort={sortBy} currentOrder={sortOrder} onSort={handleSort} />
                    <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">Contractor</th>
                    <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">RFI</th>
                    <SortHeader label="Date"      field="created_at"    currentSort={sortBy} currentOrder={sortOrder} onSort={handleSort} />
                    <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">Status</th>
                    <th className="px-3 py-2 w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {entries.map((entry, index) => (
                    <tr
                      key={entry.id}
                      onClick={() => setPreviewEntry(entry)}
                      className={`hover:bg-blue-50/40 cursor-pointer transition-colors ${
                        previewEntry?.id === entry.id ? 'bg-blue-50/60' : ''
                      }`}
                    >
                      <td className="px-3 py-3 text-gray-400 text-xs">{skip + index + 1}</td>
                      <td className="px-3 py-3 font-medium text-gray-900">{entry.activity_code || '—'}</td>
                      <td className="px-3 py-3">
                        {entry.work_type ? (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                            {getWorkTypeLabel(entry.work_type)}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-gray-700">
                        {formatChainageRange(entry.chainage_from, entry.chainage_to)}
                      </td>
                      <td className="px-3 py-3 text-gray-600 text-xs">
                        {getLayerLabel(entry.layer_code) !== '—'
                          ? getLayerLabel(entry.layer_code)
                          : entry.stage || '—'}
                      </td>
                      <td className="px-3 py-3 text-gray-700">{entry.quantity_lm ?? '—'}</td>
                      <td className="px-3 py-3 text-gray-600 text-sm">{entry.contractor_name || '—'}</td>
                      <td className="px-3 py-3 text-gray-500 text-xs">{entry.rfi_number ?? '—'}</td>
                      <td className="px-3 py-3 text-gray-500 text-xs">
                        {entry.created_at
                          ? format(parseISO(entry.created_at), 'dd MMM yy')
                          : '—'}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold
                          ${getStatusBadgeClass(entry)}`}>
                          {getEntryStatus(entry)}
                        </span>
                      </td>
                      <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => navigate(`/captures/${entry.id}`)}
                          className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-medium
                                     text-white hover:bg-blue-700 transition">
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-gray-100">
              {entries.map((entry, index) => (
                <div
                  key={entry.id}
                  onClick={() => setPreviewEntry(entry)}
                  className="p-4 hover:bg-gray-50 cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-gray-400">#{skip + index + 1}</span>
                        <span className="font-medium text-gray-900">{entry.activity_code || '—'}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium
                          ${getStatusBadgeClass(entry)}`}>
                          {getEntryStatus(entry)}
                        </span>
                      </div>
                      <p className="text-sm font-mono text-gray-700">
                        {formatChainageRange(entry.chainage_from, entry.chainage_to)}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {entry.contractor_name || '—'} · {entry.quantity_lm ?? '—'} LM
                      </p>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); navigate(`/captures/${entry.id}`); }}
                      className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs
                                 text-gray-600 hover:bg-gray-50 flex-shrink-0"
                    >
                      Open
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            <div className="px-4 py-3 flex items-center justify-between border-t border-gray-100">
              <p className="text-sm text-gray-500">
                {total === 0 ? '0' : `${skip + 1}–${Math.min(skip + PAGE_SIZE, total)}`} of {total}
              </p>
              <div className="flex items-center gap-2">
                <button
                  disabled={skip === 0}
                  onClick={() => setSkip(Math.max(0, skip - PAGE_SIZE))}
                  className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700
                             hover:bg-gray-200 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-500">
                  Page {pageIndex} of {totalPages}
                </span>
                <button
                  disabled={skip + PAGE_SIZE >= total}
                  onClick={() => setSkip(skip + PAGE_SIZE)}
                  className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700
                             hover:bg-gray-200 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Preview panel */}
      <CapturePreviewPanel
        entry={previewEntry}
        onClose={() => setPreviewEntry(null)}
        onOpenFull={() => navigate(`/captures/${previewEntry?.id}`)}
        footerActions={
          previewEntry && !previewEntry.approved && !previewEntry.rejected ? (
            <button
              onClick={() => { setPreviewEntry(null); navigate(`/captures/${previewEntry.id}`); }}
              className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm
                         font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              Edit
            </button>
          ) : null
        }
      />
    </div>
  );
};

export default CaptureList;
