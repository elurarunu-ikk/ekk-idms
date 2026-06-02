import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Edit2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useWizardStore } from '../../../store/wizardStore';
import { createUserV2, getApiErrorMessage } from '../../../services/apiService';
import { ROLE_LABELS } from '../../../constants/userConstants';
import UserAvatar from '../../../components/users/UserAvatar';
import RoleBadge from '../../../components/users/RoleBadge';
import AnomalyAlert from '../../../components/users/AnomalyAlert';

function PasswordRevealModal({ password, userId, onClose }) {
  const [copied, setCopied]   = useState(false);
  const [checked, setChecked] = useState(false);
  const navigate = useNavigate();
  const store = useWizardStore();

  function copy() {
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function done() {
    store.reset();
    navigate(`/users/${userId}`);
    onClose();
  }

  // Block Escape key
  function handleKeyDown(e) { if (e.key === 'Escape') e.stopPropagation(); }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onKeyDown={handleKeyDown}>
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-bold text-gray-900">Save this password</h3>
        <p className="mt-1 text-sm text-gray-500">This is the only time this password will be shown.</p>
        <div className="mt-4 flex items-center gap-2">
          <code className="flex-1 rounded-lg bg-gray-100 px-4 py-3 font-mono text-sm tracking-wider text-gray-900">
            {password}
          </code>
          <button onClick={copy} type="button"
            className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-3 text-xs font-medium text-gray-600 hover:bg-gray-50">
            <Copy className="h-4 w-4" />
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <label className="mt-5 flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="rounded" />
          <span className="text-sm text-gray-700">I have saved this password securely</span>
        </label>
        <button onClick={done} disabled={!checked} type="button"
          className="mt-4 w-full rounded-lg bg-primary-600 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50">
          Done — Go to user profile
        </button>
      </div>
    </div>
  );
}

export default function Step5Review() {
  const { data, setStep } = useWizardStore();
  const [saving, setSaving]   = useState(false);
  const [newUser, setNewUser] = useState(null);

  const hasErrors = (data.anomaly_findings || []).some((f) => f.severity === 'error');

  async function handleCreate() {
    setSaving(true);
    try {
      const payload = {
        username:     data.username,
        full_name:    data.full_name,
        user_kind:    data.user_kind,
        user_type:    data.user_type,
        emp_id:       data.emp_id || undefined,
        organisation: data.organisation || undefined,
        department:   data.department || undefined,
        designation:  data.designation || undefined,
        email:        data.email || undefined,
        phone:        data.phone || undefined,
        expires_at:   data.expires_at || undefined,
        temp_password: data.password,
        company_assignments: data.company_id
          ? [{ company_id: data.company_id, site_ids: data.site_ids, is_all_sites: data.is_all_sites }]
          : [],
        module_ids:   data.module_ids,
        form_rights:  data.form_rights,
      };
      const user = await createUserV2(payload);
      toast.success('User created successfully');
      setNewUser(user);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 409) { toast.error('Username already taken'); setStep(1); }
      else if (status === 403) { toast.error("You don't have permission to create this user type"); }
      else { toast.error(getApiErrorMessage(err, 'Failed to create user')); }
    } finally {
      setSaving(false);
    }
  }

  const row = (label, value) => value ? (
    <div className="flex gap-2 text-sm">
      <span className="w-28 shrink-0 text-gray-500">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  ) : null;

  return (
    <div>
      {newUser && (
        <PasswordRevealModal
          password={data.password}
          userId={newUser.id}
          onClose={() => setNewUser(null)}
        />
      )}

      <AnomalyAlert findings={data.anomaly_findings || []} />

      <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Left: user info */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <UserAvatar fullName={data.full_name} userType={data.user_type} size="lg" />
            <div>
              <p className="font-semibold text-gray-900">{data.full_name}</p>
              <p className="text-sm text-gray-500">@{data.username}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <RoleBadge userType={data.user_type} />
            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${data.user_kind === 'external' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-gray-200 bg-gray-100 text-gray-600'}`}>
              {data.user_kind}
            </span>
          </div>
          <div className="mt-4 space-y-2">
            {row('Department', data.department)}
            {row('Designation', data.designation)}
            {row('Email', data.email)}
            {row('Phone', data.phone)}
            {data.user_kind === 'external' && row('Expires', data.expires_at)}
          </div>
          <button type="button" onClick={() => setStep(1)} className="mt-3 flex items-center gap-1 text-xs text-primary-600 hover:underline">
            <Edit2 className="h-3 w-3" /> Edit
          </button>
        </div>

        {/* Right: scope + permissions */}
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Scope</p>
            <div className="mt-2 space-y-1.5 text-sm">
              <div><span className="text-gray-500 w-16 inline-block">Sites</span>
                <span className="font-medium text-gray-800">{data.is_all_sites ? 'All sites' : `${data.site_ids?.length || 0} site(s)`}</span>
              </div>
              <div><span className="text-gray-500 w-16 inline-block">Modules</span>
                <span className="font-medium text-gray-800">{data.module_ids?.length > 0 ? data.module_ids.join(', ') : 'All modules'}</span>
              </div>
            </div>
            <button type="button" onClick={() => setStep(2)} className="mt-2 flex items-center gap-1 text-xs text-primary-600 hover:underline">
              <Edit2 className="h-3 w-3" /> Edit scope
            </button>
          </div>

          {data.form_rights?.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Form rights ({data.form_rights.length})</p>
              <div className="mt-2 space-y-0.5 text-xs text-gray-600">
                {data.form_rights.slice(0, 6).map((r) => (
                  <div key={r.form_id} className="flex items-center gap-2">
                    <span className="truncate">{r.form_name || r.form_id}</span>
                    <span className="ml-auto flex gap-0.5">
                      {['C','R','U','D'].map((l, i) => {
                        const keys = ['can_create','can_read','can_update','can_delete'];
                        return <span key={l} className={`px-1 rounded ${r[keys[i]] ? 'bg-blue-100 text-blue-700' : 'text-gray-300'}`}>{l}</span>;
                      })}
                    </span>
                  </div>
                ))}
                {data.form_rights.length > 6 && <p className="text-gray-400">+{data.form_rights.length - 6} more</p>}
              </div>
              <button type="button" onClick={() => setStep(4)} className="mt-2 flex items-center gap-1 text-xs text-primary-600 hover:underline">
                <Edit2 className="h-3 w-3" /> Edit permissions
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button type="button" onClick={handleCreate} disabled={saving || hasErrors}
          className="flex items-center gap-2 rounded-lg bg-green-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50">
          {saving ? 'Creating...' : 'Create user'}
        </button>
      </div>
    </div>
  );
}
