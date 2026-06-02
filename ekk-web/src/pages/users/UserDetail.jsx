import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Key, Copy, UserX, UserCheck, Clock } from 'lucide-react';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import { useUser, useDeactivateUser, useActivateUser } from '../../hooks/useUsers';
import { getPermissionSummary, getApiErrorMessage } from '../../services/apiService';
import UserAvatar from '../../components/users/UserAvatar';
import RoleBadge from '../../components/users/RoleBadge';
import StatusPill from '../../components/users/StatusPill';
import LoadingSpinner from '../../components/LoadingSpinner';
import ConfirmModal from '../../components/ConfirmModal';
import AuditLogPanel from './panels/AuditLogPanel';
import CloneUserDialog from './panels/CloneUserDialog';
import ResetPasswordDialog from './panels/ResetPasswordDialog';
import TempAccessDialog from './panels/TempAccessDialog';

const TABS = ['Profile', 'Permissions', 'Audit log'];

const UserDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState('Profile');
  const [resetOpen, setResetOpen] = useState(false);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [tempOpen, setTempOpen] = useState(false);
  const [confirmState, setConfirmState] = useState({ open: false });

  const { data: user, isLoading, isError, refetch } = useUser(id);
  const deactivate = useDeactivateUser();
  const activate = useActivateUser();

  const openConfirm = (opts) => setConfirmState({ open: true, ...opts });
  const closeConfirm = () => setConfirmState({ open: false });

  const handleDeactivate = () => openConfirm({
    title: 'Deactivate user?',
    message: `${user.full_name} will lose access immediately. Their active session will be invalidated.`,
    confirmLabel: 'Deactivate',
    confirmClassName: 'bg-red-600 hover:bg-red-700',
    onConfirm: () => { deactivate.mutate(id); closeConfirm(); },
  });

  const handleActivate = () => openConfirm({
    title: 'Activate user?',
    message: `${user.full_name} will regain access to IDMS.`,
    confirmLabel: 'Activate',
    confirmClassName: 'bg-primary-600 hover:bg-primary-700',
    onConfirm: () => { activate.mutate(id); closeConfirm(); },
  });

  if (isLoading) return <LoadingSpinner message="Loading user profile..." />;

  if (isError || !user) return (
    <div className="py-20 text-center">
      <p className="text-sm text-red-500">Failed to load user.</p>
      <button onClick={() => navigate('/users')}
        className="mt-3 text-sm text-primary-600 hover:underline">
        Back to users
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Back */}
      <button onClick={() => navigate('/users')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" /> Back to users
      </button>

      {/* Header card */}
      <div className="rounded-xl bg-white p-6 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <UserAvatar fullName={user.full_name} userType={user.user_type} size="lg" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">{user.full_name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="text-sm text-gray-500">@{user.username}</span>
                <span className="text-gray-300">·</span>
                <RoleBadge userType={user.user_type} />
                <StatusPill user={user} />
              </div>
              {user.email && (
                <p className="mt-1 text-xs text-gray-400">{user.email}</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setResetOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              <Key className="w-4 h-4" /> Reset password
            </button>
            <button onClick={() => setCloneOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              <Copy className="w-4 h-4" /> Clone
            </button>
            <button onClick={() => setTempOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              <Clock className="w-4 h-4" /> Temp access
            </button>
            {user.is_active
              ? (
                <button onClick={handleDeactivate}
                  className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
                  <UserX className="w-4 h-4" /> Deactivate
                </button>
              ) : (
                <button onClick={handleActivate}
                  className="flex items-center gap-1.5 rounded-lg border border-green-200 bg-white px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-50">
                  <UserCheck className="w-4 h-4" /> Activate
                </button>
              )
            }
          </div>
        </div>
      </div>

      {/* Tab panel */}
      <div className="overflow-hidden rounded-xl bg-white shadow-card">
        <div className="flex border-b border-gray-100">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-3 text-sm font-medium transition-colors
                ${tab === t
                  ? 'border-b-2 border-primary-600 text-primary-700'
                  : 'text-gray-500 hover:text-gray-700'}`}>
              {t}
            </button>
          ))}
        </div>

        <div className="p-5">
          {tab === 'Profile'      && <ProfileTab user={user} />}
          {tab === 'Permissions'  && <PermissionsTab userId={id} userType={user.user_type} />}
          {tab === 'Audit log'    && <AuditLogPanel userId={id} />}
        </div>
      </div>

      {/* Dialogs */}
      <ConfirmModal
        isOpen={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.onConfirm}
        onCancel={closeConfirm}
        confirmLabel={confirmState.confirmLabel}
        confirmClassName={confirmState.confirmClassName}
      />
      {resetOpen && (
        <ResetPasswordDialog user={user} onClose={() => setResetOpen(false)} />
      )}
      {cloneOpen && (
        <CloneUserDialog
          sourceUser={user}
          onClose={() => setCloneOpen(false)}
          onSuccess={(newId) => { setCloneOpen(false); if (newId) navigate(`/users/${newId}`); }}
        />
      )}
      {tempOpen && (
        <TempAccessDialog user={user} onClose={() => setTempOpen(false)} />
      )}
    </div>
  );
};

// ── Profile tab ──────────────────────────────────────────────────────────────

const fmt = (val) => (val !== null && val !== undefined && val !== '') ? String(val) : '—';

const fmtDate = (val) => {
  if (!val) return '—';
  try { return format(parseISO(val), 'dd MMM yyyy, HH:mm'); } catch { return val; }
};

const ProfileTab = ({ user }) => {
  const fields = [
    { label: 'Full name',    value: user.full_name },
    { label: 'Username',     value: user.username ? `@${user.username}` : null },
    { label: 'Email',        value: user.email },
    { label: 'Employee ID',  value: user.emp_id },
    { label: 'Phone',        value: user.phone },
    { label: 'Department',   value: user.department },
    { label: 'Designation',  value: user.designation },
    { label: 'Organisation', value: user.organisation },
    { label: 'User type',    value: user.user_type },
    { label: 'User kind',    value: user.user_kind },
    { label: 'MFA enabled',  value: user.mfa_enabled ? 'Yes' : 'No' },
    { label: 'Created',      value: fmtDate(user.created_at) },
    {
      label: 'Last login',
      value: user.last_login_at
        ? formatDistanceToNow(parseISO(user.last_login_at), { addSuffix: true })
        : 'Never',
    },
    { label: 'Expires', value: user.expires_at ? fmtDate(user.expires_at) : '—' },
  ];

  return (
    <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
      {fields.map(({ label, value }) => (
        <div key={label}>
          <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</dt>
          <dd className="mt-0.5 text-sm text-gray-800">{fmt(value)}</dd>
        </div>
      ))}
    </dl>
  );
};

// ── Permissions tab ──────────────────────────────────────────────────────────

const PermissionsTab = ({ userId, userType }) => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPermissionSummary(userId)
      .then(setSummary)
      .catch(() => toast.error('Failed to load permissions'))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <LoadingSpinner message="Loading permissions..." />;

  if (!summary) return (
    <p className="py-6 text-center text-sm text-gray-400">No permission data available.</p>
  );

  if (summary.is_super) return (
    <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-5 text-center">
      <p className="font-semibold text-yellow-800">Super Admin — unrestricted access</p>
      <p className="mt-1 text-xs text-yellow-600">This user bypasses all form-level permission checks.</p>
    </div>
  );

  const rights = summary.form_rights || [];

  if (rights.length === 0) return (
    <p className="py-8 text-center text-sm text-gray-400">No form rights assigned yet.</p>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
            <th className="py-2 pr-4">Form</th>
            <th className="py-2 pr-4 text-center">Create</th>
            <th className="py-2 pr-4 text-center">Read</th>
            <th className="py-2 pr-4 text-center">Update</th>
            <th className="py-2 text-center">Delete</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rights.map((r) => (
            <tr key={r.form_id} className="hover:bg-gray-50">
              <td className="py-2 pr-4 font-medium text-gray-800">
                {r.form_name || r.form_id}
              </td>
              {['can_create', 'can_read', 'can_update', 'can_delete'].map((k) => (
                <td key={k} className="py-2 pr-4 text-center">
                  {r[k]
                    ? <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                    : <span className="inline-block h-2 w-2 rounded-full bg-gray-200" />
                  }
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default UserDetail;
