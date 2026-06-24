import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import useProjectSession from '../hooks/useProjectSession';
import { getApiErrorMessage } from '../services/apiService';
import { listChangeRequests, getBoqRegister, approveChangeRequest, rejectChangeRequest } from '../services/boqService';
import LoadingSpinner from '../components/LoadingSpinner';

const formatCr = (val) =>
  val == null ? '—' : '₹ ' + (Number(val) / 1e7).toFixed(2) + ' Cr';

const formatDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const CHANGE_TYPE_BADGE = {
  QTY_REVISED:  { label: 'Qty revised',  cls: 'bg-amber-100 text-amber-700' },
  RATE_REVISED: { label: 'Rate revised', cls: 'bg-blue-100 text-blue-700' },
  BOTH:         { label: 'Qty & rate',   cls: 'bg-orange-100 text-orange-700' },
  NEW_ITEM:     { label: 'New item',     cls: 'bg-purple-100 text-purple-700' },
  DELETED:      { label: 'Deleted',      cls: 'bg-red-100 text-red-700' },
};

const APPROVAL_STEPS = {
  PENDING:      { label: 'L1 pending',        cls: 'text-amber-600' },
  L1_APPROVED:  { label: 'L1 ✓ → L2 pending', cls: 'text-blue-600' },
  APPROVED:     { label: 'Approved ✓',        cls: 'text-green-600' },
  REJECTED:     { label: 'Rejected ✗',        cls: 'text-red-600' },
};

const STATUS_OPTIONS = ['PENDING', 'L1_APPROVED', 'APPROVED', 'REJECTED', 'All'];

const VARIATION_THRESHOLD = 10;

