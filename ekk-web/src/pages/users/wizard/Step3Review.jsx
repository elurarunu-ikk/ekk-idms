import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Copy, Edit2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useWizardStore } from '../../../store/wizardStore';
import {
  createUserV2, upsertUserProjectAccess, listActiveProjects, getApiErrorMessage,
} from '../../../services/apiService';
import { ROLE_LABELS } from '../../../constants/userConstants';
import UserAvatar from '../../../components/users/UserAvatar';
import RoleBadge from '../../../components/users/RoleBadge';

// ── Constants ────────────────────────────────────────────────────────────────

const ACTIONS = ['view', 'add', 'edit', 'delete', 'approve'];
const ACTION_LABELS = { view: 'View', add: 'Create', edit: 'Edit', delete: 'Delete', approve: 'Approve' };
const FULL = { view: true, add: true, edit: true, delete: true, approve: true };

// ── Build permissions rows from store data ────────────────────────────────────

function buildRows(data, allProjects) {
  const userType = data.user_type || 'USER';

  if (['SUPER_ADMIN', 'SUPER ADMIN'].includes(userType)) return [];

  if (['ADMIN', 'HO_USER'].includes(userType)) {
    const moduleIds = data.access_global_module_ids || [];
    const rights = data.access_global_rights || {};
    const permJson = {};
    for (const mid of moduleIds) {
      permJson[mid] = userType === 'ADMIN' ? { ...FULL } : (rights[mid] || { ...FULL });
    }
    return allProjects.map((p) => ({ project_id: p.id, permissions_json: permJson }));
  }

  // SITE_ADMIN / USER
  const siteIds = data.access_site_ids || [];
  const siteConfigs = data.access_site_configs || {};
  return siteIds.map((siteId) => {
    const config = siteConfigs[siteId] || { module_ids: [], rights: {} };
    const permJson = {};
    for (const mid of config.module_ids) {
      permJson[mid] = userType === 'SITE_ADMIN' ? { ...FULL } : (config.rights?.[mid] || { ...FULL });
    }
    return { project_id: siteId, permissions_json: permJson };
  });
}

// ── Password reveal modal (unchanged from Step5Review) ────────────────────────

