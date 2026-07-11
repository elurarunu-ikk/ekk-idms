import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow, parseISO } from 'date-fns';

const toUTC = (val) => {
  if (!val) return null;
  if (typeof val === 'string') {
    let iso = val.replace(' ', 'T');
    if (!iso.endsWith('Z') && !iso.includes('+') && !iso.includes('-', 10)) {
      iso = iso + 'Z';
    }
    return iso;
  }
  return val;
};
import {
  Search, Plus, Upload, Download, MoreVertical,
  UserCheck, UserX, Copy, Key, Clock, Eye, Pencil, X, Shield,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useUserList, useDeactivateUser, useActivateUser } from '../hooks/useUsers';
import { exportUsers, getApiErrorMessage, updateUserV2, getUserById } from '../services/apiService';
import { ROLE_LABELS, ROLE_STYLES, ROLE_DOT, CAN_CREATE } from '../constants/userConstants';
import RoleBadge from '../components/users/RoleBadge';
import UserAvatar from '../components/users/UserAvatar';
import StatusPill from '../components/users/StatusPill';
import ConfirmModal from '../components/ConfirmModal';
import StatCard from '../components/StatCard';
import LoadingSpinner from '../components/LoadingSpinner';
import BulkImportDialog from './users/panels/BulkImportDialog';
import CloneUserDialog from './users/panels/CloneUserDialog';
import ResetPasswordDialog from './users/panels/ResetPasswordDialog';
import TempAccessDialog from './users/panels/TempAccessDialog';

const ALL_MODULES = [
  { id: 'dashboard',  label: 'Dashboard' },
  { id: 'capture',    label: 'Captures' },
  { id: 'entries',    label: 'Entries' },
  { id: 'approvals',  label: 'Pending Approvals' },
  { id: 'report',     label: 'Reports' },
  { id: 'chat',       label: 'AI Assistant' },
  { id: 'projects',   label: 'Projects' },
  { id: 'users',      label: 'User Management' },
  { id: 'companies',  label: 'Companies' },
  { id: 'resources',  label: '3M Resources' },
  { id: 'masters',    label: 'Masters' },
  { id: 'gradesheet', label: 'Grade Sheet' },
  { id: 'refdata',    label: 'Reference Data' },
];

const ALL_FORM_RIGHTS = [
  { id: 'companies.view',  label: 'Companies',       module: 'companies' },
  { id: 'resources.view',  label: '3M Resources',    module: 'resources' },
  { id: 'user_mgmt.view',      label: 'User Management',  module: 'users' },
  { id: 'projects.view',       label: 'Projects',         module: 'projects' },
  { id: 'capture.create',      label: 'Submit Capture',   module: 'capture' },
  { id: 'capture.edit',        label: 'Edit Capture',     module: 'capture' },
  { id: 'approvals.approve',   label: 'Approve Entries',  module: 'approvals' },
  { id: 'report.view',         label: 'View Reports',     module: 'report' },
  { id: 'report.export',       label: 'Export Reports',   module: 'report' },
];

const MenuItem = ({ icon, label, onClick, className = '' }) => (
  <button
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 ${className}`}
  >
    {icon}
    {label}
  </button>
);

const UserTableRow = ({
  user, currentUserType, openMenuId, setOpenMenuId,
  onView, onEdit, onManageAccess, onReset, onClone, onTempAccess, onDeactivate, onActivate,
}) => {
  const menuOpen = openMenuId === user.id;

  useEffect(() => {
    if (!menuOpen) return;
    const handler = () => setOpenMenuId(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [menuOpen, setOpenMenuId]);

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3 cursor-pointer" onClick={onView}>
          <UserAvatar fullName={user.full_name} userType={user.user_type} size="sm" />
          <div>
            <div className="font-medium text-gray-900">{user.full_name}</div>
            <div className="text-xs text-gray-500">@{user.username}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <RoleBadge userType={user.user_type} />
      </td>
      <td className="px-4 py-3">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
          user.user_kind === 'internal'
            ? 'bg-emerald-50 text-emerald-700'
            : 'bg-amber-50 text-amber-700'
        }`}>
          {user.user_kind === 'internal' ? 'Internal' : 'External'}
        </span>
      </td>
      <td className="px-4 py-3">
        <StatusPill user={user} />
      </td>
      <td className="px-4 py-3 text-xs text-gray-500">
        {user.last_login_at
          ? formatDistanceToNow(parseISO(toUTC(user.last_login_at)), { addSuffix: true })
          : 'Never'}
      </td>
      <td className="px-4 py-3 text-right relative">
        <button
          onClick={e => { e.stopPropagation(); setOpenMenuId(menuOpen ? null : user.id); }}
          className="rounded-lg p-1.5 hover:bg-gray-100 text-gray-500"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
        {menuOpen && (
          <div className="absolute right-4 top-10 z-20 w-44 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
            <MenuItem icon={<Eye className="w-4 h-4" />} label="View profile" onClick={onView} />
            <MenuItem icon={<Key className="w-4 h-4" />} label="Reset password" onClick={onReset} />
            <MenuItem icon={<Copy className="w-4 h-4" />} label="Clone user" onClick={onClone} />
            <MenuItem icon={<Pencil className="w-4 h-4" />} label="Edit details" onClick={onEdit} />
            <MenuItem icon={<Shield className="w-4 h-4" />} label="Manage access" onClick={onManageAccess} />
            <MenuItem icon={<Clock className="w-4 h-4" />} label="Temp access" onClick={onTempAccess} />
            <div className="my-1 border-t border-gray-100" />
            {user.is_active
              ? <MenuItem icon={<UserX className="w-4 h-4" />} label="Deactivate"
                  onClick={onDeactivate} className="text-red-600 hover:bg-red-50" />
              : <MenuItem icon={<UserCheck className="w-4 h-4" />} label="Activate"
                  onClick={onActivate} className="text-green-600 hover:bg-green-50" />
            }
          </div>
        )}
      </td>
    </tr>
  );
};

