import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import useProjectSession from '../hooks/useProjectSession';
import { getApiErrorMessage } from '../services/apiService';
import {
  listActivityMappings,
  suggestActivityMappings,
  bulkConfirmMappings,
  createActivityMapping,
  deactivateMapping,
  getMasterData,
  getBoqRegister,
} from '../services/boqService';
import LoadingSpinner from '../components/LoadingSpinner';

// ── Colour helpers ─────────────────────────────────────────────────────────────

const WORK_TYPE_COLORS = {
  ROAD:      'bg-teal-100 text-teal-800',
  STRUCTURE: 'bg-purple-100 text-purple-800',
  DRAIN:     'bg-blue-100 text-blue-800',
  ANCILLARY: 'bg-amber-100 text-amber-800',
  MISC:      'bg-gray-100 text-gray-700',
};

const CONFIDENCE_COLORS = {
  high:   'bg-green-100 text-green-800',
  medium: 'bg-amber-100 text-amber-800',
  low:    'bg-red-100 text-red-800',
};

const FORMULA_COLORS = {
  LxWxD:    'bg-blue-50 text-blue-700',
  LxW:      'bg-indigo-50 text-indigo-700',
  LENGTH:   'bg-violet-50 text-violet-700',
  QUANTITY: 'bg-orange-50 text-orange-700',
};

const FORMULA_OPTIONS = [
  { value: 'LxWxD',    label: 'LxWxD — Length × Width × Depth (pavement layers, Cum)' },
  { value: 'LxW',      label: 'LxW — Length × Width (surface area, Sqm)' },
  { value: 'LENGTH',   label: 'LENGTH — Chainage length only (linear items, RM)' },
  { value: 'QUANTITY', label: 'QUANTITY — Engineer-entered quantity (structures, any unit)' },
];