const BOQApprovals = () => {
  const { selectedProject, hasPermission } = useProjectSession();
  const projectId = selectedProject?.project_code;
  const canApprove = hasPermission('boq', 'approve');

  const [changes, setChanges] = useState([]);
  const [contractValueV0, setContractValueV0] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [submitterFilter, setSubmitterFilter] = useState('');
  const [approveTarget, setApproveTarget] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(null);

  const fetchData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const params = { project_id: projectId, limit: 200 };
      if (statusFilter !== 'All') params.approval_status = statusFilter;
      if (submitterFilter.trim()) params.submitted_by = submitterFilter.trim();

      const [changesResult, registerResult] = await Promise.all([
        listChangeRequests(params),
        getBoqRegister({ project_id: projectId, limit: 1 }),
      ]);
      setChanges(changesResult);
      setContractValueV0(registerResult?.contract_value_v0 ?? null);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to load approvals'));
    } finally {
      setLoading(false);
    }
  }, [projectId, statusFilter, submitterFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const pendingChanges = changes.filter((c) => c.approval_status === 'PENDING');
  const pendingDeltaAmount = pendingChanges.reduce((s, c) => s + (Number(c.delta_amount) || 0), 0);
  const variationPct =
    contractValueV0 && Number(contractValueV0) > 0
      ? ((pendingDeltaAmount / Number(contractValueV0)) * 100)
      : null;
  const thresholdStatus =
    variationPct == null ? null
    : Math.abs(variationPct) >= VARIATION_THRESHOLD ? 'Exceeded'
    : Math.abs(variationPct) >= VARIATION_THRESHOLD * 0.75 ? 'Warning'
    : 'Safe';
  const thresholdColor =
    thresholdStatus === 'Exceeded' ? 'text-red-600'
    : thresholdStatus === 'Warning' ? 'text-amber-600'
    : 'text-green-600';

  const handleApprove = async (change) => {
    const level = change.approval_status === 'PENDING' ? 1 : 2;
    setProcessing(change.id);
    try {
      await approveChangeRequest(change.id, { project_id: projectId, level });
      toast.success(level === 1 ? 'L1 approved' : 'Finally approved — WORKING version updated');
      setApproveTarget(null);
      await fetchData();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Approval failed'));
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim() || !rejectTarget) return;
    setProcessing(rejectTarget.id);
    try {
      await rejectChangeRequest(rejectTarget.id, {
        project_id: projectId,
        rejection_reason: rejectReason.trim(),
      });
      toast.success('Change request rejected');
      setRejectTarget(null);
      setRejectReason('');
      await fetchData();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Rejection failed'));
    } finally {
      setProcessing(null);
    }
  };

  const approveLabel = (change) =>
    change.approval_status === 'PENDING' ? 'Approve (L1)' : 'Approve (Final)';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          BOQ change approvals — {selectedProject?.project_code ?? '—'}
        </h1>
        {selectedProject?.name && (
          <p className="text-sm text-gray-500">{selectedProject.name}</p>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl bg-white p-4 shadow-sm border border-amber-100">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">Total pending</p>
          <p className="mt-2 text-xl font-bold text-amber-900">{pendingChanges.length}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Pending Δ amount</p>
          <p className={`mt-2 text-xl font-bold ${pendingDeltaAmount >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {pendingDeltaAmount !== 0 && (pendingDeltaAmount > 0 ? '+' : '')}{formatCr(pendingDeltaAmount)}
          </p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Variation if approved</p>
          <p className={`mt-2 text-xl font-bold ${variationPct == null ? 'text-gray-400' : variationPct >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {variationPct == null ? '—' : (variationPct >= 0 ? '+' : '') + variationPct.toFixed(2) + '%'}
          </p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Threshold ({VARIATION_THRESHOLD}%)
          </p>
          <p className={`mt-2 text-xl font-bold ${thresholdColor}`}>
            {thresholdStatus ?? '—'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-3 shadow-sm">
        <div className="flex gap-1">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                statusFilter === s
                  ? 'bg-blue-600 text-white'
                  : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {s === 'All' ? 'All' : s.replace('_', ' ')}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={submitterFilter}
          onChange={(e) => setSubmitterFilter(e.target.value)}
          placeholder="Filter by submitter…"
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:border-blue-400 w-48"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10">
            <LoadingSpinner message="Loading change requests…" />
          </div>
        ) : changes.length === 0 ? (
          <p className="py-16 text-center text-sm text-gray-500">No change requests found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500 w-48">Item</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500 w-28">Type</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500 w-32">Submitted by</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Change detail</th>
                  <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-gray-500 w-28">Δ Amount</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500 w-36">Approval steps</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500 w-40">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {changes.map((change) => {
                  const typeCfg = CHANGE_TYPE_BADGE[change.change_type];
                  const stepCfg = APPROVAL_STEPS[change.approval_status] ?? APPROVAL_STEPS.PENDING;
                  const isProcessing = processing === change.id;
                  const showApproveConfirm = approveTarget === change.id;
                  const isActionable =
                    canApprove &&
                    (change.approval_status === 'PENDING' || change.approval_status === 'L1_APPROVED');

                  return (
                    <tr key={change.id} className="hover:bg-gray-50 transition-colors">
                      {/* Item */}
                      <td className="px-3 py-3">
                        <p className="font-mono font-bold text-gray-800">{change.item_code ?? '—'}</p>
                        <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">{change.description ?? ''}</p>
                      </td>

                      {/* Type badge */}
                      <td className="px-3 py-3">
                        {typeCfg && (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${typeCfg.cls}`}>
                            {typeCfg.label}
                          </span>
                        )}
                      </td>

                      {/* Submitted by */}
                      <td className="px-3 py-3">
                        <p className="text-gray-700">{change.submitted_by ?? '—'}</p>
                        <p className="mt-0.5 text-xs text-gray-400">{formatDate(change.submitted_at)}</p>
                      </td>

                      {/* Change detail */}
                      <td className="px-3 py-3 text-xs text-gray-600 space-y-0.5">
                        {change.old_qty != null && change.new_qty != null && (
                          <p>Qty: {Number(change.old_qty).toLocaleString('en-IN', { maximumFractionDigits: 3 })} → {Number(change.new_qty).toLocaleString('en-IN', { maximumFractionDigits: 3 })}</p>
                        )}
                        {change.old_rate != null && change.new_rate != null && (
                          <p>Rate: ₹{Number(change.old_rate).toLocaleString('en-IN', { maximumFractionDigits: 2 })} → ₹{Number(change.new_rate).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
                        )}
                        {change.reason_code && (
                          <p className="text-gray-400">{change.reason_code.replace(/_/g, ' ')}</p>
                        )}
                      </td>

                      {/* Δ Amount */}
                      <td className={`px-3 py-3 text-right tabular-nums font-medium ${
                        change.delta_amount == null ? 'text-gray-400'
                        : Number(change.delta_amount) > 0 ? 'text-green-600'
                        : Number(change.delta_amount) < 0 ? 'text-red-600'
                        : 'text-gray-500'
                      }`}>
                        {change.delta_amount == null ? '—'
                          : (Number(change.delta_amount) > 0 ? '+' : '') + formatCr(change.delta_amount)}
                      </td>

                      {/* Approval steps */}
                      <td className={`px-3 py-3 text-xs font-medium ${stepCfg.cls}`}>
                        {stepCfg.label}
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-3">
                        {isActionable && (
                          showApproveConfirm ? (
                            <div className="flex flex-col gap-1.5">
                              <p className="text-xs font-medium text-gray-700">Approve this change?</p>
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() => handleApprove(change)}
                                  disabled={isProcessing}
                                  className="rounded-lg bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50 transition"
                                >
                                  {isProcessing ? '…' : 'Yes'}
                                </button>
                                <button
                                  onClick={() => setApproveTarget(null)}
                                  disabled={isProcessing}
                                  className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 transition"
                                >
                                  No
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => setApproveTarget(change.id)}
                                disabled={isProcessing}
                                className="rounded-lg bg-green-50 border border-green-200 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50 transition"
                              >
                                {approveLabel(change)}
                              </button>
                              <button
                                onClick={() => { setRejectTarget(change); setRejectReason(''); }}
                                disabled={isProcessing}
                                className="rounded-lg bg-red-50 border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 transition"
                              >
                                Reject
                              </button>
                            </div>
                          )
                        )}
                        {!isActionable && !canApprove && isActionable !== false && (
                          <span className="text-xs text-gray-400">No permission</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reject modal */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-1 text-lg font-semibold text-gray-900">Reject change request</h2>
            <p className="mb-4 text-sm text-gray-500">
              Item: <span className="font-mono font-bold">{rejectTarget.item_code}</span> — {rejectTarget.description}
            </p>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Rejection reason <span className="text-red-400">*</span>
              </label>
              <textarea
                rows={4}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain why this change is being rejected…"
                className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-red-400"
                autoFocus
              />
            </div>
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => { setRejectTarget(null); setRejectReason(''); }}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectReason.trim() || !!processing}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition"
              >
                {processing ? 'Rejecting…' : 'Confirm rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BOQApprovals;