const UserMobileCard = ({
  user, currentUserType, onView, onReset, onClone, onDeactivate, onActivate,
}) => (
  <div className="p-4 flex items-start gap-3">
    <UserAvatar fullName={user.full_name} userType={user.user_type} size="md" />
    <div className="flex-1 min-w-0 cursor-pointer" onClick={onView}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-gray-900 truncate">{user.full_name}</span>
        <StatusPill user={user} />
      </div>
      <div className="text-xs text-gray-500 mt-0.5">@{user.username}</div>
      <div className="flex items-center gap-2 mt-1.5">
        <RoleBadge userType={user.user_type} size="sm" />
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
          user.user_kind === 'internal'
            ? 'bg-emerald-50 text-emerald-700'
            : 'bg-amber-50 text-amber-700'
        }`}>
          {user.user_kind === 'internal' ? 'Internal' : 'External'}
        </span>
      </div>
    </div>
    <button
      onClick={onView}
      className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 flex-shrink-0"
    >
      View
    </button>
  </div>
);

const UserManagement = () => {
  const navigate = useNavigate();
  const currentUserType = localStorage.getItem('user_type') || 'USER';
  const currentUsername = localStorage.getItem('username') || '';

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [userTypeFilter, setUserTypeFilter] = useState('');
  const [userKindFilter, setUserKindFilter] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  const [confirmState, setConfirmState] = useState({
    open: false, title: '', message: '', onConfirm: null,
    confirmLabel: 'Confirm', confirmClassName: 'bg-red-600 hover:bg-red-700',
  });
  const [cloneTarget, setCloneTarget] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [tempAccessTarget, setTempAccessTarget] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [editLoading, setEditLoading] = useState(false);


  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const filters = {
    q: debouncedSearch || undefined,
    user_type: userTypeFilter || undefined,
    user_kind: userKindFilter || undefined,
    is_active: showInactive ? undefined : true,
  };

  const { data, isLoading, isError, refetch } = useUserList(filters);
  const users = data?.items || data || [];
  const total = data?.total || users.length;

  const deactivateMutation = useDeactivateUser();
  const activateMutation = useActivateUser();

  const stats = {
    total,
    active: users.filter(u => u.is_active).length,
    internal: users.filter(u => u.user_kind === 'internal').length,
    external: users.filter(u => u.user_kind === 'external').length,
  };

  const openConfirm = ({ title, message, onConfirm, confirmLabel = 'Confirm',
    confirmClassName = 'bg-red-600 hover:bg-red-700' }) => {
    setConfirmState({ open: true, title, message, onConfirm, confirmLabel, confirmClassName });
  };

  const closeConfirm = () =>
    setConfirmState(prev => ({ ...prev, open: false, onConfirm: null }));

  const handleDeactivate = (user) => {
    openConfirm({
      title: 'Deactivate user?',
      message: `${user.full_name} will lose access immediately. Their active session will be invalidated.`,
      confirmLabel: 'Deactivate',
      onConfirm: () => { deactivateMutation.mutate(user.id); closeConfirm(); },
    });
  };

  const handleActivate = (user) => {
    openConfirm({
      title: 'Activate user?',
      message: `${user.full_name} will regain access to IDMS.`,
      confirmLabel: 'Activate',
      confirmClassName: 'bg-primary-600 hover:bg-primary-700',
      onConfirm: () => { activateMutation.mutate(user.id); closeConfirm(); },
    });
  };

  const handleExport = async () => {
    try {
      const blob = await exportUsers(filters);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `users_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Export failed'));
    }
  };

  const handleEditOpen = async (user) => {
    setOpenMenuId(null);
    setEditLoading(true);
    setEditUser(user);
    try {
      const full = await getUserById(user.id);
      setEditForm({
        full_name:    full.full_name    || '',
        email:        full.email        || '',
        phone:        full.phone        || '',
        department:   full.department   || '',
        designation:  full.designation  || '',
        organisation: full.organisation || '',
        user_type:    full.user_type    || 'USER',
      });
    } catch {
      toast.error('Failed to load user details');
      setEditUser(null);
    } finally {
      setEditLoading(false);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setUserTypeFilter('');
    setUserKindFilter('');
    setShowInactive(false);
  };

  const hasFilters = search || userTypeFilter || userKindFilter || showInactive;

  return (
    <div className="space-y-4">

      {/* TOOLBAR */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-sm font-medium text-gray-600">
            {total}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Upload className="w-4 h-4" /> Import
          </button>
          {currentUserType === 'SUPER_ADMIN' && (
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Download className="w-4 h-4" /> Export
            </button>
          )}
          <button
            onClick={() => navigate('/users/new')}
            className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            <Plus className="w-4 h-4" /> New User
          </button>
        </div>
      </div>

      {/* ACTIVITY STATS */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard title="Total Users" value={stats.total}    color="gray"   />
        <StatCard title="Active"      value={stats.active}   color="green"  />
        <StatCard title="Internal"    value={stats.internal} color="gray"   />
        <StatCard title="External"    value={stats.external} color="yellow" />
      </div>

      {/* FILTER BAR */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-3 shadow-card">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, username, emp ID..."
            className="w-full rounded-lg border border-gray-200 pl-9 pr-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
        <select
          value={userTypeFilter}
          onChange={e => setUserTypeFilter(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
        >
          <option value="">All types</option>
          <option value="SUPER_ADMIN">Super Admin</option>
          <option value="ADMIN">Admin</option>
          <option value="HO_USER">HO User</option>
          <option value="SITE_ADMIN">Site Admin</option>
          <option value="USER">User</option>
        </select>
        <select
          value={userKindFilter}
          onChange={e => setUserKindFilter(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
        >
          <option value="">All kinds</option>
          <option value="internal">Internal</option>
          <option value="external">External</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={e => setShowInactive(e.target.checked)}
            className="rounded border-gray-300"
          />
          Show inactive
        </label>
        {hasFilters && (
          <button onClick={clearFilters} className="text-sm text-primary-600 hover:underline">
            Clear filters
          </button>
        )}
      </div>

      {/* USER TABLE */}
      <div className="rounded-xl bg-white shadow-card overflow-hidden">
        {isLoading ? (
          <LoadingSpinner message="Loading users..." />
        ) : isError ? (
          <div className="py-10 text-center text-sm text-red-500">Failed to load users.</div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center">
            <div className="text-4xl mb-3">👥</div>
            <p className="text-gray-500 text-sm">
              {search || userTypeFilter || userKindFilter
                ? 'No users match your filters.'
                : 'No users yet.'}
            </p>
            {(search || userTypeFilter || userKindFilter) ? (
              <button
                onClick={() => { setSearch(''); setUserTypeFilter(''); setUserKindFilter(''); }}
                className="mt-2 text-sm text-primary-600 hover:underline"
              >
                Clear filters
              </button>
            ) : (
              <button
                onClick={() => navigate('/users/new')}
                className="mt-3 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
              >
                Create first user
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Kind</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Last login</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {users.map(user => (
                    <UserTableRow
                      key={user.id}
                      user={user}
                      currentUserType={currentUserType}
                      openMenuId={openMenuId}
                      setOpenMenuId={setOpenMenuId}
                      onView={() => navigate(`/users/${user.id}`)}
                      onEdit={() => handleEditOpen(user)}
                      onManageAccess={() => {
                        setOpenMenuId(null);
                        navigate(`/users/${user.id}/access`);
                      }}
                      onReset={() => setResetTarget(user)}
                      onClone={() => setCloneTarget(user)}
                      onTempAccess={() => setTempAccessTarget(user)}
                      onDeactivate={() => handleDeactivate(user)}
                      onActivate={() => handleActivate(user)}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card stack */}
            <div className="md:hidden divide-y divide-gray-100">
              {users.map(user => (
                <UserMobileCard
                  key={user.id}
                  user={user}
                  currentUserType={currentUserType}
                  onView={() => navigate(`/users/${user.id}`)}
                  onReset={() => setResetTarget(user)}
                  onClone={() => setCloneTarget(user)}
                  onDeactivate={() => handleDeactivate(user)}
                  onActivate={() => handleActivate(user)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* DIALOGS */}
      <ConfirmModal
        isOpen={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.onConfirm}
        onCancel={closeConfirm}
        confirmLabel={confirmState.confirmLabel}
        confirmClassName={confirmState.confirmClassName}
      />
      {importOpen && (
        <BulkImportDialog
          onClose={() => setImportOpen(false)}
          onSuccess={() => setImportOpen(false)}
        />
      )}
      {cloneTarget && (
        <CloneUserDialog
          sourceUser={cloneTarget}
          onClose={() => setCloneTarget(null)}
          onSuccess={(newId) => { setCloneTarget(null); navigate(`/users/${newId}`); }}
        />
      )}
      {resetTarget && (
        <ResetPasswordDialog
          user={resetTarget}
          onClose={() => setResetTarget(null)}
        />
      )}
      {tempAccessTarget && (
        <TempAccessDialog
          user={tempAccessTarget}
          onClose={() => setTempAccessTarget(null)}
        />
      )}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Edit User</h3>
              <button onClick={() => setEditUser(null)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
              <span className="text-xs text-gray-500">Account type:</span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                editUser?.user_kind === 'internal'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-amber-100 text-amber-700'
              }`}>
                {editUser?.user_kind === 'internal' ? 'Internal' : 'External'}
              </span>
              <span className="text-xs text-gray-400 ml-1">· Cannot be changed after creation</span>
            </div>
            {editLoading && (
              <div className="flex items-center justify-center py-10 text-sm text-gray-400">
                Loading user details…
              </div>
            )}
            {!editLoading && (
              <div className="space-y-4">
                {[
                  { key: 'full_name',    label: 'Full Name *',  type: 'text'  },
                  { key: 'email',        label: 'Email *',      type: 'email' },
                  { key: 'phone',        label: 'Phone',        type: 'tel'   },
                  { key: 'department',   label: 'Department',   type: 'text'  },
                  { key: 'designation',  label: 'Designation',  type: 'text'  },
                  { key: 'organisation', label: 'Organisation', type: 'text'  },
                ].map(({ key, label, type }) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                    <input
                      type={type}
                      value={editForm[key] ?? ''}
                      onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                                 focus:border-primary-500 focus:outline-none focus:ring-1
                                 focus:ring-primary-500"
                    />
                  </div>
                ))}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">User Type</label>
                  <select
                    value={editForm.user_type ?? 'USER'}
                    onChange={e => setEditForm(f => ({ ...f, user_type: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                               focus:border-primary-500 focus:outline-none focus:ring-1
                               focus:ring-primary-500"
                  >
                    <option value="SUPER_ADMIN">Super Admin</option>
                    <option value="ADMIN">Admin</option>
                    <option value="HO_USER">HO User</option>
                    <option value="SITE_ADMIN">Site Admin</option>
                    <option value="USER">User</option>
                  </select>
                </div>
              </div>
            )}
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setEditUser(null)}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium
                           text-gray-700 hover:bg-gray-200 transition">
                Cancel
              </button>
              <button
                disabled={editSaving || !editForm.full_name || !editForm.email}
                onClick={async () => {
                  const typeChanged = editForm.user_type !== editUser.user_type;
                  const toSiteScoped = ['SITE_ADMIN', 'USER'].includes(editForm.user_type);
                  if (typeChanged) {
                    const confirmed = window.confirm(
                      `Change role from ${editUser.user_type} to ${editForm.user_type}?\n\nThis will reset their module rights to new role defaults. They will need to log in again.`
                    );
                    if (!confirmed) return;
                  }
                  setEditSaving(true);
                  try {
                    await updateUserV2(editUser.id, editForm);
                    toast.success('User updated successfully');
                    setEditUser(null);
                    if (typeChanged && toSiteScoped) {
                      toast('Assign sites to this user from their profile.', { icon: '📍' });
                      navigate(`/users/${editUser.id}`);
                    } else {
                      refetch();
                    }
                  } catch (err) {
                    toast.error(getApiErrorMessage(err, 'Failed to update user'));
                  } finally {
                    setEditSaving(false);
                  }
                }}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium
                           text-white hover:bg-primary-700 transition
                           disabled:opacity-50 disabled:cursor-not-allowed">
                {editSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default UserManagement;