const Badge = ({ label, colorCls }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorCls}`}>
    {label}
  </span>
);

const layerStructureCell = (m) => {
  if (m.work_type === 'ROAD' && m.layer_code) return m.layer_code;
  if (m.work_type === 'STRUCTURE') {
    const parts = [m.structure_type, m.element_code].filter(Boolean);
    return parts.length ? parts.join(' / ') : '—';
  }
  return '—';
};

// ── BOQ Item searchable dropdown ───────────────────────────────────────────────

const BOQItemPicker = ({ boqItems, value, onChange }) => {
  const [search, setSearch] = useState(value || '');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Sync display when value cleared externally
  useEffect(() => { if (!value) setSearch(''); }, [value]);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = boqItems.filter((i) => {
    const q = search.toLowerCase();
    return (
      i.item_code?.toLowerCase().includes(q) ||
      i.description?.toLowerCase().includes(q)
    );
  }).slice(0, 40);

  const handleSelect = (item) => {
    setSearch(`${item.item_code} — ${item.description}`);
    onChange(item.item_code);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={search}
        onChange={(e) => { setSearch(e.target.value); onChange(''); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Type item code or description…"
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto text-sm">
          {filtered.map((item) => (
            <li
              key={item.id}
              onMouseDown={() => handleSelect(item)}
              className="px-3 py-2 cursor-pointer hover:bg-teal-50 flex items-baseline gap-2"
            >
              <span className="font-semibold text-gray-900 shrink-0">{item.item_code}</span>
              <span className="text-gray-500 truncate">{item.description}</span>
              {item.unit && <span className="text-gray-400 shrink-0 text-xs">({item.unit})</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// ── AddMappingModal ────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  work_type: '',
  layer_code: '',
  structure_type: '',
  element_code: '',
  activity_code: '',
  boq_item_code: '',
  volume_formula: 'LxWxD',
  unit_conversion: 1.0,
};

const AddMappingModal = ({
  projectId,
  initialData,   // null = add mode, mapping object = edit mode
  masterData,
  boqItems,
  loadingMaster,
  onClose,
  onCreated,
}) => {
  const isEdit = !!initialData;

  const [form, setForm] = useState(() =>
    initialData
      ? {
          work_type:       initialData.work_type      || '',
          layer_code:      initialData.layer_code     || '',
          structure_type:  initialData.structure_type || '',
          element_code:    initialData.element_code   || '',
          activity_code:   initialData.activity_code  || '',
          boq_item_code:   initialData.boq_item_code  || '',
          volume_formula:  initialData.volume_formula || 'LxWxD',
          unit_conversion: initialData.unit_conversion ?? 1.0,
        }
      : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);

  const set = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  // Filtered master lists based on work_type selection
  const filteredLayers = masterData?.layers?.filter(
    (l) => !form.work_type || l.work_type_code === form.work_type
  ) || [];

  const filteredActivities = masterData?.activities?.filter((a) => {
    if (!form.work_type) return true;
    const matchesWorkType = a.work_types?.includes(form.work_type);
    if (!matchesWorkType) return false;
    // If a layer is selected, further filter by layer
    if (form.layer_code) {
      return a.layers?.includes(form.layer_code);
    }
    return true;
  }) || [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.work_type || !form.boq_item_code || !form.volume_formula) {
      toast.error('Work type, BOQ item code, and formula are required');
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        // Edit = deactivate old + create new
        await deactivateMapping(initialData.id);
      }
      await createActivityMapping({
        project_id:     projectId,
        work_type:      form.work_type      || null,
        layer_code:     form.layer_code     || null,
        structure_type: form.structure_type || null,
        element_code:   form.element_code   || null,
        activity_code:  form.activity_code  || null,
        boq_item_code:  form.boq_item_code,
        volume_formula: form.volume_formula,
        unit_conversion: parseFloat(form.unit_conversion) || 1.0,
      });
      toast.success(isEdit ? 'Mapping updated' : 'Mapping created');
      onCreated();
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, isEdit ? 'Failed to update mapping' : 'Failed to create mapping'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 overflow-y-auto py-8">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? 'Edit Mapping' : 'Add Manual Mapping'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        {loadingMaster ? (
          <div className="flex justify-center py-10"><LoadingSpinner /></div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Work Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Work Type *</label>
              <select
                value={form.work_type}
                onChange={(e) => set('work_type', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                required
              >
                <option value="">Select work type</option>
                {(masterData?.workTypes || []).map((wt) => (
                  <option key={wt.code} value={wt.code}>{wt.code} — {wt.label}</option>
                ))}
              </select>
            </div>

            {/* Layer Code — ROAD only */}
            {form.work_type === 'ROAD' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Layer Code</label>
                <select
                  value={form.layer_code}
                  onChange={(e) => set('layer_code', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                >
                  <option value="">Any layer</option>
                  {filteredLayers.map((l) => (
                    <option key={l.code} value={l.code}>{l.code} — {l.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Structure Type + Element — STRUCTURE only */}
            {form.work_type === 'STRUCTURE' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Structure Type</label>
                  <select
                    value={form.structure_type}
                    onChange={(e) => set('structure_type', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  >
                    <option value="">Any structure type</option>
                    {(masterData?.structureTypes || []).map((s) => (
                      <option key={s.code} value={s.code}>{s.code} — {s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Element Code</label>
                  <select
                    value={form.element_code}
                    onChange={(e) => set('element_code', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  >
                    <option value="">Any element</option>
                    {(masterData?.elements || []).map((el) => (
                      <option key={el.code} value={el.code}>{el.code} — {el.label}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {/* Activity Code */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Activity Code</label>
              <select
                value={form.activity_code}
                onChange={(e) => set('activity_code', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              >
                <option value="">Optional — leave blank to match any activity</option>
                {filteredActivities.map((a) => (
                  <option key={a.code} value={a.code}>{a.code} — {a.label}</option>
                ))}
              </select>
            </div>

            {/* BOQ Item Code — searchable */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">BOQ Item Code *</label>
              <BOQItemPicker
                boqItems={boqItems}
                value={form.boq_item_code}
                onChange={(code) => set('boq_item_code', code)}
              />
              {form.boq_item_code && (
                <p className="text-xs text-teal-600 mt-0.5">Selected: {form.boq_item_code}</p>
              )}
            </div>

            {/* Volume Formula */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Volume Formula *</label>
              <select
                value={form.volume_formula}
                onChange={(e) => set('volume_formula', e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              >
                {FORMULA_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>

            {/* Unit Conversion */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit Conversion</label>
              <input
                type="number"
                step="any"
                value={form.unit_conversion}
                onChange={(e) => set('unit_conversion', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
              <p className="text-xs text-gray-400 mt-0.5">
                Multiplier applied after formula. Default 1.0. Example: enter 0.001 to convert mm³ to m³.
              </p>
            </div>

            {isEdit && (
              <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                Saving will deactivate the existing mapping and create a new one with these values.
              </p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !form.boq_item_code}
                className="px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Save Mapping'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

// ── Main page ──────────────────────────────────────────────────────────────────

const BOQMapping = () => {
  const { selectedProject } = useProjectSession();
  const projectId = selectedProject?.project_code;
  const projectName = selectedProject?.project_name || projectId || '—';

  const [mappings, setMappings]           = useState([]);
  const [loadingMappings, setLoadingMappings] = useState(false);

  // Master data cache — loaded once on first modal open
  const [masterData, setMasterData]       = useState(null);
  const [boqItems, setBoqItems]           = useState([]);
  const [loadingMaster, setLoadingMaster] = useState(false);

  // Modal state: null = closed, false = add mode, object = edit mode
  const [editMapping, setEditMapping]     = useState(null);
  const [modalOpen, setModalOpen]         = useState(false);

  // Suggest panel
  const [panelOpen, setPanelOpen]         = useState(false);
  const [suggestState, setSuggestState]   = useState('ready');
  const [suggestions, setSuggestions]     = useState([]);
  const [alreadyMapped, setAlreadyMapped] = useState(0);
  const [checked, setChecked]             = useState({});
  const [confirming, setConfirming]       = useState(false);

  const fetchMappings = useCallback(async () => {
    if (!projectId) return;
    setLoadingMappings(true);
    try {
      const data = await listActivityMappings(projectId);
      setMappings(data);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to load mappings'));
    } finally {
      setLoadingMappings(false);
    }
  }, [projectId]);

  useEffect(() => { fetchMappings(); }, [fetchMappings]);

  const ensureMasterData = useCallback(async () => {
    if (masterData) return; // already cached
    setLoadingMaster(true);
    try {
      const [md, register] = await Promise.all([
        getMasterData(),
        getBoqRegister({ project_id: projectId, item_type: 'BOQ_ITEM', limit: 500, skip: 0 }),
      ]);
      setMasterData(md);
      setBoqItems(register?.items || []);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to load master data'));
    } finally {
      setLoadingMaster(false);
    }
  }, [masterData, projectId]);

  const openAddModal = () => {
    setEditMapping(null);
    setModalOpen(true);
    ensureMasterData();
  };

  const openEditModal = (mapping) => {
    setEditMapping(mapping);
    setModalOpen(true);
    ensureMasterData();
  };

  const closeModal = () => { setModalOpen(false); setEditMapping(null); };

  // ── Deactivate ─────────────────────────────────────────────────────────────

  const handleDeactivate = async (id) => {
    try {
      await deactivateMapping(id);
      toast.success('Mapping deactivated');
      fetchMappings();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to deactivate mapping'));
    }
  };

  // ── AI Suggest ─────────────────────────────────────────────────────────────

  const handleOpenSuggest = () => {
    setPanelOpen(true);
    setSuggestState('ready');
    setSuggestions([]);
    setChecked({});
  };

  const handleRunSuggest = async () => {
    setSuggestState('loading');
    try {
      const result = await suggestActivityMappings(projectId);
      setAlreadyMapped(result.already_mapped ?? 0);
      if (result.error) {
        toast.error(result.error);
        setSuggestState('ready');
        return;
      }
      const suggs = result.suggestions || [];
      setSuggestions(suggs);
      if (suggs.length === 0) {
        setSuggestState('empty');
      } else {
        const initial = {};
        suggs.forEach((s, i) => { initial[i] = s.confidence === 'high'; });
        setChecked(initial);
        setSuggestState('results');
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'AI suggestion failed'));
      setSuggestState('ready');
    }
  };

  const handleSelectAllHigh = () => {
    const next = {};
    suggestions.forEach((s, i) => { next[i] = s.confidence === 'high'; });
    setChecked(next);
  };

  const handleDeselectAll = () => {
    const next = {};
    suggestions.forEach((_, i) => { next[i] = false; });
    setChecked(next);
  };

  const selectedCount = Object.values(checked).filter(Boolean).length;

  const handleBulkConfirm = async () => {
    const approved = suggestions.filter((_, i) => checked[i]);
    if (!approved.length) { toast.error('No suggestions selected'); return; }
    setConfirming(true);
    try {
      const result = await bulkConfirmMappings(projectId, approved);
      toast.success(`${result.created} mapping(s) created, ${result.skipped} skipped`);
      await fetchMappings();
      setPanelOpen(false);
      setSuggestState('ready');
      setSuggestions([]);
      setChecked({});
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Bulk confirm failed'));
    } finally {
      setConfirming(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* Top bar */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            BOQ Activity Mapping — {projectName}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {mappings.length} active mapping{mappings.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleOpenSuggest}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700"
          >
            ✨ AI Suggest
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700"
          >
            + Add Manual
          </button>
        </div>
      </div>

      {/* ── Section 1: Confirmed mappings table ── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loadingMappings ? (
          <div className="flex justify-center py-16"><LoadingSpinner /></div>
        ) : mappings.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            No mappings yet. Use AI Suggest to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm divide-y divide-gray-100">
              <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Work Type</th>
                  <th className="px-4 py-3 text-left">Layer / Structure</th>
                  <th className="px-4 py-3 text-left">Activity</th>
                  <th className="px-4 py-3 text-left">BOQ Item</th>
                  <th className="px-4 py-3 text-left">Formula</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {mappings.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      {m.work_type ? (
                        <Badge
                          label={m.work_type}
                          colorCls={WORK_TYPE_COLORS[m.work_type] || 'bg-gray-100 text-gray-700'}
                        />
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{layerStructureCell(m)}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {m.activity_code || <span className="text-gray-400 italic">Any</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900">{m.boq_item_code}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        label={m.volume_formula}
                        colorCls={FORMULA_COLORS[m.volume_formula] || 'bg-gray-100 text-gray-600'}
                      />
                    </td>
                    <td className="px-4 py-3">
                      {m.is_active ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-700 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-400 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-300 inline-block" /> Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 flex items-center gap-3">
                      <button
                        onClick={() => openEditModal(m)}
                        className="text-xs text-teal-600 hover:text-teal-800 hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeactivate(m.id)}
                        className="text-xs text-red-500 hover:text-red-700 hover:underline"
                      >
                        Deactivate
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Section 2: AI Suggest Panel ── */}
      {panelOpen && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
            <h2 className="font-semibold text-gray-800">✨ AI Mapping Suggestions</h2>
            <button onClick={() => setPanelOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
          </div>

          <div className="p-5">

            {/* STATE 1 — Ready */}
            {suggestState === 'ready' && (
              <div className="bg-gray-50 rounded-lg p-6 text-center space-y-3">
                <p className="text-gray-600 text-sm max-w-lg mx-auto">
                  Click <strong>Run AI Analysis</strong> to let GPT-4o analyse your BOQ items
                  and master activity combinations and suggest mappings.
                </p>
                <button
                  onClick={handleRunSuggest}
                  className="px-5 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700"
                >
                  Run AI Analysis →
                </button>
              </div>
            )}

            {/* STATE 2 — Loading */}
            {suggestState === 'loading' && (
              <div className="flex flex-col items-center gap-3 py-10">
                <LoadingSpinner />
                <p className="text-sm text-gray-500">
                  GPT-4o is analysing your BOQ items and master activity combinations…
                </p>
              </div>
            )}

            {/* STATE 4 — Empty */}
            {suggestState === 'empty' && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                <p className="text-green-700 text-sm font-medium">
                  ✅ All combinations are already mapped. No new suggestions available.
                </p>
              </div>
            )}

            {/* STATE 3 — Results */}
            {suggestState === 'results' && (
              <div className="space-y-4">
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span className="font-medium text-gray-800">{suggestions.length} suggestions</span>
                  <span className="text-gray-400">·</span>
                  <span>{alreadyMapped} already mapped</span>
                </div>

                <div className="overflow-x-auto rounded-lg border border-gray-100">
                  <table className="min-w-full text-sm divide-y divide-gray-100">
                    <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      <tr>
                        <th className="px-3 py-3 text-left w-8">
                          <input
                            type="checkbox"
                            checked={selectedCount === suggestions.length && suggestions.length > 0}
                            onChange={(e) => {
                              const next = {};
                              suggestions.forEach((_, i) => { next[i] = e.target.checked; });
                              setChecked(next);
                            }}
                            className="rounded"
                          />
                        </th>
                        <th className="px-3 py-3 text-left">Confidence</th>
                        <th className="px-3 py-3 text-left">Work Type</th>
                        <th className="px-3 py-3 text-left">Layer / Structure / Element</th>
                        <th className="px-3 py-3 text-left">Activity</th>
                        <th className="px-3 py-3 text-left">→ BOQ Item</th>
                        <th className="px-3 py-3 text-left">Formula</th>
                        <th className="px-3 py-3 text-left">Reasoning</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {suggestions.map((s, i) => {
                        const layerParts = [s.layer_code, s.structure_type, s.element_code]
                          .filter(Boolean).join(' / ') || '—';
                        return (
                          <tr key={i} className={checked[i] ? 'bg-violet-50' : 'hover:bg-gray-50'}>
                            <td className="px-3 py-3">
                              <input
                                type="checkbox"
                                checked={!!checked[i]}
                                onChange={(e) =>
                                  setChecked((prev) => ({ ...prev, [i]: e.target.checked }))
                                }
                                className="rounded"
                              />
                            </td>
                            <td className="px-3 py-3">
                              <Badge
                                label={s.confidence.toUpperCase()}
                                colorCls={CONFIDENCE_COLORS[s.confidence] || 'bg-gray-100 text-gray-600'}
                              />
                            </td>
                            <td className="px-3 py-3">
                              {s.work_type ? (
                                <Badge
                                  label={s.work_type}
                                  colorCls={WORK_TYPE_COLORS[s.work_type] || 'bg-gray-100 text-gray-700'}
                                />
                              ) : <span className="text-gray-400">—</span>}
                            </td>
                            <td className="px-3 py-3 text-gray-700">{layerParts}</td>
                            <td className="px-3 py-3 text-gray-700">{s.activity_code || '—'}</td>
                            <td className="px-3 py-3">
                              <div className="font-semibold text-gray-900">{s.boq_item_code}</div>
                              <div className="text-xs text-gray-400 truncate max-w-[160px]">{s.boq_description}</div>
                            </td>
                            <td className="px-3 py-3">
                              <Badge
                                label={s.volume_formula}
                                colorCls={FORMULA_COLORS[s.volume_formula] || 'bg-gray-100 text-gray-600'}
                              />
                            </td>
                            <td className="px-3 py-3 text-gray-500 italic text-xs max-w-[180px] truncate">
                              {s.reasoning?.slice(0, 60) || '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex gap-3">
                    <button onClick={handleSelectAllHigh} className="text-sm text-violet-600 hover:underline">
                      Select all HIGH confidence
                    </button>
                    <button onClick={handleDeselectAll} className="text-sm text-gray-500 hover:underline">
                      Deselect all
                    </button>
                  </div>
                  <button
                    onClick={handleBulkConfirm}
                    disabled={confirming || selectedCount === 0}
                    className="px-5 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                  >
                    {confirming ? 'Confirming…' : `Confirm selected (${selectedCount})`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {modalOpen && (
        <AddMappingModal
          projectId={projectId}
          initialData={editMapping}
          masterData={masterData}
          boqItems={boqItems}
          loadingMaster={loadingMaster}
          onClose={closeModal}
          onCreated={fetchMappings}
        />
      )}
    </div>
  );
};

export default BOQMapping;
