import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Key, Copy, UserX, UserCheck, Clock, Monitor, Smartphone, RotateCcw, LogOut, MapPin, Pencil, X, Check } from 'lucide-react';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';
import { useUser, useDeactivateUser, useActivateUser, useUserDeviceSessions, useResetDevice, useForceLogout, useUserSites, useUpdateUserSites } from '../../hooks/useUsers';
import { getPermissionSummary, getApiErrorMessage, listSites, listCompanies } from '../../services/apiService';
import UserAvatar from '../../components/users/UserAvatar';
import RoleBadge from '../../components/users/RoleBadge';
import StatusPill from '../../components/users/StatusPill';
import LoadingSpinner from '../../components/LoadingSpinner';
import ConfirmModal from '../../components/ConfirmModal';
import AuditLogPanel from './panels/AuditLogPanel';
import CloneUserDialog from './panels/CloneUserDialog';
import ResetPasswordDialog from './panels/ResetPasswordDialog';
import TempAccessDialog from './panels/TempAccessDialog';

const TABS = ['Profile', 'Sessions', 'Permissions', 'Audit log'];

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
          {tab === 'Sessions'     && <SessionsTab userId={id} />}
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

const PRIVILEGED_TYPES = ['SUPER_ADMIN', 'SUPER ADMIN', 'ADMIN', 'HO_USER'];

const ProfileTab = ({ user }) => {
  const [sitesOpen, setSitesOpen] = useState(false);
  const showSites = !PRIVILEGED_TYPES.includes(user.user_type || '');

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
    <div className="space-y-6">
      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
        {fields.map(({ label, value }) => (
          <div key={label}>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</dt>
            <dd className="mt-0.5 text-sm text-gray-800">{fmt(value)}</dd>
          </div>
        ))}
      </dl>

      {/* Site assignments — shown for SITE_ADMIN and USER types */}
      {showSites && (
        <>
          <SiteAssignmentSection userId={user.id} onEdit={() => setSitesOpen(true)} />
          {sitesOpen && (
            <SitesEditPanel userId={user.id} onClose={() => setSitesOpen(false)} />
          )}
        </>
      )}
    </div>
  );
};

// ── Site assignment section (read-only display) ───────────────────────────────

