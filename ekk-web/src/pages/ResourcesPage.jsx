import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import useProjectSession from '../hooks/useProjectSession';
import {
  createMachine,
  createMaterial,
  deleteMachine,
  deleteMaterial,
  getApiErrorMessage,
  listMachines,
  listManpowerCategories,
  listMaterials,
  updateMachine,
  updateMaterial,
} from '../services/apiService';

const UNITS = ['CUM', 'MT', 'KG', 'SQM', 'LM', 'BAG', 'NOS', 'LTR', 'TON'];
const MACHINE_TYPES = ['COMPACTION', 'EARTHWORK', 'PAVING', 'CONCRETING', 'LIFTING', 'TRANSPORT', 'SURVEY', 'OTHER'];

const inp = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';
const sel = inp;

// ── Materials Tab ─────────────────────────────────────────────────────────────

const emptyMat = () => ({ material_code: '', material_name: '', unit: 'MT', rate_per_unit: '', supplier_name: '' });

function MaterialsTab({ projectId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState(null);
  const [editRow, setEditRow] = useState(null);
  const [adding, setAdding] = useState(false);
  const [newRow, setNewRow] = useState(emptyMat());
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await listMaterials(projectId, false));
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to load materials'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (projectId) load(); }, [projectId]);

  const handleAdd = async () => {
    if (!newRow.material_code.trim() || !newRow.material_name.trim()) {
      toast.error('Code and Name are required');
      return;
    }
    setSaving(true);
    try {
      await createMaterial({ ...newRow, project_id: projectId, rate_per_unit: newRow.rate_per_unit !== '' ? Number(newRow.rate_per_unit) : null });
      toast.success('Material added');
      setAdding(false);
      setNewRow(emptyMat());
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to add material'));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id) => {
    setSaving(true);
    try {
      await updateMaterial(id, { ...editRow, rate_per_unit: editRow.rate_per_unit !== '' ? Number(editRow.rate_per_unit) : null });
      toast.success('Material updated');
      setEditId(null);
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to update material'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Deactivate this material?')) return;
    try {
      await deleteMaterial(id);
      toast.success('Material deactivated');
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to deactivate material'));
    }
  };

  if (loading) return <p className="py-8 text-center text-sm text-gray-400">Loading…</p>;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-gray-500">{rows.filter(r => r.is_active).length} active material(s) for this project</p>
        <button
          onClick={() => { setAdding(true); setNewRow(emptyMat()); }}
          className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Add Material
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Code</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Name</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Unit</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Rate / Unit (₹)</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Supplier</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {adding && (
              <tr className="bg-blue-50">
                <td className="px-2 py-1"><input className={inp} value={newRow.material_code} onChange={e => setNewRow(p => ({ ...p, material_code: e.target.value.toUpperCase() }))} placeholder="e.g. BITUMEN" /></td>
                <td className="px-2 py-1"><input className={inp} value={newRow.material_name} onChange={e => setNewRow(p => ({ ...p, material_name: e.target.value }))} placeholder="Material name" /></td>
                <td className="px-2 py-1">
                  <select className={sel} value={newRow.unit} onChange={e => setNewRow(p => ({ ...p, unit: e.target.value }))}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </td>
                <td className="px-2 py-1"><input className={inp} type="number" step="0.01" value={newRow.rate_per_unit} onChange={e => setNewRow(p => ({ ...p, rate_per_unit: e.target.value }))} placeholder="0.00" /></td>
                <td className="px-2 py-1"><input className={inp} value={newRow.supplier_name} onChange={e => setNewRow(p => ({ ...p, supplier_name: e.target.value }))} placeholder="Supplier" /></td>
                <td className="px-2 py-1 text-xs text-blue-600">New</td>
                <td className="px-2 py-1">
                  <div className="flex gap-1">
                    <button onClick={handleAdd} disabled={saving} className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60">Save</button>
                    <button onClick={() => setAdding(false)} className="rounded bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200">Cancel</button>
                  </div>
                </td>
              </tr>
            )}
            {rows.length === 0 && !adding && (
              <tr><td colSpan={7} className="py-8 text-center text-sm text-gray-400">No materials yet. Add the first one.</td></tr>
            )}
            {rows.map(row => (
              <tr key={row.id} className={row.is_active ? '' : 'opacity-40'}>
                {editId === row.id ? (
                  <>
                    <td className="px-2 py-1"><span className="rounded bg-gray-100 px-2 py-1 text-xs font-mono">{row.material_code}</span></td>
                    <td className="px-2 py-1"><input className={inp} value={editRow.material_name} onChange={e => setEditRow(p => ({ ...p, material_name: e.target.value }))} /></td>
                    <td className="px-2 py-1">
                      <select className={sel} value={editRow.unit} onChange={e => setEditRow(p => ({ ...p, unit: e.target.value }))}>
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1"><input className={inp} type="number" step="0.01" value={editRow.rate_per_unit ?? ''} onChange={e => setEditRow(p => ({ ...p, rate_per_unit: e.target.value }))} /></td>
                    <td className="px-2 py-1"><input className={inp} value={editRow.supplier_name ?? ''} onChange={e => setEditRow(p => ({ ...p, supplier_name: e.target.value }))} /></td>
                    <td className="px-2 py-1 text-xs text-amber-600">Editing</td>
                    <td className="px-2 py-1">
                      <div className="flex gap-1">
                        <button onClick={() => handleUpdate(row.id)} disabled={saving} className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60">Save</button>
                        <button onClick={() => setEditId(null)} className="rounded bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200">Cancel</button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-2 font-mono text-xs font-semibold text-gray-800">{row.material_code}</td>
                    <td className="px-4 py-2 text-gray-800">{row.material_name}</td>
                    <td className="px-4 py-2 text-gray-600">{row.unit}</td>
                    <td className="px-4 py-2 text-gray-600">{row.rate_per_unit != null ? `₹${Number(row.rate_per_unit).toLocaleString()}` : '—'}</td>
                    <td className="px-4 py-2 text-gray-500">{row.supplier_name || '—'}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${row.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {row.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {row.is_active && (
                        <div className="flex gap-2">
                          <button onClick={() => { setEditId(row.id); setEditRow({ material_name: row.material_name, unit: row.unit, rate_per_unit: row.rate_per_unit ?? '', supplier_name: row.supplier_name ?? '' }); }}
                            className="text-xs font-medium text-blue-600 hover:underline">Edit</button>
                          <button onClick={() => handleDelete(row.id)} className="text-xs font-medium text-red-500 hover:underline">Deactivate</button>
                        </div>
                      )}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Machines Tab ──────────────────────────────────────────────────────────────

const emptyMac = () => ({ machine_code: '', machine_name: '', machine_type: 'OTHER', rate_per_hour: '' });

function MachinesTab({ projectId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState(null);
  const [editRow, setEditRow] = useState(null);
  const [adding, setAdding] = useState(false);
  const [newRow, setNewRow] = useState(emptyMac());
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await listMachines(projectId, false));
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to load machines'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (projectId) load(); }, [projectId]);

  const handleAdd = async () => {
    if (!newRow.machine_code.trim() || !newRow.machine_name.trim()) {
      toast.error('Code and Name are required');
      return;
    }
    setSaving(true);
    try {
      await createMachine({ ...newRow, project_id: projectId, rate_per_hour: newRow.rate_per_hour !== '' ? Number(newRow.rate_per_hour) : null });
      toast.success('Machine added');
      setAdding(false);
      setNewRow(emptyMac());
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to add machine'));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id) => {
    setSaving(true);
    try {
      await updateMachine(id, { ...editRow, rate_per_hour: editRow.rate_per_hour !== '' ? Number(editRow.rate_per_hour) : null });
      toast.success('Machine updated');
      setEditId(null);
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to update machine'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Deactivate this machine?')) return;
    try {
      await deleteMachine(id);
      toast.success('Machine deactivated');
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to deactivate machine'));
    }
  };

  if (loading) return <p className="py-8 text-center text-sm text-gray-400">Loading…</p>;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-gray-500">{rows.filter(r => r.is_active).length} active machine(s) for this project</p>
        <button
          onClick={() => { setAdding(true); setNewRow(emptyMac()); }}
          className="rounded-lg bg-orange-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-orange-600"
        >
          + Add Machine
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Code</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Name</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Type</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Rate / Hr (₹)</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {adding && (
              <tr className="bg-orange-50">
                <td className="px-2 py-1"><input className={inp} value={newRow.machine_code} onChange={e => setNewRow(p => ({ ...p, machine_code: e.target.value.toUpperCase() }))} placeholder="e.g. VIB_ROLLER" /></td>
                <td className="px-2 py-1"><input className={inp} value={newRow.machine_name} onChange={e => setNewRow(p => ({ ...p, machine_name: e.target.value }))} placeholder="Machine name" /></td>
                <td className="px-2 py-1">
                  <select className={sel} value={newRow.machine_type} onChange={e => setNewRow(p => ({ ...p, machine_type: e.target.value }))}>
                    {MACHINE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </td>
                <td className="px-2 py-1"><input className={inp} type="number" step="0.01" value={newRow.rate_per_hour} onChange={e => setNewRow(p => ({ ...p, rate_per_hour: e.target.value }))} placeholder="0.00" /></td>
                <td className="px-2 py-1 text-xs text-orange-600">New</td>
                <td className="px-2 py-1">
                  <div className="flex gap-1">
                    <button onClick={handleAdd} disabled={saving} className="rounded bg-orange-500 px-3 py-1 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-60">Save</button>
                    <button onClick={() => setAdding(false)} className="rounded bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200">Cancel</button>
                  </div>
                </td>
              </tr>
            )}
            {rows.length === 0 && !adding && (
              <tr><td colSpan={6} className="py-8 text-center text-sm text-gray-400">No machines yet. Add the first one.</td></tr>
            )}
            {rows.map(row => (
              <tr key={row.id} className={row.is_active ? '' : 'opacity-40'}>
                {editId === row.id ? (
                  <>
                    <td className="px-2 py-1"><span className="rounded bg-gray-100 px-2 py-1 text-xs font-mono">{row.machine_code}</span></td>
                    <td className="px-2 py-1"><input className={inp} value={editRow.machine_name} onChange={e => setEditRow(p => ({ ...p, machine_name: e.target.value }))} /></td>
                    <td className="px-2 py-1">
                      <select className={sel} value={editRow.machine_type ?? 'OTHER'} onChange={e => setEditRow(p => ({ ...p, machine_type: e.target.value }))}>
                        {MACHINE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1"><input className={inp} type="number" step="0.01" value={editRow.rate_per_hour ?? ''} onChange={e => setEditRow(p => ({ ...p, rate_per_hour: e.target.value }))} /></td>
                    <td className="px-2 py-1 text-xs text-amber-600">Editing</td>
                    <td className="px-2 py-1">
                      <div className="flex gap-1">
                        <button onClick={() => handleUpdate(row.id)} disabled={saving} className="rounded bg-orange-500 px-3 py-1 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-60">Save</button>
                        <button onClick={() => setEditId(null)} className="rounded bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200">Cancel</button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-2 font-mono text-xs font-semibold text-gray-800">{row.machine_code}</td>
                    <td className="px-4 py-2 text-gray-800">{row.machine_name}</td>
                    <td className="px-4 py-2 text-gray-600">{row.machine_type || '—'}</td>
                    <td className="px-4 py-2 text-gray-600">{row.rate_per_hour != null ? `₹${Number(row.rate_per_hour).toLocaleString()}` : '—'}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${row.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {row.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {row.is_active && (
                        <div className="flex gap-2">
                          <button onClick={() => { setEditId(row.id); setEditRow({ machine_name: row.machine_name, machine_type: row.machine_type ?? 'OTHER', rate_per_hour: row.rate_per_hour ?? '' }); }}
                            className="text-xs font-medium text-blue-600 hover:underline">Edit</button>
                          <button onClick={() => handleDelete(row.id)} className="text-xs font-medium text-red-500 hover:underline">Deactivate</button>
                        </div>
                      )}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Manpower Categories Tab (read-only, global) ───────────────────────────────

function ManpowerTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listManpowerCategories(false)
      .then(setRows)
      .catch(() => toast.error('Failed to load manpower categories'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="py-8 text-center text-sm text-gray-400">Loading…</p>;

  return (
    <div>
      <p className="mb-3 text-sm text-gray-500">Global categories — seeded by system. All projects share these.</p>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Code</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Name</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Subcategory</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Rate / Day (₹)</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {rows.map(row => (
              <tr key={row.id}>
                <td className="px-4 py-2 font-mono text-xs font-semibold text-gray-800">{row.category_code}</td>
                <td className="px-4 py-2 text-gray-800">{row.category_name}</td>
                <td className="px-4 py-2 text-gray-500">{row.subcategory || '—'}</td>
                <td className="px-4 py-2 text-gray-600">{row.rate_per_day != null ? `₹${Number(row.rate_per_day).toLocaleString()}` : '—'}</td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${row.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {row.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'materials', label: 'Materials', color: 'blue' },
  { id: 'machines',  label: 'Machines',  color: 'orange' },
  { id: 'manpower',  label: 'Manpower Categories', color: 'green' },
];

const ResourcesPage = () => {
  const [activeTab, setActiveTab] = useState('materials');
  const { selectedProject } = useProjectSession();
  const projectId = selectedProject?.id ?? null;

  const tabBtn = (tab) => {
    const isActive = activeTab === tab.id;
    const colorMap = { blue: 'border-blue-500 text-blue-700 bg-blue-50', orange: 'border-orange-500 text-orange-700 bg-orange-50', green: 'border-green-500 text-green-700 bg-green-50' };
    return (
      <button
        key={tab.id}
        onClick={() => setActiveTab(tab.id)}
        className={`rounded-lg border-b-2 px-5 py-2.5 text-sm font-medium transition-all ${
          isActive ? colorMap[tab.color] : 'border-transparent text-gray-500 hover:text-gray-700'
        }`}
      >
        {tab.label}
      </button>
    );
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <div className="mb-1 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">3M Resources Master</h1>
          {selectedProject && (
            <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700">
              {selectedProject.project_code} · {selectedProject.name}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500">Manage materials and machines per project; view global manpower categories.</p>

        {!projectId ? (
          <div className="mt-6 flex h-32 items-center justify-center rounded-xl border border-dashed border-gray-200 text-sm text-gray-400">
            Select a project from the sidebar to manage its resources.
          </div>
        ) : (
          <>
            <div className="mt-5 flex gap-1 border-b border-gray-100 pb-0">
              {TABS.map(tabBtn)}
            </div>
            <div className="mt-5">
              {activeTab === 'materials' && <MaterialsTab projectId={projectId} />}
              {activeTab === 'machines'  && <MachinesTab  projectId={projectId} />}
              {activeTab === 'manpower'  && <ManpowerTab />}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ResourcesPage;
