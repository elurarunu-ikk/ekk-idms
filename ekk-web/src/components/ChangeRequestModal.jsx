import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '../services/apiService';
import { createChangeRequest } from '../services/boqService';

const formatQty = (val) =>
  val == null ? '—' : Number(val).toLocaleString('en-IN', { maximumFractionDigits: 3 });

const formatRate = (val) =>
  val == null ? '—' : '₹ ' + Number(val).toLocaleString('en-IN', { maximumFractionDigits: 2 });

const formatCr = (val) =>
  val == null ? '—' : '₹ ' + (Number(val) / 1e7).toFixed(2) + ' Cr';

const CHANGE_TYPES_EXISTING = [
  { value: 'QTY_REVISED', label: 'Qty revised' },
  { value: 'RATE_REVISED', label: 'Rate revised' },
  { value: 'BOTH', label: 'Both qty & rate' },
  { value: 'DELETED', label: 'Delete item' },
];

const REASON_CODES = [
  { value: 'POST_SURVEY', label: 'Post survey' },
  { value: 'CLIENT_INSTRUCTION', label: 'Client instruction' },
  { value: 'SITE_CONDITION', label: 'Site condition' },
  { value: 'ESCALATION', label: 'Escalation' },
  { value: 'VARIATION_ORDER', label: 'Variation order' },
];