function PasswordRevealModal({ password, userId, onClose }) {
  const [copied, setCopied] = useState(false);
  const [checked, setChecked] = useState(false);
  const navigate = useNavigate();
  const store = useWizardStore();

  function copy() { navigator.clipboard.writeText(password); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  function done() { store.reset(); navigate(`/users/${userId}`); onClose(); }
  function handleKeyDown(e) { if (e.key === 'Escape') e.stopPropagation(); }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onKeyDown={handleKeyDown}>
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-bold text-gray-900">Save this password</h3>
        <p className="mt-1 text-sm text-gray-500">This is the only time this password will be shown.</p>
        <div className="mt-4 flex items-center gap-2">
          <code className="flex-1 rounded-lg bg-gray-100 px-4 py-3 font-mono text-sm tracking-wider text-gray-900">{password}</code>
          <button onClick={copy} type="button"
            className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-3 text-xs font-medium text-gray-600 hover:bg-gray-50">
            <Copy className="h-4 w-4" />{copied ? 'Copied!' : 'Copy'}
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

// ── Access summary helpers ────────────────────────────────────────────────────

function RightsDots({ rights }) {
  return (
    <span className="ml-2 flex gap-1">
      {ACTIONS.map((a) => (
        <span key={a} title={ACTION_LABELS[a]}
          className={`inline-block h-2 w-2 rounded-full ${rights?.[a] ? 'bg-green-500' : 'bg-gray-200'}`} />
      ))}
    </span>
  );
}

function AccessSummary({ data, allProjects }) {
  const userType = data.user_type || 'USER';
  const isSuper = ['SUPER_ADMIN', 'SUPER ADMIN'].includes(userType);
  const isGlobal = ['ADMIN', 'HO_USER'].includes(userType);
  const showRights = ['HO_USER', 'USER'].includes(userType);

  if (isSuper) return (
    <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
      Super Admin — unrestricted access to all sites, modules, and forms.
    </div>
  );

  if (isGlobal) {
    const moduleIds = data.access_global_module_ids || [];
    const rights = data.access_global_rights || {};
    return (
      <div className="space-y-2">
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
          All sites ({allProjects.length} active project{allProjects.length !== 1 ? 's' : ''})
        </div>
        {moduleIds.length === 0 ? (
          <p className="text-sm text-amber-600">No modules selected.</p>
        ) : (
          <div className="space-y-1">
            {moduleIds.map((mid) => (
              <div key={mid} className="flex items-center rounded-md bg-gray-50 px-3 py-1.5 text-sm">
                <span className="font-medium text-gray-800">{mid}</span>
                {showRights ? (
                  <RightsDots rights={rights[mid]} />
                ) : (
                  <span className="ml-2 text-xs text-green-600">full access</span>
                )}
              </div>
            ))}
          </div>
        )}
        {showRights && (
          <p className="text-xs text-gray-400">Dots: View / Create / Edit / Delete / Approve</p>
        )}
      </div>
    );
  }

  // SITE_ADMIN / USER
  const siteIds = data.access_site_ids || [];
  const siteConfigs = data.access_site_configs || {};
  const siteMap = Object.fromEntries(allProjects.map((p) => [p.id, p]));

  if (siteIds.length === 0) return <p className="text-sm text-amber-600">No sites selected.</p>;

  return (
    <div className="space-y-2">
      {siteIds.map((siteId) => {
        const site = siteMap[siteId];
        const config = siteConfigs[siteId] || { module_ids: [], rights: {} };
        return (
          <div key={siteId} className="rounded-lg border border-gray-200 p-3">
            <p className="text-xs font-semibold text-gray-600">
              {site?.project_code || siteId}
              {site?.name && <span className="ml-1 font-normal text-gray-400">{site.name}</span>}
            </p>
            {config.module_ids.length === 0 ? (
              <p className="mt-1 text-xs text-amber-600">No modules.</p>
            ) : (
              <div className="mt-1 space-y-0.5">
                {config.module_ids.map((mid) => (
                  <div key={mid} className="flex items-center text-xs">
                    <span className="w-28 font-medium text-gray-700">{mid}</span>
                    {showRights ? (
                      <RightsDots rights={config.rights?.[mid]} />
                    ) : (
                      <span className="text-green-600">full</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {showRights && (
        <p className="text-xs text-gray-400">Dots: View / Create / Edit / Delete / Approve</p>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Step3Review() {
  const { id: editUserId } = useParams();
  const isEditMode = Boolean(editUserId);
  const navigate = useNavigate();
  const store = useWizardStore();
  const { data } = store;

  const [saving, setSaving] = useState(false);
  const [newUser, setNewUser] = useState(null);

  const { data: allProjects = [] } = useQuery({
    queryKey: ['active-projects'],
    queryFn: () => listActiveProjects().then((r) => (Array.isArray(r) ? r : r.items || [])),
  });

  async function handleCreate() {
    setSaving(true);
    try {
      const user = await createUserV2({
        username:     data.username,
        full_name:    data.full_name,
        user_kind:    data.user_kind,
        user_type:    data.user_type,
        emp_id:       data.emp_id       || undefined,
        organisation: data.organisation  || undefined,
        department:   data.department   || undefined,
        designation:  data.designation  || undefined,
        email:        data.email        || undefined,
        phone:        data.phone        || undefined,
        expires_at:   data.expires_at   || undefined,
        temp_password: data.password,
        // Old fields sent as empty — legacy tables not written
        company_assignments: [],
        module_ids: [],
        form_rights: [],
      });

      const rows = buildRows(data, allProjects);
      if (rows.length > 0) {
        await upsertUserProjectAccess(user.id, rows);
      }

      toast.success('User created successfully');
      setNewUser(user);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 409) { toast.error(getApiErrorMessage(err, 'Username already taken')); store.setStep(1); }
      else if (status === 403) { toast.error("You don't have permission to create this user type"); }
      else { toast.error(getApiErrorMessage(err, 'Failed to create user')); }
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const rows = buildRows(data, allProjects);
      if (rows.length > 0) {
        await upsertUserProjectAccess(editUserId, rows);
      }
      toast.success('Access updated successfully');
      store.reset();
      navigate('/users');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to update access'));
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

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Left: user info */}
        {!isEditMode && (
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
            <button type="button" onClick={() => store.setStep(1)}
              className="mt-3 flex items-center gap-1 text-xs text-primary-600 hover:underline">
              <Edit2 className="h-3 w-3" /> Edit identity
            </button>
          </div>
        )}

        {/* Right: access summary */}
        <div className={isEditMode ? 'md:col-span-2' : ''}>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Access configuration</p>
              <button type="button" onClick={() => store.setStep(2)}
                className="flex items-center gap-1 text-xs text-primary-600 hover:underline">
                <Edit2 className="h-3 w-3" /> Edit
              </button>
            </div>
            <AccessSummary data={data} allProjects={allProjects} />
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button type="button"
          onClick={isEditMode ? handleSave : handleCreate}
          disabled={saving}
          className="rounded-lg bg-green-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving
            ? (isEditMode ? 'Saving…' : 'Creating…')
            : (isEditMode ? 'Save Access' : 'Create user')}
        </button>
      </div>
    </div>
  );
}
