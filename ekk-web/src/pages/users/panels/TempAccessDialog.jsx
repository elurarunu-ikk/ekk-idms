import { useState } from 'react';
import { format, addHours } from 'date-fns';
import toast from 'react-hot-toast';
import { getApiErrorMessage, grantTempAccess } from '../../../services/apiService';

function toLocalDateTimeString(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function TempAccessDialog({ user, onClose }) {
  const minDate = toLocalDateTimeString(addHours(new Date(), 1));
  const [reason, setReason]     = useState('');
  const [expiry, setExpiry]     = useState('');
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  async function submit(e) {
    e.preventDefault();
    if (reason.trim().length < 10) { setError('Reason must be at least 10 characters'); return; }
    if (!expiry) { setError('Expiry date is required'); return; }
    setError(''); setSaving(true);
    try {
      await grantTempAccess({ user_id: user.id, scope_json: {}, reason: reason.trim(), expires_at: expiry });
      toast.success('Temporary access granted');
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to grant access'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-base font-semibold text-gray-900">Grant temporary access</h3>
        <p className="mt-0.5 text-xs text-gray-500">For {user.full_name}</p>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Reason *</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Expires at *</label>
            <input type="datetime-local" value={expiry} onChange={(e) => setExpiry(e.target.value)} min={minDate} required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none" />
            {expiry && (
              <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">
                ⚠ Access auto-revokes on {format(new Date(expiry), 'dd MMM yyyy, HH:mm')}
              </p>
            )}
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200">Cancel</button>
            <button type="submit" disabled={saving}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60">
              {saving ? 'Granting...' : 'Grant access'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
