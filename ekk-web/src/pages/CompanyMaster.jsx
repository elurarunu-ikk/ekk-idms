import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';
import { createCompany, listCompanies, updateCompany } from '../services/apiService';

const emptyForm = {
  company_code: '',
  name: '',
  is_active: true,
};

const CompanyMaster = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState(emptyForm);

  const loadCompanies = async () => {
    setLoading(true);
    try {
      const data = await listCompanies({ include_inactive: true });
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to load companies');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompanies();
  }, []);

  const startCreate = () => {
    setEditingId('');
    setForm(emptyForm);
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setForm({
      company_code: item.company_code || '',
      name: item.name || '',
      is_active: Boolean(item.is_active),
    });
  };

  const save = async () => {
    if (!form.company_code.trim() || !form.name.trim()) {
      toast.error('Company code and name are required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        company_code: form.company_code.trim(),
        name: form.name.trim(),
        is_active: Boolean(form.is_active),
      };

      if (editingId) {
        await updateCompany(editingId, payload);
        toast.success('Company updated');
      } else {
        await createCompany(payload);
        toast.success('Company created');
      }

      startCreate();
      await loadCompanies();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save company');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading companies..." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Company Master</h1>
        <button
          type="button"
          onClick={startCreate}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          New Company
        </button>
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">{editingId ? 'Edit Company' : 'Create Company'}</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <input
            value={form.company_code}
            onChange={(e) => setForm((prev) => ({ ...prev, company_code: e.target.value }))}
            placeholder="Company code"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          <input
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Company name"
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
              onClick={startCreate}
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
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-gray-100">
                <td className="px-2 py-2">{item.company_code}</td>
                <td className="px-2 py-2">{item.name}</td>
                <td className="px-2 py-2">{item.is_active ? 'Active' : 'Inactive'}</td>
                <td className="px-2 py-2">
                  <button
                    type="button"
                    onClick={() => startEdit(item)}
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

export default CompanyMaster;
