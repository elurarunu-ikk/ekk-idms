import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  createUser,
  listProjects,
  listUsers,
  updateUser,
} from '../services/apiService';

const MODULES = ['dashboard', 'capture', 'entries', 'approvals', 'report', 'chat', 'projects', 'users', 'companies'];
const ACTIONS = ['view', 'add', 'edit', 'delete', 'approve'];

const createPermissionsTemplate = () => {
  const map = {};
  MODULES.forEach((module) => {
    map[module] = {};
    ACTIONS.forEach((action) => {
      map[module][action] = action === 'view';
    });
  });
  return map;
};

const blankAssignment = () => ({
  project_id: '',
  is_active: true,
  permissions: createPermissionsTemplate(),
});

const blankForm = {
  full_name: '',
  emp_code: '',
  username: '',
  password: '',
  contact_no: '',
  email: '',
  user_type: 'USER',
  is_active: true,
  force_password_change: true,
  assignments: [blankAssignment()],
};

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState(blankForm);

  const projectMap = useMemo(() => {
    const map = {};
    projects.forEach((project) => {
      map[project.id] = `${project.project_code} - ${project.name}`;
    });
    return map;
  }, [projects]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersData, projectsData] = await Promise.all([
        listUsers({}),
        listProjects({ include_inactive: false }),
      ]);
      setUsers(Array.isArray(usersData) ? usersData : []);
      setProjects(Array.isArray(projectsData) ? projectsData : []);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = () => {
    setEditingId('');
    setForm(blankForm);
  };

  const startEdit = (user) => {
    setEditingId(user.id);
    setForm({
      full_name: user.full_name || '',
      emp_code: user.emp_code || '',
      username: user.username || '',
      password: '',
      contact_no: user.contact_no || '',
      email: user.email || '',
      user_type: user.user_type || 'USER',
      is_active: Boolean(user.is_active),
      force_password_change: Boolean(user.force_password_change),
      assignments: (user.assignments || []).length
        ? user.assignments.map((assignment) => ({
            project_id: assignment.project_id,
            is_active: Boolean(assignment.is_active),
            permissions: assignment.permissions && Object.keys(assignment.permissions).length
              ? assignment.permissions
              : createPermissionsTemplate(),
          }))
        : [blankAssignment()],
    });
  };

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateAssignment = (index, updater) => {
    setForm((prev) => {
      const assignments = [...prev.assignments];
      assignments[index] = updater(assignments[index]);
      return { ...prev, assignments };
    });
  };

  const addAssignment = () => {
    setForm((prev) => ({ ...prev, assignments: [...prev.assignments, blankAssignment()] }));
  };

  const removeAssignment = (index) => {
    setForm((prev) => {
      const assignments = prev.assignments.filter((_, idx) => idx !== index);
      return { ...prev, assignments: assignments.length ? assignments : [blankAssignment()] };
    });
  };

  const validate = () => {
    if (!form.full_name.trim() || !form.emp_code.trim() || !form.username.trim() || !form.contact_no.trim() || !form.email.trim()) {
      toast.error('Fill all mandatory user fields');
      return false;
    }
    if (!editingId && !form.password) {
      toast.error('Password is required for new users');
      return false;
    }
    const validAssignments = form.assignments.filter((assignment) => assignment.project_id);
    if (!validAssignments.length) {
      toast.error('Assign at least one project');
      return false;
    }
    return true;
  };

  const save = async () => {
    if (!validate()) return;

    setSaving(true);
    try {
      const payload = {
        full_name: form.full_name.trim(),
        emp_code: form.emp_code.trim(),
        username: form.username.trim(),
        contact_no: form.contact_no.trim(),
        email: form.email.trim(),
        user_type: form.user_type,
        is_active: Boolean(form.is_active),
        force_password_change: Boolean(form.force_password_change),
        assignments: form.assignments
          .filter((assignment) => assignment.project_id)
          .map((assignment) => ({
            project_id: assignment.project_id,
            is_active: Boolean(assignment.is_active),
            permissions: assignment.permissions,
          })),
      };

      if (form.password.trim()) {
        payload.password = form.password;
      }

      if (editingId) {
        await updateUser(editingId, payload);
        toast.success('User updated');
      } else {
        await createUser(payload);
        toast.success('User created');
      }

      resetForm();
      await loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading users..." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        <button
          type="button"
          onClick={resetForm}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          New User
        </button>
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">{editingId ? 'Edit User' : 'Create User'}</h2>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <input value={form.full_name} onChange={(e) => updateField('full_name', e.target.value)} placeholder="Full name" className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
          <input value={form.emp_code} onChange={(e) => updateField('emp_code', e.target.value)} placeholder="EMP code" className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
          <input value={form.username} onChange={(e) => updateField('username', e.target.value)} placeholder="Username" className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
          <input value={form.email} onChange={(e) => updateField('email', e.target.value)} placeholder="Email" className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
          <input value={form.contact_no} onChange={(e) => updateField('contact_no', e.target.value)} placeholder="Contact no" className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
          <input value={form.password} onChange={(e) => updateField('password', e.target.value)} placeholder={editingId ? 'Reset password (optional)' : 'Password'} type="password" className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
          <select value={form.user_type} onChange={(e) => updateField('user_type', e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
            <option value="SUPER ADMIN">SUPER ADMIN</option>
            <option value="ADMIN">ADMIN</option>
            <option value="SITE-ADMIN">SITE-ADMIN</option>
            <option value="USER">USER</option>
          </select>
          <label className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.is_active} onChange={(e) => updateField('is_active', e.target.checked)} />
            Active
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 md:col-span-2">
            <input type="checkbox" checked={form.force_password_change} onChange={(e) => updateField('force_password_change', e.target.checked)} />
            Force password change on next login
          </label>
        </div>

        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">Project Assignments and RBAC</h3>
            <button type="button" onClick={addAssignment} className="rounded bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-200">Add Assignment</button>
          </div>

          {form.assignments.map((assignment, index) => (
            <div key={`assignment-${index}`} className="rounded-lg border border-gray-200 p-3">
              <div className="mb-2 flex items-center gap-2">
                <select
                  value={assignment.project_id}
                  onChange={(e) => updateAssignment(index, (prev) => ({ ...prev, project_id: e.target.value }))}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Select project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>{project.project_code} - {project.name}</option>
                  ))}
                </select>
                <label className="flex items-center gap-1 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={assignment.is_active}
                    onChange={(e) => updateAssignment(index, (prev) => ({ ...prev, is_active: e.target.checked }))}
                  />
                  Active
                </label>
                <button type="button" onClick={() => removeAssignment(index)} className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200">Remove</button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-600">
                      <th className="px-2 py-1">Module</th>
                      {ACTIONS.map((action) => <th key={action} className="px-2 py-1">{action}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {MODULES.map((module) => (
                      <tr key={`${index}-${module}`} className="border-t border-gray-100">
                        <td className="px-2 py-1 font-medium text-gray-700">{module}</td>
                        {ACTIONS.map((action) => (
                          <td key={`${index}-${module}-${action}`} className="px-2 py-1">
                            <input
                              type="checkbox"
                              checked={Boolean(assignment.permissions?.[module]?.[action])}
                              onChange={(e) =>
                                updateAssignment(index, (prev) => ({
                                  ...prev,
                                  permissions: {
                                    ...prev.permissions,
                                    [module]: {
                                      ...(prev.permissions?.[module] || {}),
                                      [action]: e.target.checked,
                                    },
                                  },
                                }))
                              }
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex gap-2">
          <button type="button" onClick={save} disabled={saving} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60">{saving ? 'Saving...' : editingId ? 'Update' : 'Create'}</button>
          {editingId ? <button type="button" onClick={resetForm} className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300">Cancel</button> : null}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl bg-white p-5 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-600">
              <th className="px-2 py-2">Name</th>
              <th className="px-2 py-2">User</th>
              <th className="px-2 py-2">Email</th>
              <th className="px-2 py-2">Type</th>
              <th className="px-2 py-2">Assignments</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-gray-100">
                <td className="px-2 py-2">{user.full_name}</td>
                <td className="px-2 py-2">{user.username}</td>
                <td className="px-2 py-2">{user.email}</td>
                <td className="px-2 py-2">{user.user_type}</td>
                <td className="px-2 py-2">{(user.assignments || []).map((assignment) => projectMap[assignment.project_id] || assignment.project_code || 'Unknown').join(', ') || '-'}</td>
                <td className="px-2 py-2">{user.is_active ? 'Active' : 'Inactive'}</td>
                <td className="px-2 py-2">
                  <button type="button" onClick={() => startEdit(user)} className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700">Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UserManagement;