const SiteAssignmentSection = ({ userId, onEdit }) => {
  const { data, isLoading } = useUserSites(userId);

  return (
    <div className="border-t border-gray-100 pt-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-gray-400" />
          <span className="text-xs font-medium uppercase tracking-wide text-gray-400">
            Assigned Sites
          </span>
        </div>
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5
                     text-xs font-medium text-gray-600 hover:bg-gray-50 transition"
        >
          <Pencil className="w-3 h-3" /> Manage
        </button>
      </div>

      {isLoading ? (
        <p className="text-xs text-gray-400">Loading…</p>
      ) : data?.is_all_sites ? (
        <p className="text-sm text-gray-500 italic">All sites (role-based)</p>
      ) : data?.sites?.length === 0 ? (
        <p className="text-sm text-amber-600 font-medium">No sites assigned — user cannot access any project data.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {data.sites.map((site) => (
            <span key={site.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary-50
                         px-3 py-1 text-xs font-medium text-primary-700 border border-primary-100">
              <MapPin className="w-3 h-3" />
              {site.project_code ? `${site.project_code} · ${site.name}` : site.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Sites edit slide-over panel ───────────────────────────────────────────────

const SitesEditPanel = ({ userId, onClose }) => {
  const { data: current, isLoading: loadingCurrent } = useUserSites(userId);
  const updateSites = useUpdateUserSites();

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => listCompanies().then((r) => r.items || r),
  });

  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [selectedSiteIds,   setSelectedSiteIds]   = useState([]);

  const { data: availableSites = [] } = useQuery({
    queryKey: ['sites', selectedCompanyId],
    queryFn: () => listSites({ company_id: selectedCompanyId }).then((r) => r.items || r),
    enabled: !!selectedCompanyId,
  });

  // Pre-populate from existing assignments once loaded; auto-select their company too
  useEffect(() => {
    if (!current || loadingCurrent) return;
    setSelectedSiteIds(current.sites.map((s) => s.id));
    const firstCompanyId = current.sites[0]?.company_id;
    if (firstCompanyId) {
      setSelectedCompanyId(firstCompanyId);
    }
  }, [current, loadingCurrent]);

  const toggle = (id) =>
    setSelectedSiteIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );

  const handleSave = () => {
    updateSites.mutate(
      { id: userId, payload: { site_ids: selectedSiteIds, company_id: selectedCompanyId || null } },
      { onSuccess: onClose }
    );
  };

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/20" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-40 w-[420px] bg-white
                      shadow-2xl border-l border-gray-200 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-gray-500" />
            <span className="font-semibold text-gray-800">Manage Site Access</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Company selector */}
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">
              Company
            </label>
            <div className="space-y-2">
              {companies.map((c) => (
                <label key={c.id} className="flex cursor-pointer items-center gap-2">
                  <input type="radio" name="company" value={c.id}
                    checked={selectedCompanyId === c.id}
                    onChange={() => {
                      setSelectedCompanyId(c.id);
                      // Only clear site selection if switching AWAY from the user's
                      // originally-configured company. Returning to it should restore
                      // the original selection, not wipe it again.
                      const originalCompanyId = current?.sites?.[0]?.company_id;
                      if (c.id !== originalCompanyId) {
                        setSelectedSiteIds([]);
                      } else {
                        setSelectedSiteIds(current.sites.map((s) => s.id));
                      }
                    }}
                    className="text-primary-600" />
                  <span className="text-sm font-medium text-gray-700">{c.name}</span>
                </label>
              ))}
              {companies.length === 0 && (
                <p className="text-sm text-gray-400">No companies found.</p>
              )}
            </div>
          </div>

          {/* Site list */}
          {selectedCompanyId && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium uppercase tracking-wide text-gray-400">
                  Sites
                </label>
                <div className="flex gap-3 text-xs">
                  <button type="button" onClick={() => setSelectedSiteIds(availableSites.map((s) => s.id))}
                    className="text-primary-600 hover:underline">All</button>
                  <button type="button" onClick={() => setSelectedSiteIds([])}
                    className="text-gray-400 hover:underline">None</button>
                </div>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {availableSites.length === 0 ? (
                  <p className="text-sm text-gray-400">No sites in this company.</p>
                ) : availableSites.map((site) => (
                  <label key={site.id} className="flex cursor-pointer items-center gap-2 rounded-lg
                                                   px-2 py-1.5 hover:bg-gray-50">
                    <input type="checkbox" checked={selectedSiteIds.includes(site.id)}
                      onChange={() => toggle(site.id)}
                      className="rounded text-primary-600" />
                    <span className="text-sm text-gray-700">
                      {site.project_code ? `${site.project_code} · ${site.name}` : site.name}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Zero-site warning */}
          {selectedSiteIds.length === 0 && (
            <p className="text-xs text-amber-600 mt-2">
              No sites selected — this user will not be able to access any project data until a site is assigned.
            </p>
          )}

          {/* Selected summary */}
          {selectedSiteIds.length > 0 && (
            <div className="rounded-lg bg-primary-50 border border-primary-100 p-3">
              <p className="text-xs font-medium text-primary-700 mb-2">
                {selectedSiteIds.length} site{selectedSiteIds.length !== 1 ? 's' : ''} selected
              </p>
              <div className="flex flex-wrap gap-1.5">
                {availableSites
                  .filter((s) => selectedSiteIds.includes(s.id))
                  .map((s) => (
                    <span key={s.id}
                      className="inline-flex items-center gap-1 rounded-full bg-white
                                 border border-primary-200 px-2.5 py-0.5 text-xs text-primary-700">
                      {s.project_code || s.name}
                      <button onClick={() => toggle(s.id)} className="ml-0.5 text-primary-400 hover:text-primary-700">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
              </div>
            </div>
          )}

          {!selectedCompanyId && (
            <p className="text-sm text-gray-400 text-center pt-4">
              Select a company above to see available sites.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 flex gap-2">
          <button onClick={onClose}
            className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm
                       font-medium text-gray-700 hover:bg-gray-50 transition">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={updateSites.isPending}
            className="flex-1 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium
                       text-white hover:bg-primary-700 transition disabled:opacity-50"
          >
            {updateSites.isPending ? 'Saving…' : (
              <span className="flex items-center justify-center gap-1.5">
                <Check className="w-4 h-4" /> Save Sites
              </span>
            )}
          </button>
        </div>
      </div>
    </>
  );
};

// ── Sessions tab ─────────────────────────────────────────────────────────────

const fmtAgo = (val) => {
  if (!val) return null;
  try { return formatDistanceToNow(parseISO(val), { addSuffix: true }); } catch { return val; }
};

const SessionCard = ({ icon: Icon, title, session, registeredDevice, onResetDevice, onForceLogout, resetting, loggingOut }) => {
  const isMobile = title === 'Mobile';
  const hasSession = !!session;
  const isActive = session?.is_active;
  const hasDevice = !!registeredDevice;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Icon className="w-5 h-5 text-gray-500" />
        <span className="font-semibold text-gray-800">{title}</span>
        {hasSession && isActive && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 border border-green-200">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" /> Active
          </span>
        )}
        {hasSession && !isActive && (
          <span className="ml-auto inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 border border-amber-200">Expired</span>
        )}
        {!hasSession && (
          <span className="ml-auto inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">No session</span>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Last seen</dt>
          <dd className="mt-0.5 text-gray-700">{fmtAgo(session?.last_seen_at) || '—'}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Session expires</dt>
          <dd className="mt-0.5 text-gray-700">{fmtAgo(session?.expires_at) || '—'}</dd>
        </div>
        {isMobile && (
          <>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Device name</dt>
              <dd className="mt-0.5 text-gray-700">
                {registeredDevice?.device_label || session?.device_label || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Device ID (last 8)</dt>
              <dd className="mt-0.5 font-mono text-xs text-gray-500">
                {registeredDevice?.device_id_hint || session?.device_id_hint || '—'}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Registered</dt>
              <dd className="mt-0.5 text-gray-700">{fmtAgo(registeredDevice?.registered_at) || '—'}</dd>
            </div>
          </>
        )}
      </dl>

      <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-100">
        {isMobile && (
          <button
            onClick={onResetDevice}
            disabled={!hasDevice || resetting}
            className="flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-700 hover:bg-orange-100 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {resetting ? 'Resetting…' : 'Reset Device'}
          </button>
        )}
        <button
          onClick={onForceLogout}
          disabled={!hasSession || !isActive || loggingOut}
          className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <LogOut className="w-3.5 h-3.5" />
          {loggingOut ? 'Logging out…' : 'Force Logout'}
        </button>
      </div>
    </div>
  );
};

const SessionsTab = ({ userId }) => {
  const { data, isLoading, isError } = useUserDeviceSessions(userId);
  const resetDevice = useResetDevice();
  const forceLogout = useForceLogout();
  const [confirmState, setConfirmState] = useState({ open: false });

  const openConfirm = (opts) => setConfirmState({ open: true, ...opts });
  const closeConfirm = () => setConfirmState({ open: false });

  if (isLoading) return <LoadingSpinner message="Loading session info…" />;
  if (isError) return <p className="py-6 text-center text-sm text-red-500">Failed to load session data.</p>;

  const handleResetDevice = () => openConfirm({
    title: 'Reset mobile device?',
    message: 'This will clear the registered device and end any active mobile session. The user must re-register their device on next login.',
    confirmLabel: 'Reset Device',
    confirmClassName: 'bg-orange-600 hover:bg-orange-700',
    onConfirm: () => { resetDevice.mutate(userId); closeConfirm(); },
  });

  const handleForceLogout = (platform) => openConfirm({
    title: `Force logout (${platform})?`,
    message: `This will immediately end the user's active ${platform} session and revoke their token. Note: the user can log back in unless their account is deactivated.`,
    confirmLabel: 'Force Logout',
    confirmClassName: 'bg-red-600 hover:bg-red-700',
    onConfirm: () => { forceLogout.mutate({ id: userId, platform }); closeConfirm(); },
  });

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SessionCard
          icon={Monitor}
          title="Web"
          session={data?.web}
          onForceLogout={() => handleForceLogout('web')}
          loggingOut={forceLogout.isPending}
        />
        <SessionCard
          icon={Smartphone}
          title="Mobile"
          session={data?.mobile}
          registeredDevice={data?.registered_device}
          onResetDevice={handleResetDevice}
          onForceLogout={() => handleForceLogout('mobile')}
          resetting={resetDevice.isPending}
          loggingOut={forceLogout.isPending}
        />
      </div>
      <p className="mt-3 text-xs text-gray-400">
        Force Logout revokes the active token immediately but does not block re-login. To permanently remove access, use <strong>Deactivate</strong> on the user profile.
      </p>
      <ConfirmModal
        isOpen={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.onConfirm}
        onCancel={closeConfirm}
        confirmLabel={confirmState.confirmLabel}
        confirmClassName={confirmState.confirmClassName}
      />
    </>
  );
};

// ── Permissions tab ──────────────────────────────────────────────────────────

const PERM_ACTIONS = ['view', 'add', 'edit', 'delete', 'approve'];

const SitePermissionTable = ({ site }) => {
  const modules = Object.keys(site.permissions || {});
  if (modules.length === 0) return (
    <p className="text-xs text-gray-400 italic">No module permissions recorded.</p>
  );
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
            <th className="py-2 pr-4">Module</th>
            {PERM_ACTIONS.map((a) => (
              <th key={a} className="py-2 pr-3 text-center">{a.charAt(0).toUpperCase() + a.slice(1)}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {modules.map((mod) => (
            <tr key={mod} className="hover:bg-gray-50">
              <td className="py-2 pr-4 font-medium text-gray-800 capitalize">{mod}</td>
              {PERM_ACTIONS.map((action) => (
                <td key={action} className="py-2 pr-3 text-center">
                  {site.permissions[mod]?.[action]
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

  const sites = summary.sites_with_permissions || [];

  if (sites.length === 0) return (
    <p className="py-8 text-center text-sm text-gray-400">No project access assigned yet.</p>
  );

  return (
    <div className="space-y-6">
      {sites.map((site) => (
        <div key={site.project_id}>
          <div className="mb-3 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-semibold text-gray-800">
              {site.project_code ? `${site.project_code} · ${site.project_name}` : site.project_name}
            </span>
          </div>
          <SitePermissionTable site={site} />
        </div>
      ))}
    </div>
  );
};

export default UserDetail;
