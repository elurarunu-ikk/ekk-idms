import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';
import { approveCapture, rejectCapture, listPendingV2, getApiErrorMessage } from '../services/apiService';
import SmartFilterBar from '../components/SmartFilterBar';
import ConfirmModal from '../components/ConfirmModal';
import LoadingSpinner from '../components/LoadingSpinner';
import CapturePreviewPanel from '../components/CapturePreviewPanel';
import useProjectSession from '../hooks/useProjectSession';
import {
  formatChainageRange,
  getWorkTypeLabel,
  getAgeLabel,
} from '../utils/captureUtils';

const PendingApprovals = () => {
  const navigate = useNavigate();
  const { selectedProjectId, selectedProject } = useProjectSession();

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState(new Set());
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [previewEntry, setPreviewEntry] = useState(null);

  const [filters, setFilters] = useState({
    search: '', workType: 'All', layerCode: '',
    contractor: '', chainageMin: '', chainageMax: '',
    status: 'All', dateFrom: '', dateTo: '',
  });

  // Dialogs
  const [approveTarget, setApproveTarget]     = useState(null);
  const [rejectTarget, setRejectTarget]       = useState(null);
  const [rejectReason, setRejectReason]       = useState('');
  const [bulkRejectOpen, setBulkRejectOpen]   = useState(false);
  const [bulkRejectReason, setBulkRejectReason] = useState('');

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const params = {
        approved: false,
        rejected: false,
        sort_by: 'created_at',
        sort_order: 'asc',   // oldest first — most urgent at top
        limit: 500,
      };
      if (selectedProjectId)                        params.project_id  = selectedProjectId;
      if (filters.search)                           params.search      = filters.search;
      if (filters.workType && filters.workType !== 'All') params.work_type = filters.workType;
      if (filters.layerCode)                        params.layer_code  = filters.layerCode;
      if (filters.chainageMin)                      params.chainage_min = filters.chainageMin;
      if (filters.chainageMax)                      params.chainage_max = filters.chainageMax;
      if (filters.contractor)                       params.contractor  = filters.contractor;

      const data = await listPendingV2(params);
      setEntries(data.entries || []);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to load pending approvals'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, [filters, selectedProjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Single approve ────────────────────────────────────────────────────────
  const handleApprove = (entry) => setApproveTarget(entry);

  const confirmApprove = async () => {
    const approver = localStorage.getItem('username') || 'Admin';
    setProcessingIds(prev => new Set([...prev, approveTarget.id]));
    try {
      await approveCapture(approveTarget.id, approver);
      toast.success('Entry approved');
      setApproveTarget(null);
      setSelectedIds(prev => { const s = new Set(prev); s.delete(approveTarget?.id); return s; });
      await fetchEntries();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Approval failed'));
    } finally {
      setProcessingIds(prev => { const s = new Set(prev); s.delete(approveTarget?.id); return s; });
    }
  };

  // ── Single reject ─────────────────────────────────────────────────────────
  const confirmReject = async () => {
    if (!rejectReason.trim()) return;
    setProcessingIds(prev => new Set([...prev, rejectTarget.id]));
    try {
      await rejectCapture(rejectTarget.id, rejectReason.trim());
      toast.success('Entry rejected');
      setRejectTarget(null);
      setRejectReason('');
      setSelectedIds(prev => { const s = new Set(prev); s.delete(rejectTarget?.id); return s; });
      await fetchEntries();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Rejection failed'));
    } finally {
      setProcessingIds(prev => { const s = new Set(prev); s.delete(rejectTarget?.id); return s; });
    }
  };

  // ── Bulk approve ──────────────────────────────────────────────────────────
  const handleBulkApprove = async () => {
    const approver = localStorage.getItem('username') || 'Admin';
    const ids = [...selectedIds];
    setProcessingIds(new Set(ids));
    try {
      await Promise.all(ids.map(id => approveCapture(id, approver)));
      toast.success(`${ids.length} ${ids.length === 1 ? 'entry' : 'entries'} approved`);
      setSelectedIds(new Set());
      await fetchEntries();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Bulk approval failed'));
    } finally {
      setProcessingIds(new Set());
    }
  };

  // ── Bulk reject ───────────────────────────────────────────────────────────
  const confirmBulkReject = async () => {
    if (!bulkRejectReason.trim()) return;
    const ids = [...selectedIds];
    setProcessingIds(new Set(ids));
    try {
      await Promise.all(ids.map(id => rejectCapture(id, bulkRejectReason.trim())));
      toast.success(`${ids.length} ${ids.length === 1 ? 'entry' : 'entries'} rejected`);
      setSelectedIds(new Set());
      setBulkRejectOpen(false);
      setBulkRejectReason('');
      await fetchEntries();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Bulk rejection failed'));
    } finally {
      setProcessingIds(new Set());
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pending Approvals</h1>
          {selectedProject && (
            <p className="text-sm text-gray-500">
              {selectedProject.project_code} — {selectedProject.name}
            </p>
          )}
        </div>
        {!loading && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800">
            {entries.length} awaiting approval
          </span>
        )}
      </div>

      {/* Filters — search + contractor only */}
      <SmartFilterBar
        filters={filters}
        onChange={setFilters}
        config={['search', 'workType', 'layerCode', 'chainageMin', 'contractor']}
        placeholder="Search activity, contractor, chainage…"
      />

      {/* Table card */}
      <div className="rounded-xl bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8">
            <LoadingSpinner message="Loading pending approvals…" />
          </div>
        ) : entries.length === 0 ? (
          <p className="py-16 text-center text-sm text-gray-500">
            No entries pending approval.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-3 py-2 w-8">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300"
                      checked={selectedIds.size === entries.length && entries.length > 0}
                      onChange={e => setSelectedIds(
                        e.target.checked ? new Set(entries.map(en => en.id)) : new Set()
                      )}
                    />
                  </th>
                  <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-500 w-8">#</th>
                  <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">Activity</th>
                  <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">Work type</th>
                  <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">Chainage</th>
                  <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">Contractor</th>
                  <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">Entered by</th>
                  <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">Qty (LM)</th>
                  <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">Waiting</th>
                  <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {entries.map((entry, index) => {
                  const age         = getAgeLabel(entry.created_at);
                  const isProcessing = processingIds.has(entry.id);
                  const isSelected   = selectedIds.has(entry.id);
                  return (
                    <tr
                      key={entry.id}
                      onClick={() => setPreviewEntry(entry)}
                      className={`cursor-pointer transition-colors ${
                        previewEntry?.id === entry.id ? 'bg-blue-50/60' :
                        isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="rounded border-gray-300"
                          checked={isSelected}
                          onChange={e => setSelectedIds(prev => {
                            const s = new Set(prev);
                            e.target.checked ? s.add(entry.id) : s.delete(entry.id);
                            return s;
                          })}
                        />
                      </td>
                      <td className="px-3 py-3 text-gray-400 text-xs">{index + 1}</td>
                      <td className="px-3 py-3 font-medium text-gray-900">{entry.activity_code || '—'}</td>
                      <td className="px-3 py-3">
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                          {getWorkTypeLabel(entry.work_type)}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-gray-700">
                        {formatChainageRange(entry.chainage_from, entry.chainage_to)}
                      </td>
                      <td className="px-3 py-3 text-gray-600">{entry.contractor_name || '—'}</td>
                      <td className="px-3 py-3 text-gray-500 text-xs">{entry.entered_by || '—'}</td>
                      <td className="px-3 py-3 text-gray-700">{entry.quantity_lm ?? '—'}</td>
                      <td className="px-3 py-3">
                        <span className={`text-xs font-medium ${age.colorClass}`}>
                          {age.label}
                        </span>
                      </td>
                      <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          <button
                            disabled={isProcessing}
                            onClick={() => handleApprove(entry)}
                            className="rounded-lg bg-green-600 px-2.5 py-1.5 text-xs font-medium
                                       text-white hover:bg-green-700 transition disabled:opacity-50"
                          >
                            {isProcessing ? '…' : '✓ Approve'}
                          </button>
                          <button
                            disabled={isProcessing}
                            onClick={() => { setRejectReason(''); setRejectTarget(entry); }}
                            className="rounded-lg bg-amber-500 px-2.5 py-1.5 text-xs font-medium
                                       text-white hover:bg-amber-600 transition disabled:opacity-50"
                          >
                            ✕ Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Floating bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50
                        flex items-center gap-3 rounded-2xl bg-gray-900 px-5 py-3 shadow-2xl">
          <span className="text-sm text-white font-medium">
            {selectedIds.size} selected
          </span>
          <div className="w-px h-4 bg-gray-600" />
          <button
            onClick={handleBulkApprove}
            className="rounded-lg bg-green-500 hover:bg-green-400 px-4 py-2
                       text-sm font-medium text-white transition"
          >
            ✓ Approve all ({selectedIds.size})
          </button>
          <button
            onClick={() => { setBulkRejectReason(''); setBulkRejectOpen(true); }}
            className="rounded-lg bg-amber-500 hover:bg-amber-400 px-4 py-2
                       text-sm font-medium text-white transition"
          >
            ✕ Reject all ({selectedIds.size})
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="p-1.5 text-gray-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Single approve — ConfirmModal, auto-fills username */}
      <ConfirmModal
        isOpen={!!approveTarget}
        title="Approve entry?"
        message={`Approve ${approveTarget?.activity_code || ''} · ${formatChainageRange(approveTarget?.chainage_from, approveTarget?.chainage_to)}?\n\nApproved by: ${localStorage.getItem('username') || 'Admin'}`}
        onConfirm={confirmApprove}
        onCancel={() => setApproveTarget(null)}
        confirmLabel="Approve"
        confirmClassName="bg-green-600 hover:bg-green-700"
      />

      {/* Single reject modal — needs textarea */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900">Reject entry</h3>
            <p className="mt-1 text-sm text-gray-500">
              {rejectTarget.activity_code} · {formatChainageRange(rejectTarget.chainage_from, rejectTarget.chainage_to)}
            </p>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Reason for rejection (required)"
              className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                         focus:border-blue-500 focus:outline-none resize-none"
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => setRejectTarget(null)}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                disabled={!rejectReason.trim() || processingIds.has(rejectTarget.id)}
                onClick={confirmReject}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white
                           hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirm reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview panel with inline Approve / Reject */}
      <CapturePreviewPanel
        entry={previewEntry}
        onClose={() => setPreviewEntry(null)}
        onOpenFull={() => navigate(`/captures/${previewEntry?.id}`)}
        footerActions={previewEntry && (
          <>
            <button
              disabled={processingIds.has(previewEntry.id)}
              onClick={() => { setPreviewEntry(null); handleApprove(previewEntry); }}
              className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium
                         text-white hover:bg-green-700 transition disabled:opacity-50"
            >
              ✓ Approve
            </button>
            <button
              disabled={processingIds.has(previewEntry.id)}
              onClick={() => { setRejectReason(''); setPreviewEntry(null); setRejectTarget(previewEntry); }}
              className="flex-1 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium
                         text-white hover:bg-amber-600 transition disabled:opacity-50"
            >
              ✕ Reject
            </button>
          </>
        )}
      />

      {/* Bulk reject modal */}
      {bulkRejectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900">
              Reject {selectedIds.size} {selectedIds.size === 1 ? 'entry' : 'entries'}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              This reason will be applied to all selected entries.
            </p>
            <textarea
              rows={3}
              value={bulkRejectReason}
              onChange={e => setBulkRejectReason(e.target.value)}
              placeholder="Reason for rejection (required)"
              className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                         focus:border-blue-500 focus:outline-none resize-none"
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => setBulkRejectOpen(false)}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                disabled={!bulkRejectReason.trim()}
                onClick={confirmBulkReject}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white
                           hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirm reject all
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PendingApprovals;
