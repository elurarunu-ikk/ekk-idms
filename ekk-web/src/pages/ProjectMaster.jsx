import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  createProject,
  listCompanies,
  listProjects,
  updateProjectMaster,
} from '../services/apiService';

const emptyForm = {
  project_code: '',
  name: '',
  company_id: '',
  site_type: 'Road',
  department_type: 'Private',
  city: '',
  state: '',
  country: 'India',
  is_active: true,
};

const ProjectMaster = () => {
  const [projects, setProjects] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState(emptyForm);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [projectData, companyData] = await Promise.all([
        listProjects({ include_inactive: true }),
        listCompanies({ include_inactive: false }),
      ]);
      setProjects(Array.isArray(projectData) ? projectData : []);
      setCompanies(Array.isArray(companyData) ? companyData : []);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to load project master');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const resetForm = () => {
    setEditingId('');
    setForm(emptyForm);
  };

  const startEdit = (project) => {
    setEditingId(project.id);
    setForm({
      project_code: project.project_code || '',
      name: project.name || '',
      company_id: project.company_id || '',
      site_type: project.site_type || 'Road',
      department_type: project.department_type || 'Private',
      city: project.city || '',
      state: project.state || '',
      country: project.country || 'India',
      is_active: Boolean(project.is_active),
    });
  };

  const save = async () => {
    if (!form.project_code.trim() || !form.name.trim() || !form.site_type || !form.department_type) {
      toast.error('Project code, name, site type and department type are required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        project_code: form.project_code.trim(),
        name: form.name.trim(),
        company_id: form.company_id || null,
        site_type: form.site_type,
        department_type: form.department_type,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        country: form.country.trim() || null,
        is_active: Boolean(form.is_active),
      };

      if (editingId) {
        await updateProjectMaster(editingId, payload);
        toast.success('Project updated');
      } else {
        await createProject(payload);
        toast.success('Project created');
      }

      resetForm();
      await loadAll();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save project');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading projects..." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Project Master</h1>
        <button
          type="button"
          onClick={resetForm}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          New Project
        </button>
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">{editingId ? 'Edit Project' : 'Create Project'}</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <input
            value={form.project_code}
            onChange={(e) => setForm((prev) => ({ ...prev, project_code: e.target.value }))}
            placeholder="Project code"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          <input
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Project name"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          <select
            value={form.company_id}
            onChange={(e) => setForm((prev) => ({ ...prev, company_id: e.target.value }))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="">No company</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.company_code} - {company.name}
              </option>
            ))}
          </select>
          <select
            value={form.site_type}
            onChange={(e) => setForm((prev) => ({ ...prev, site_type: e.target.value }))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="Road">Road</option>
            <option value="Structure">Structure</option>
            <option value="Drain">Drain</option>
            <option value="Building">Building</option>
          </select>
          <select
            value={form.department_type}
            onChange={(e) => setForm((prev) => ({ ...prev, department_type: e.target.value }))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="Private">Private</option>
            <option value="Govt">Govt</option>
          </select>
          <input
            value={form.city}
            onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
            placeholder="City"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          <input
            value={form.state}
            onChange={(e) => setForm((prev) => ({ ...prev, state: e.target.value }))}
            placeholder="State"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          <input
            value={form.country}
            onChange={(e) => setForm((prev) => ({ ...prev, country: e.target.value }))}
            placeholder="Country"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          <label className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
            />
            Active
          </label>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
          >
            {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
          </button>
          {editingId ? (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
            >
              Cancel
            </button>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl bg-white p-5 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-600">
              <th className="px-2 py-2">Code</th>
              <th className="px-2 py-2">Name</th>
              <th className="px-2 py-2">Company</th>
              <th className="px-2 py-2">Type</th>
              <th className="px-2 py-2">Department</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.id} className="border-b border-gray-100">
                <td className="px-2 py-2">{project.project_code}</td>
                <td className="px-2 py-2">{project.name}</td>
                <td className="px-2 py-2">{project.company_name || '-'}</td>
                <td className="px-2 py-2">{project.site_type || '-'}</td>
                <td className="px-2 py-2">{project.department_type || '-'}</td>
                <td className="px-2 py-2">{project.is_active ? 'Active' : 'Inactive'}</td>
                <td className="px-2 py-2">
                  <button
                    type="button"
                    onClick={() => startEdit(project)}
                    className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProjectMaster;
