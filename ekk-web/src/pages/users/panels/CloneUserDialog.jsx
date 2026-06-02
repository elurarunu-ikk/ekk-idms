import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import { cloneUser, getApiErrorMessage } from '../../../services/apiService';
import AnomalyAlert from '../../../components/users/AnomalyAlert';

function PasswordRevealModal({ password, userId, onClose }) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [checked, setChecked] = useState(false);
  function done() { navigate(`/users/${userId}`); onClose(); }
  function copy() { navigator.clipboard.writeText(password); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-bold text-gray-900">Save this password</h3>
        <div className="mt-4 flex items-center gap-2">
          <code className="flex-1 rounded-lg bg-gray-100 px-4 py-3 font-mono text-sm">{password}</code>
          <button onClick={copy} type="button" className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-3 text-xs text-gray-600 hover:bg-gray-50">
            <Copy className="h-4 w-4" />{copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <label className="mt-5 flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="rounded" />
          <span className="text-sm text-gray-700">I have saved this password securely</span>
        </label>
        <button onClick={done} disabled={!checked} type="button"
          className="mt-4 w-full rounded-lg bg-primary-600 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">
          Done
        </button>
      </div>
    </div>
  );
}

export default function CloneUserDialog({ sourceUser, onClose, onSuccess }) {
  const [fullName, setFullName] = useState(`${sourceUser.full_name} (Copy)`);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [cpw, setCpw]           = useState('');
  const [saving, setSaving]     = useState(false);
  const [findings, setFindings] = useState([]);
  const [newUser, setNewUser]   = useState(null);
  const [error, setError]       = useState('');

  const hasErrors = findings.some((f) => f.severity === 'error');

  async function submit(e) {
    e.preventDefault();
    if (password !== cpw) { setError('Passwords do not match'); return; }
    setError(''); setSaving(true);
    try {
      const res = await cloneUser(sourceUser.id, {
        new_full_name: fullName, new_username: username, new_password: password,
      });
      if (res.anomalies?.has_errors) { setFindings(res.anomalies.findings); return; }
      setFindings(res.anomalies?.findings || []);
      setNewUser(res.new_user);
      toast.success('User cloned successfully');
      onSuccess?.();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Clone failed'));
    } finally {
      setSaving(false);
    }
  }

  if (newUser) return <PasswordRevealModal password={password} userId={newUser.id} onClose={onClose} />;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-base font-semibold text-gray-900">Clone user from {sourceUser.full_name}</h3>
        <p className="mt-1 text-xs text-gray-500">Creates a new user with identical permissions.</p>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <AnomalyAlert findings={findings} />
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Full name *</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Username *</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Password *</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Confirm password *</label>
            <input type="password" value={cpw} onChange={(e) => setCpw(e.target.value)} required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none" />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200">Cancel</button>
            <button type="submit" disabled={saving || hasErrors}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60">
              {saving ? 'Cloning...' : 'Clone user'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
