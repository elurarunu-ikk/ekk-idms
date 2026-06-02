import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { getApiErrorMessage, resetUserPassword } from '../../../services/apiService';

export default function ResetPasswordDialog({ user, onClose }) {
  const [pw, setPw]   = useState('');
  const [cpw, setCpw] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  async function submit(e) {
    e.preventDefault();
    if (pw.length < 8) { setError('Minimum 8 characters'); return; }
    if (pw !== cpw)    { setError('Passwords do not match'); return; }
    setError('');
    setSaving(true);
    try {
      await resetUserPassword(user.id, { new_password: pw, confirm_password: cpw });
      toast.success('Password reset. User will be prompted to change on next login.');
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Reset failed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-base font-semibold text-gray-900">Reset password for {user.full_name}</h3>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <div className="relative">
            <input type={show ? 'text' : 'password'} placeholder="New password" value={pw}
              onChange={(e) => setPw(e.target.value)} required
              className="w-full rounded-lg border border-gray-300 py-2 pl-3 pr-9 text-sm focus:border-primary-500 focus:outline-none" />
            <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-2.5 top-2.5 text-gray-400">
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <input type={show ? 'text' : 'password'} placeholder="Confirm password" value={cpw}
            onChange={(e) => setCpw(e.target.value)} required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none" />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200">Cancel</button>
            <button type="submit" disabled={saving}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-60">
              {saving ? 'Resetting...' : 'Reset password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