const ChangeRequestModal = ({ isOpen, onClose, onSuccess, item, projectId }) => {
  const [changeType, setChangeType] = useState('QTY_REVISED');
  const [newQty, setNewQty] = useState('');
  const [newRate, setNewRate] = useState('');
  const [reasonCode, setReasonCode] = useState('');
  const [remarks, setRemarks] = useState('');
  const [docRef, setDocRef] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setChangeType(item ? 'QTY_REVISED' : 'NEW_ITEM');
      setNewQty('');
      setNewRate('');
      setReasonCode('');
      setRemarks('');
      setDocRef('');
      setErrors({});
    }
  }, [isOpen, item]);

  const showQtyFields = item && (changeType === 'QTY_REVISED' || changeType === 'BOTH');
  const showRateFields = item && (changeType === 'RATE_REVISED' || changeType === 'BOTH');

  const deltaQty =
    showQtyFields && newQty !== '' && item?.revised_scope != null
      ? parseFloat(newQty) - Number(item.revised_scope)
      : null;

  const deltaAmount =
    deltaQty != null && item?.adjusted_rate != null
      ? deltaQty * Number(item.adjusted_rate)
      : null;

  const validate = () => {
    const errs = {};
    if (showQtyFields && newQty === '') errs.newQty = 'New quantity is required';
    if (showRateFields && newRate === '') errs.newRate = 'New rate is required';
    if (!remarks.trim() || remarks.trim().length < 10)
      errs.remarks = 'Remarks must be at least 10 characters';
    return errs;
  };

  const handleSubmit = async () => {
    if (!item) {
      toast('New item variation requires admin CLI import — contact your project admin.', { icon: 'ℹ️' });
      return;
    }
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSubmitting(true);
    try {
      const payload = {
        project_id: projectId,
        boq_item_id: item.id,
        change_type: changeType,
        reason_code: reasonCode || undefined,
        remarks: remarks.trim(),
        doc_ref: docRef.trim() || undefined,
      };
      if (showQtyFields) payload.new_qty = parseFloat(newQty);
      if (showRateFields) payload.new_rate = parseFloat(newRate);

      await createChangeRequest(payload);
      toast.success('Change request submitted for approval');
      onSuccess();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to submit change request'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {item ? 'Raise change request' : 'Add new variation item'}
          </h2>
          <button onClick={onClose} className="rounded p-1 text-gray-400 hover:text-gray-600 transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Item fields */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Item code</label>
              <input
                type="text"
                value={item?.item_code ?? ''}
                readOnly
                className="w-full rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:outline-none"
              />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-500">Description</label>
              <input
                type="text"
                value={item?.description ?? ''}
                readOnly
                className="w-full rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Unit</label>
              <input
                type="text"
                value={item?.unit ?? ''}
                readOnly
                className="w-full rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Change type</label>
              {item ? (
                <select
                  value={changeType}
                  onChange={(e) => setChangeType(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-400"
                >
                  {CHANGE_TYPES_EXISTING.map((ct) => (
                    <option key={ct.value} value={ct.value}>{ct.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value="New item"
                  readOnly
                  className="w-full rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:outline-none"
                />
              )}
            </div>
          </div>

          {/* Qty fields */}
          {showQtyFields && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Current qty</label>
                <input
                  type="text"
                  value={formatQty(item.revised_scope)}
                  readOnly
                  className="w-full rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">New quantity</label>
                <input
                  type="number"
                  value={newQty}
                  onChange={(e) => { setNewQty(e.target.value); setErrors((p) => ({ ...p, newQty: '' })); }}
                  placeholder="Enter new quantity"
                  className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:border-blue-400 ${errors.newQty ? 'border-red-400' : 'border-gray-200'}`}
                />
                {errors.newQty && <p className="mt-1 text-xs text-red-500">{errors.newQty}</p>}
              </div>
            </div>
          )}

          {/* Rate fields */}
          {showRateFields && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Current rate (₹)</label>
                <input
                  type="text"
                  value={formatRate(item.adjusted_rate)}
                  readOnly
                  className="w-full rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">New rate (₹)</label>
                <input
                  type="number"
                  value={newRate}
                  onChange={(e) => { setNewRate(e.target.value); setErrors((p) => ({ ...p, newRate: '' })); }}
                  placeholder="Enter new rate"
                  className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:border-blue-400 ${errors.newRate ? 'border-red-400' : 'border-gray-200'}`}
                />
                {errors.newRate && <p className="mt-1 text-xs text-red-500">{errors.newRate}</p>}
              </div>
            </div>
          )}

          {/* Financial impact */}
          {deltaQty != null && (
            <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm">
              <span className="font-medium text-blue-800">Financial impact: </span>
              <span className={`font-semibold ${deltaQty >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                Δ Qty {deltaQty >= 0 ? '+' : ''}{formatQty(deltaQty)}
                {deltaAmount != null && (
                  <> · Δ Amount {deltaAmount >= 0 ? '+' : ''}{formatCr(deltaAmount)}</>
                )}
              </span>
            </div>
          )}

          {/* Reason code */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Reason code</label>
            <select
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-400"
            >
              <option value="">— Select reason —</option>
              {REASON_CODES.map((rc) => (
                <option key={rc.value} value={rc.value}>{rc.label}</option>
              ))}
            </select>
          </div>

          {/* Remarks */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Remarks <span className="text-red-400">*</span>
            </label>
            <textarea
              rows={3}
              value={remarks}
              onChange={(e) => { setRemarks(e.target.value); setErrors((p) => ({ ...p, remarks: '' })); }}
              placeholder="Describe the reason for this change (min 10 characters)"
              className={`w-full resize-none rounded-lg border px-3 py-2 text-sm focus:outline-none focus:border-blue-400 ${errors.remarks ? 'border-red-400' : 'border-gray-200'}`}
            />
            {errors.remarks && <p className="mt-1 text-xs text-red-500">{errors.remarks}</p>}
          </div>

          {/* Doc ref */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Document reference (optional)</label>
            <input
              type="text"
              value={docRef}
              onChange={(e) => setDocRef(e.target.value)}
              placeholder="e.g. Survey_Report_Jun2026.pdf"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-400"
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition"
          >
            Cancel
          </button>
          <button
            onClick={() => toast('Draft saving coming soon', { icon: 'ℹ️' })}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
          >
            Save draft
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {submitting ? 'Submitting…' : 'Submit for approval'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChangeRequestModal;
