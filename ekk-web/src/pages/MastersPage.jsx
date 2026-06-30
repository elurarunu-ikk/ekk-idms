import { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  getWorkTypes, createWorkType, updateWorkType,
  getLayers, createLayer, updateLayer,
  getActivities, createActivity, updateActivity,
  getElements, createElement, updateElement,
  getStructureTypes, createStructureType, updateStructureType,
  getMaterials, createMaterial, updateMaterial,
  getEquipment, createEquipment, updateEquipment,
  getManpowerCategories, createManpowerCategory, updateManpowerCategory,
  getApiErrorMessage,
} from '../services/mastersService';

const SCOPED_WTS = ['ROAD', 'STRUCTURE'];

const TABS = ['Work Types', 'Layers', 'Activities', 'Elements', 'Structure Types',
              'Materials', 'Equipment', 'Manpower'];

const LAYER_CODES = [
  'EMBANKMENT', 'SUBGRADE', 'GSB', 'CTSB', 'CTB', 'WMM',
  'BASE', 'BINDER', 'WEARING', 'PRIME', 'TACK', 'SHOULDER', 'MEDIAN',
];

const UNITS = ['CUM', 'MT', 'KG', 'TON', 'LM', 'SQM', 'NOS', 'LTR', 'BAG'];

const MastersPage = () => {
  const [activeTab, setActiveTab] = useState('Work Types');
  const [showInactive, setShowInactive] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [saving, setSaving] = useState(false);

  const [filterWorkType, setFilterWorkType] = useState('');
  const [workTypes, setWorkTypes] = useState([]);
  const [structureTypes, setStructureTypes] = useState([]);
  const [elements, setElements] = useState([]);

  const [form, setForm] = useState({
    code: '', label: '', sort_order: 0,
    work_type_code: 'ROAD',
    default_unit: '',
    category: '',
    work_type_codes: [],
    layer_codes: [],
    structure_mappings: [],
  });

  // Load reference data once for dropdowns
  useEffect(() => {
    getWorkTypes(true).then(setWorkTypes).catch(() => {});
    getStructureTypes(true).then(setStructureTypes).catch(() => {});
    getElements(true).then(setElements).catch(() => {});
  }, []);

  const loadItems = async () => {
    setLoading(true);
    try {
      let data = [];
      if (activeTab === 'Work Types')      data = await getWorkTypes(!showInactive);
      if (activeTab === 'Layers')          data = await getLayers(null, !showInactive);
      if (activeTab === 'Activities')      data = await getActivities(filterWorkType || null, null, !showInactive);
      if (activeTab === 'Elements')        data = await getElements(!showInactive);
      if (activeTab === 'Structure Types') data = await getStructureTypes(!showInactive);
      if (activeTab === 'Materials')       data = await getMaterials(!showInactive);
      if (activeTab === 'Equipment')       data = await getEquipment(!showInactive);
      if (activeTab === 'Manpower')        data = await getManpowerCategories(!showInactive);
      setItems(data);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to load masters'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, [activeTab, showInactive, filterWorkType]);

  // Populate form when editItem changes
  useEffect(() => {
    if (editItem) {
      setForm({
        code: editItem.code || '',
        label: editItem.label || '',
        sort_order: editItem.sort_order || 0,
        work_type_code: editItem.work_type_code || 'ROAD',
        default_unit: editItem.default_unit || '',
        category: editItem.category || '',
        work_type_codes: editItem.work_types || [],
        layer_codes: editItem.layers || [],
        structure_mappings: editItem.structure_mappings || [],
      });
    } else {
      setForm({ code: '', label: '', sort_order: 0, work_type_code: 'ROAD',
                default_unit: '', category: '', work_type_codes: [],
                layer_codes: [], structure_mappings: [] });
    }
  }, [editItem, modalOpen]);

  const closeModal = () => {
    setModalOpen(false);
    setEditItem(null);
  };

  const handleToggleActive = async (item, newActive) => {
    try {
      if (activeTab === 'Work Types')      await updateWorkType(item.code, { is_active: newActive });
      if (activeTab === 'Layers')          await updateLayer(item.code, { is_active: newActive });
      if (activeTab === 'Activities')      await updateActivity(item.code, { is_active: newActive });
      if (activeTab === 'Elements')        await updateElement(item.code, { is_active: newActive });
      if (activeTab === 'Structure Types') await updateStructureType(item.code, { is_active: newActive });
      if (activeTab === 'Materials')       await updateMaterial(item.code, { is_active: newActive });
      if (activeTab === 'Equipment')       await updateEquipment(item.code, { is_active: newActive });
      if (activeTab === 'Manpower')        await updateManpowerCategory(item.code, { is_active: newActive });
      toast.success(`${item.code} ${newActive ? 'activated' : 'deactivated'}`);
      loadItems();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to update'));
    }
  };

  const handleSave = async () => {
    if (!form.code.trim() || !form.label.trim()) {
      toast.error('Code and label are required');
      return;
    }
    setSaving(true);
    try {
      const isEdit = Boolean(editItem);

      if (activeTab === 'Work Types') {
        const payload = { label: form.label, sort_order: Number(form.sort_order) };
        if (isEdit) await updateWorkType(editItem.code, payload);
        else await createWorkType({ code: form.code.toUpperCase(), ...payload });
      }

      if (activeTab === 'Layers') {
        const payload = { label: form.label, work_type_code: form.work_type_code,
                          sort_order: Number(form.sort_order) };
        if (isEdit) await updateLayer(editItem.code, payload);
        else await createLayer({ code: form.code.toUpperCase(), ...payload });
      }

      if (activeTab === 'Activities') {
        const payload = {
          label: form.label,
          default_unit: form.default_unit || null,
          sort_order: Number(form.sort_order),
          work_type_codes: form.work_type_codes,
          layer_codes: form.layer_codes,
          structure_type_codes: form.structure_mappings.map(m => m.structure_type),
          element_codes: form.structure_mappings.map(m => m.element),
        };
        if (isEdit) await updateActivity(editItem.code, payload);
        else await createActivity({ code: form.code.toUpperCase(), ...payload });
      }

      if (activeTab === 'Elements') {
        const payload = { label: form.label, sort_order: Number(form.sort_order) };
        if (isEdit) await updateElement(editItem.code, payload);
        else await createElement({ code: form.code.toUpperCase(), ...payload });
      }

      if (activeTab === 'Structure Types') {
        const payload = { label: form.label, sort_order: Number(form.sort_order) };
        if (isEdit) await updateStructureType(editItem.code, payload);
        else await createStructureType({ code: form.code.toUpperCase(), ...payload });
      }

      if (activeTab === 'Materials') {
        const payload = {
          label: form.label,
          default_unit: form.default_unit || null,
          category: form.category || null,
          sort_order: Number(form.sort_order),
        };
        if (isEdit) await updateMaterial(editItem.code, payload);
        else await createMaterial({ code: form.code.toUpperCase(), ...payload });
      }

      if (activeTab === 'Equipment') {
        const payload = {
          label: form.label,
          category: form.category || null,
          sort_order: Number(form.sort_order),
        };
        if (isEdit) await updateEquipment(editItem.code, payload);
        else await createEquipment({ code: form.code.toUpperCase(), ...payload });
      }

      if (activeTab === 'Manpower') {
        const payload = { label: form.label, sort_order: Number(form.sort_order) };
        if (isEdit) await updateManpowerCategory(editItem.code, payload);
        else await createManpowerCategory({ code: form.code.toUpperCase(), ...payload });
      }

      toast.success(`${editItem ? 'Updated' : 'Created'} successfully`);
      closeModal();
      loadItems();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to save'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">

      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Master Data</h1>
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-sm font-medium text-gray-600">
            {items.length}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {activeTab === 'Activities' && (
            <select
              value={filterWorkType}
              onChange={e => setFilterWorkType(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
            >
              <option value="">All work types</option>
              {workTypes.map(wt => (
                <option key={wt.code} value={wt.code}>{wt.label}</option>
              ))}
            </select>
          )}
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={e => setShowInactive(e.target.checked)}
              className="rounded border-gray-300"
            />
            Show inactive
          </label>
          <button
            onClick={() => { setEditItem(null); setModalOpen(true); }}
            className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2
                       text-sm font-medium text-white hover:bg-primary-700 transition"
          >
            <Plus className="w-4 h-4" />
            Add {activeTab.replace('s', '').replace(' Type', ' type')}
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setEditItem(null); }}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl bg-white shadow-card overflow-hidden">
        {loading ? (
          <LoadingSpinner message={`Loading ${activeTab.toLowerCase()}...`} />
        ) : items.length === 0 ? (
          <div className="py-16 text-center">
            <div className="text-3xl mb-2">📋</div>
            <p className="text-gray-500 text-sm">No {activeTab.toLowerCase()} found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Label</th>
                  {activeTab === 'Layers' && <th className="px-4 py-3">Work Type</th>}
                  {activeTab === 'Activities' && (
                    <>
                      <th className="px-4 py-3">Work Types</th>
                      <th className="px-4 py-3">Default Unit</th>
                      <th className="px-4 py-3">Valid Layers</th>
                    </>
                  )}
                  {(activeTab === 'Materials' || activeTab === 'Equipment') && (
                    <th className="px-4 py-3">Category</th>
                  )}
                  {activeTab === 'Materials' && (
                    <th className="px-4 py-3">Default Unit</th>
                  )}
                  <th className="px-4 py-3 text-center">Active</th>
                  <th className="px-4 py-3 text-center">Sort</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map(item => (
                  <tr
                    key={item.code}
                    className={`transition-colors hover:bg-gray-50 ${!item.is_active ? 'opacity-50' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                        {item.code}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{item.label}</td>
                    {activeTab === 'Layers' && (
                      <td className="px-4 py-3 text-gray-500 text-xs">{item.work_type_code || '—'}</td>
                    )}
                    {activeTab === 'Activities' && (
                      <>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {(item.work_types || []).map(wt => (
                              <span key={wt} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                                {wt}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs font-mono">
                          {item.default_unit || '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {(item.layers || []).length > 0
                            ? (item.layers || []).join(', ')
                            : '—'}
                        </td>
                      </>
                    )}
                    {(activeTab === 'Materials' || activeTab === 'Equipment') && (
                      <td className="px-4 py-3 text-gray-500 text-xs">{item.category || '—'}</td>
                    )}
                    {activeTab === 'Materials' && (
                      <td className="px-4 py-3 text-gray-500 text-xs font-mono">
                        {item.default_unit || '—'}
                      </td>
                    )}
                    <td className="px-4 py-3 text-center">
                      {item.is_active
                        ? <span className="text-green-600 font-medium text-xs">✓ Active</span>
                        : <span className="text-gray-400 text-xs">Inactive</span>}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-500 text-sm">{item.sort_order}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => { setEditItem(item); setModalOpen(true); }}
                          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs
                                     font-medium text-gray-700 hover:bg-gray-50 transition"
                        >
                          Edit
                        </button>
                        {item.is_active ? (
                          <button
                            onClick={() => handleToggleActive(item, false)}
                            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs
                                       font-medium text-red-600 hover:bg-red-50 transition"
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            onClick={() => handleToggleActive(item, true)}
                            className="rounded-lg border border-green-200 px-3 py-1.5 text-xs
                                       font-medium text-green-600 hover:bg-green-50 transition"
                          >
                            Activate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg max-h-[90vh] rounded-xl bg-white shadow-xl flex flex-col overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-5 flex-shrink-0">
              <h3 className="text-lg font-semibold text-gray-900">
                {editItem ? `Edit ${activeTab.slice(0, -1)}` : `Add ${activeTab.slice(0, -1)}`}
              </h3>
              <button
                onClick={closeModal}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Fields */}
            <div className="overflow-y-auto px-6 flex-1">
            <div className="space-y-4">

              {/* Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Code {!editItem && <span className="text-red-500">*</span>}
                </label>
                <input
                  value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                  disabled={Boolean(editItem)}
                  placeholder="e.g. WMM_LAY"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                             font-mono focus:border-primary-500 focus:outline-none
                             disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
                />
                {!editItem && (
                  <p className="text-xs text-gray-400 mt-1">
                    Use uppercase with underscores. Cannot be changed after creation.
                  </p>
                )}
              </div>

              {/* Label */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Label <span className="text-red-500">*</span>
                </label>
                <input
                  value={form.label}
                  onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                  placeholder="Display name"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                             focus:border-primary-500 focus:outline-none"
                />
              </div>

              {/* Layers tab: Work Type dropdown */}
              {activeTab === 'Layers' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Work Type</label>
                  <select
                    value={form.work_type_code}
                    onChange={e => setForm(f => ({ ...f, work_type_code: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                               focus:border-primary-500 focus:outline-none"
                  >
                    {workTypes.map(wt => (
                      <option key={wt.code} value={wt.code}>{wt.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Activities tab: Unit + Work Types + Layers */}
              {activeTab === 'Activities' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Default Unit</label>
                    <select
                      value={form.default_unit}
                      onChange={e => setForm(f => ({ ...f, default_unit: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                                 focus:border-primary-500 focus:outline-none"
                    >
                      <option value="">— None —</option>
                      {UNITS.map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>

                  {/* Primary Scope — mutually exclusive radio (Road / Structure / None) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Primary Scope
                      <span className="text-xs text-gray-400 ml-1">(determines mapping type — choose one)</span>
                    </label>
                    <div className="flex gap-2">
                      {['NONE', 'ROAD', 'STRUCTURE'].map(scope => (
                        <label
                          key={scope}
                          className="flex items-center gap-2 rounded-lg border border-gray-200
                                     px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 flex-1"
                        >
                          <input
                            type="radio"
                            name="primary_scope"
                            checked={
                              scope === 'NONE'
                                ? !form.work_type_codes.includes('ROAD') && !form.work_type_codes.includes('STRUCTURE')
                                : form.work_type_codes.includes(scope)
                            }
                            onChange={() => setForm(f => {
                              const withoutScoped = f.work_type_codes.filter(
                                c => !SCOPED_WTS.includes(c)
                              );
                              return {
                                ...f,
                                work_type_codes: scope === 'NONE'
                                  ? withoutScoped
                                  : [...withoutScoped, scope],
                                layer_codes: scope === 'ROAD' ? f.layer_codes : [],
                                structure_mappings: scope === 'STRUCTURE' ? f.structure_mappings : [],
                              };
                            })}
                            className="text-primary-600"
                          />
                          {scope === 'NONE' ? 'None' : scope === 'ROAD' ? 'Road' : 'Structure'}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Also Valid For — unscoped work types, coexist with any primary scope */}
                  {workTypes.filter(wt => !SCOPED_WTS.includes(wt.code)).length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Also Valid For
                        <span className="text-xs text-gray-400 ml-1">(no additional mapping required)</span>
                      </label>
                      <div className="flex gap-2 flex-wrap">
                        {workTypes
                          .filter(wt => !SCOPED_WTS.includes(wt.code))
                          .map(wt => (
                            <label
                              key={wt.code}
                              className="flex items-center gap-2 rounded-lg border border-gray-200
                                         px-3 py-2 text-sm cursor-pointer hover:bg-gray-50"
                            >
                              <input
                                type="checkbox"
                                checked={form.work_type_codes.includes(wt.code)}
                                onChange={e => setForm(f => ({
                                  ...f,
                                  work_type_codes: e.target.checked
                                    ? [...f.work_type_codes, wt.code]
                                    : f.work_type_codes.filter(c => c !== wt.code),
                                }))}
                                className="rounded border-gray-300"
                              />
                              {wt.label}
                            </label>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Valid Layers — only when ROAD is primary scope */}
                  {form.work_type_codes.includes('ROAD') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Valid Layers <span className="text-xs text-gray-400">(for ROAD work type)</span>
                      </label>
                      <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto
                                      rounded-lg border border-gray-200 p-3">
                        {LAYER_CODES.map(lc => (
                          <label
                            key={lc}
                            className="flex items-center gap-2 text-sm cursor-pointer
                                       rounded px-2 py-1 hover:bg-gray-50"
                          >
                            <input
                              type="checkbox"
                              checked={form.layer_codes.includes(lc)}
                              onChange={e => setForm(f => ({
                                ...f,
                                layer_codes: e.target.checked
                                  ? [...f.layer_codes, lc]
                                  : f.layer_codes.filter(c => c !== lc),
                              }))}
                              className="rounded border-gray-300"
                            />
                            <span className="font-mono text-xs">{lc}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Structure Type + Element mappings — only when STRUCTURE is primary scope */}
                  {form.work_type_codes.includes('STRUCTURE') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Valid Structure Type / Element pairs
                        <span className="text-xs text-gray-400 ml-1">(add one row per valid combination)</span>
                      </label>
                      <div className="space-y-2 rounded-lg border border-gray-200 p-3">
                        {form.structure_mappings.map((mapping, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <select
                              value={mapping.structure_type}
                              onChange={e => setForm(f => {
                                const updated = [...f.structure_mappings];
                                updated[idx] = { ...updated[idx], structure_type: e.target.value };
                                return { ...f, structure_mappings: updated };
                              })}
                              className="flex-1 rounded-lg border border-gray-300 px-2 py-1.5
                                         text-sm focus:border-primary-500 focus:outline-none"
                            >
                              <option value="">— Structure Type —</option>
                              {structureTypes.map(st => (
                                <option key={st.code} value={st.code}>{st.label}</option>
                              ))}
                            </select>
                            <select
                              value={mapping.element}
                              onChange={e => setForm(f => {
                                const updated = [...f.structure_mappings];
                                updated[idx] = { ...updated[idx], element: e.target.value };
                                return { ...f, structure_mappings: updated };
                              })}
                              className="flex-1 rounded-lg border border-gray-300 px-2 py-1.5
                                         text-sm focus:border-primary-500 focus:outline-none"
                            >
                              <option value="">— Element —</option>
                              {elements.map(el => (
                                <option key={el.code} value={el.code}>{el.label}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => setForm(f => ({
                                ...f,
                                structure_mappings: f.structure_mappings.filter((_, i) => i !== idx),
                              }))}
                              className="p-1 text-red-400 hover:text-red-600 rounded"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => setForm(f => ({
                            ...f,
                            structure_mappings: [...f.structure_mappings, { structure_type: '', element: '' }],
                          }))}
                          className="flex items-center gap-1 text-xs text-primary-600
                                     hover:text-primary-800 font-medium mt-1"
                        >
                          <Plus className="w-3 h-3" /> Add row
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Category — Materials and Equipment */}
              {(activeTab === 'Materials' || activeTab === 'Equipment') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <input
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value.toUpperCase() }))}
                    placeholder={activeTab === 'Materials'
                      ? 'e.g. BINDING, GRANULAR, BINDER, STRUCTURAL, OTHER'
                      : 'e.g. COMPACTION, EARTHWORK, TRANSPORT, CONCRETE, LIFTING, OTHER'}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                               focus:border-primary-500 focus:outline-none"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    {activeTab === 'Materials'
                      ? 'Groups materials for filtering: BINDING, GRANULAR, BINDER, STRUCTURAL, OTHER'
                      : 'Groups equipment for filtering: COMPACTION, EARTHWORK, TRANSPORT, CONCRETE, LIFTING, POWER, SURVEY, OTHER'}
                  </p>
                </div>
              )}

              {/* Default Unit — Materials only */}
              {activeTab === 'Materials' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Default Unit</label>
                  <select
                    value={form.default_unit}
                    onChange={e => setForm(f => ({ ...f, default_unit: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                               focus:border-primary-500 focus:outline-none"
                  >
                    <option value="">— None —</option>
                    {UNITS.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Sort Order */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
                <input
                  type="number"
                  value={form.sort_order}
                  onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                             focus:border-primary-500 focus:outline-none"
                />
                <p className="text-xs text-gray-400 mt-1">Lower numbers appear first in dropdowns.</p>
              </div>

            </div>
            </div>{/* end scrollable body */}

            {/* Footer */}
            <div className="flex justify-end gap-3 px-6 py-5 border-t border-gray-100 flex-shrink-0">
              <button
                onClick={closeModal}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium
                           text-gray-700 hover:bg-gray-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium
                           text-white hover:bg-primary-700 transition disabled:opacity-60"
              >
                {saving ? 'Saving...' : editItem ? 'Update' : 'Create'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default MastersPage;
