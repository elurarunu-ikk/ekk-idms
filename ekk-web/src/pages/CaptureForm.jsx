import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { createCapture, getApiErrorMessage, getCapture, updateCapture } from '../services/apiService';
import LoadingSpinner from '../components/LoadingSpinner';
import useProjectSession from '../hooks/useProjectSession';
import {
  deriveStage,
} from '../utils/captureUtils';
import {
  getWorkTypes, getLayers, getActivities,
  getElements, getStructureTypes, getStructureActivities,
  getRoadSections, getRoadSides,
} from '../services/mastersService';

// ── Local constants (not in captureUtils) ────────────────────────────────────

const WEATHER_OPTIONS = [
  { value: '',       label: '— Select —' },
  { value: 'SUNNY',  label: 'Sunny' },
  { value: 'CLOUDY', label: 'Cloudy' },
  { value: 'RAINY',  label: 'Rainy' },
];

const PROGRESS_OPTIONS = [
  { value: '',          label: '— Select —' },
  { value: 'STARTED',   label: 'Started' },
  { value: 'ONGOING',   label: 'In Progress' },
  { value: 'COMPLETED', label: 'Completed' },
];

const UNITS = ['', 'CUM', 'MT', 'KG', 'SQM', 'LM', 'BAG', 'NOS', 'LTR', 'TON'];

const MATERIAL_CODES = [
  'CEMENT', 'STEEL', 'AGGREGATE', 'SAND', 'WATER', 'BITUMEN', 'EMULSION',
  'WMM', 'GSB', 'DBM', 'BC', 'SDBC', 'CTB', 'CTSB', 'RMC',
  'STONE', 'LIME', 'FLY_ASH', 'HDPE_PIPE', 'PAINT', 'OTHER',
];
const MACHINE_CODES = [
  'ROLLER', 'VIB_ROLLER', 'PNEU_ROLLER', 'PAVER', 'COMPACTOR', 'PLATE_COMPACTOR',
  'EXCAVATOR', 'TIPPER', 'DUMPER', 'GRADER', 'LOADER', 'CRANE', 'HYDRA_CRANE',
  'TRANSIT_MIXER', 'CONCRETE_PUMP', 'CONCRETE_MIXER', 'WATER_TANKER',
  'GENERATOR', 'TOTAL_STATION', 'OTHER',
];
const MANPOWER_CATEGORIES = [
  'SKILLED', 'SEMISKILLED', 'UNSKILLED', 'MASON', 'CARPENTER',
  'ELECTRICIAN', 'WELDER', 'HELPER', 'OPERATOR', 'SUPERVISOR', 'ENGINEER',
];
const SHIFT_TYPES = ['DAY', 'NIGHT', 'GENERAL'];

const emptyMaterial = () => ({ material_code: '', quantity: '', unit: '', source: '' });
const emptyMachine  = () => ({ machine_code: '', count: 1, hours: '', operator_name: '' });
const emptyManpower = () => ({ category: '', count: '', shift_type: 'DAY' });

const initialForm = {
  project_id: '', work_type: 'ROAD',
  activity_code: '',
  layer_code: '', element_code: '', structure_type: '',
  chainage_from: '', chainage_to: '',
  quantity_lm: '', quantity: '', unit: '',
  length_m: '', width_m: '', depth_m: '', count: '1',
  contractor_name: '', road_side: 'LHS', rfi_number: '',
  layer_section: '', weather_code: '', progress_status: '',
  entry_date: '', remarks: '',
};

// ── Shared input classes ──────────────────────────────────────────────────────
const inp = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';
const sel = inp;

// ── 3M editor sub-components (unchanged) ─────────────────────────────────────

function MaterialsEditor({ rows, setRows }) {
  const update = (i, key, val) => setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [key]: val } : r));
  return (
    <div className="mb-5">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Materials Used</p>
        <button type="button" onClick={() => setRows(p => [...p, emptyMaterial()])}
          className="rounded-md bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700">+ Add Material</button>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-blue-200 px-4 py-3 text-sm text-gray-400">No materials added</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-blue-100">
          <table className="min-w-full text-sm">
            <thead className="bg-blue-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold text-blue-700">Material *</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-blue-700">Quantity</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-blue-700">Unit</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-blue-700">Source</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-50 bg-white">
              {rows.map((row, i) => (
                <tr key={i}>
                  <td className="px-2 py-1">
                    <select value={row.material_code} onChange={e => update(i, 'material_code', e.target.value)} className={sel}>
                      <option value="">— Select —</option>
                      {MATERIAL_CODES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1">
                    <input type="number" step="0.01" value={row.quantity} onChange={e => update(i, 'quantity', e.target.value)} className={inp} placeholder="0" />
                  </td>
                  <td className="px-2 py-1">
                    <select value={row.unit} onChange={e => update(i, 'unit', e.target.value)} className={sel}>
                      {UNITS.map(u => <option key={u} value={u}>{u || '—'}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1">
                    <input type="text" value={row.source} onChange={e => update(i, 'source', e.target.value)} className={inp} placeholder="e.g. crusher" />
                  </td>
                  <td className="px-2 py-1">
                    <button type="button" onClick={() => setRows(p => p.filter((_, idx) => idx !== i))}
                      className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function MachinesEditor({ rows, setRows }) {
  const update = (i, key, val) => setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [key]: val } : r));
  return (
    <div className="mb-5">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-orange-700">Machines Deployed</p>
        <button type="button" onClick={() => setRows(p => [...p, emptyMachine()])}
          className="rounded-md bg-orange-500 px-3 py-1 text-xs font-semibold text-white hover:bg-orange-600">+ Add Machine</button>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-orange-200 px-4 py-3 text-sm text-gray-400">No machines added</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-orange-100">
          <table className="min-w-full text-sm">
            <thead className="bg-orange-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold text-orange-700">Machine *</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-orange-700">Count</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-orange-700">Hours</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-orange-700">Operator</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-orange-50 bg-white">
              {rows.map((row, i) => (
                <tr key={i}>
                  <td className="px-2 py-1">
                    <select value={row.machine_code} onChange={e => update(i, 'machine_code', e.target.value)} className={sel}>
                      <option value="">— Select —</option>
                      {MACHINE_CODES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1">
                    <input type="number" min="1" value={row.count} onChange={e => update(i, 'count', e.target.value)} className={inp} />
                  </td>
                  <td className="px-2 py-1">
                    <input type="number" step="0.5" value={row.hours} onChange={e => update(i, 'hours', e.target.value)} className={inp} placeholder="hrs" />
                  </td>
                  <td className="px-2 py-1">
                    <input type="text" value={row.operator_name} onChange={e => update(i, 'operator_name', e.target.value)} className={inp} placeholder="Name" />
                  </td>
                  <td className="px-2 py-1">
                    <button type="button" onClick={() => setRows(p => p.filter((_, idx) => idx !== i))}
                      className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ManpowerEditor({ rows, setRows }) {
  const update = (i, key, val) => setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [key]: val } : r));
  return (
    <div className="mb-5">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-green-700">Manpower Deployed</p>
        <button type="button" onClick={() => setRows(p => [...p, emptyManpower()])}
          className="rounded-md bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-700">+ Add Manpower</button>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-green-200 px-4 py-3 text-sm text-gray-400">No manpower added</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-green-100">
          <table className="min-w-full text-sm">
            <thead className="bg-green-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold text-green-700">Category *</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-green-700">Count</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-green-700">Shift</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-green-50 bg-white">
              {rows.map((row, i) => (
                <tr key={i}>
                  <td className="px-2 py-1">
                    <select value={row.category} onChange={e => update(i, 'category', e.target.value)} className={sel}>
                      <option value="">— Select —</option>
                      {MANPOWER_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1">
                    <input type="number" min="1" value={row.count} onChange={e => update(i, 'count', e.target.value)} className={inp} placeholder="0" />
                  </td>
                  <td className="px-2 py-1">
                    <select value={row.shift_type} onChange={e => update(i, 'shift_type', e.target.value)} className={sel}>
                      {SHIFT_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1">
                    <button type="button" onClick={() => setRows(p => p.filter((_, idx) => idx !== i))}
                      className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main form ─────────────────────────────────────────────────────────────────

const CaptureForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = useMemo(() => Boolean(id), [id]);
  const { selectedProjectId, selectedProject } = useProjectSession();

  const [formData, setFormData] = useState(initialForm);
  const [manualQuantity, setManualQuantity] = useState(false);
  const [manualActivity, setManualActivity] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  const [materialsUsed, setMaterialsUsed]       = useState([]);
  const [machinesDeployed, setMachinesDeployed] = useState([]);
  const [manpowerDeployed, setManpowerDeployed] = useState([]);

  // ── Master data from API ──────────────────────────────────────────────────
  const [masterWorkTypes,   setMasterWorkTypes]   = useState([]);
  const [masterLayers,      setMasterLayers]      = useState([]);
  const [masterStructTypes, setMasterStructTypes] = useState([]);
  const [masterElements,    setMasterElements]    = useState([]);
  const [masterActivities,  setMasterActivities]  = useState([]);
  const [roadSections,      setRoadSections]      = useState([]);
  const [roadSides,         setRoadSides]         = useState([]);
  const [mastersLoading,    setMastersLoading]    = useState(true);

  // ── Project pre-fill ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isEdit && selectedProjectId) {
      setFormData(prev => prev.project_id === selectedProjectId
        ? prev : { ...prev, project_id: selectedProjectId });
    }
  }, [isEdit, selectedProjectId]);

  // ── Load existing entry for edit ──────────────────────────────────────────
  useEffect(() => {
    if (!isEdit) return;
    const fetchEntry = async () => {
      setLoading(true);
      try {
        const entry = await getCapture(id);
        if (entry.approved) {
          toast.error('Approved entries cannot be edited');
          navigate(`/captures/${id}`);
          return;
        }
        setFormData({
          project_id:      entry.project_id || '',
          work_type:       entry.work_type || 'ROAD',
          activity_code:   entry.activity_code || '',
          layer_code:      entry.layer_code || '',
          element_code:    entry.element_code || '',
          structure_type:  entry.structure_type || '',
          chainage_from:   entry.chainage_from ?? '',
          chainage_to:     entry.chainage_to ?? '',
          quantity_lm:     entry.quantity_lm ?? '',
          quantity:        entry.quantity ?? '',
          unit:            entry.unit || '',
          length_m:        entry.length_m ?? '',
          width_m:         entry.width_m ?? '',
          depth_m:         entry.depth_m ?? '',
          count:           entry.count ?? 1,
          contractor_name: entry.contractor_name || '',
          road_side:       entry.road_side || 'LHS',
          rfi_number:      entry.rfi_number ?? '',
          layer_section:   entry.layer_section || '',
          weather_code:    entry.weather_code || '',
          progress_status: entry.progress_status || '',
          entry_date:      entry.entry_date ? entry.entry_date.substring(0, 10) : '',
          remarks:         entry.remarks || '',
        });
        setMaterialsUsed(Array.isArray(entry.materials_used) ? entry.materials_used.map(m => ({
          material_code: m.material_code || '',
          quantity:      m.quantity ?? '',
          unit:          m.unit || '',
          source:        m.source || '',
        })) : []);
        setMachinesDeployed(Array.isArray(entry.machines_deployed) ? entry.machines_deployed.map(m => ({
          machine_code:  m.machine_code || '',
          count:         m.count ?? 1,
          hours:         m.hours ?? '',
          operator_name: m.operator_name || m.operator || '',
        })) : []);
        setManpowerDeployed(Array.isArray(entry.manpower_deployed) ? entry.manpower_deployed.map(m => ({
          category:   m.category || '',
          count:      m.count ?? '',
          shift_type: m.shift_type || 'DAY',
        })) : []);
      } catch (err) {
        toast.error(getApiErrorMessage(err, 'Something went wrong'));
      } finally {
        setLoading(false);
      }
    };
    fetchEntry();
  }, [id, isEdit, navigate]);

  // Auto-enable manual mode when editing a legacy/unknown activity code
  useEffect(() => {
    if (isEdit && formData.activity_code && masterActivities.length > 0) {
      const known = masterActivities.find(a => a.code === formData.activity_code);
      if (!known) setManualActivity(true);
    }
  }, [isEdit, formData.activity_code, masterActivities]);

  // ── Auto-derive quantity_lm from chainage diff ────────────────────────────
  useEffect(() => {
    if (manualQuantity) return;
    const from = Number(formData.chainage_from);
    const to   = Number(formData.chainage_to);
    if (!Number.isNaN(from) && !Number.isNaN(to) &&
        formData.chainage_from !== '' && formData.chainage_to !== '') {
      const qty = ((to - from) * 1000).toFixed(3);
      if (Number(qty) > 0)
        setFormData(prev => prev.quantity_lm === qty ? prev : { ...prev, quantity_lm: qty });
    }
  }, [formData.chainage_from, formData.chainage_to, manualQuantity]);

  // ── Auto-derive quantity from L × W × D × Count (STRUCTURE) ──
  useEffect(() => {
    if (formData.work_type !== 'STRUCTURE') return;
    if (manualQuantity) return;
    const l = Number(formData.length_m);
    const w = Number(formData.width_m);
    const d = Number(formData.depth_m);
    const c = Number(formData.count) || 1;
    if (l > 0 && w > 0 && d > 0) {
      const qty = (l * w * d * c).toFixed(3);
      setFormData(prev =>
        prev.quantity === qty ? prev : { ...prev, quantity: qty }
      );
    }
  }, [
    formData.work_type,
    formData.length_m,
    formData.width_m,
    formData.depth_m,
    formData.count,
    manualQuantity,
  ]);

  // ── Master data loading ───────────────────────────────────────────────────

  // Load static masters on mount (work types, layers, structure types)
  useEffect(() => {
    const loadStaticMasters = async () => {
      try {
        const [wts, lyrs, stts, rsData, rsdData] = await Promise.all([
          getWorkTypes(true),
          getLayers(null, true),
          getStructureTypes(true),
          getRoadSections(),
          getRoadSides(),
        ]);
        setMasterWorkTypes(wts);
        setMasterLayers(lyrs);
        setMasterStructTypes(stts);
        setRoadSections(rsData);
        setRoadSides(rsdData);
      } catch (err) {
        console.warn('Failed to load master work types/layers:', err.message);
      } finally {
        setMastersLoading(false);
      }
    };
    loadStaticMasters();
  }, []);

  // Load elements when structure type changes (STRUCTURE work type)
  useEffect(() => {
    if (formData.work_type !== 'STRUCTURE' || !formData.structure_type) {
      setMasterElements([]);
      return;
    }
    getElements(true)
      .then(allElements => setMasterElements(allElements))
      .catch(err => console.warn('Failed to load elements:', err.message));
  }, [formData.structure_type, formData.work_type]);

  // Load activities based on current work type + layer/element selection
  useEffect(() => {
    const loadActivities = async () => {
      try {
        if (!formData.work_type) {
          setMasterActivities([]);
          return;
        }
        if (formData.work_type === 'ROAD') {
          const acts = await getActivities('ROAD', formData.layer_code || null, true);
          setMasterActivities(acts);
          return;
        }
        if (formData.work_type === 'STRUCTURE') {
          if (formData.structure_type && formData.element_code) {
            const acts = await getStructureActivities(formData.structure_type, formData.element_code);
            setMasterActivities(acts);
            return;
          }
          const acts = await getActivities('STRUCTURE', null, true);
          setMasterActivities(acts);
          return;
        }
        const acts = await getActivities(formData.work_type, null, true);
        setMasterActivities(acts);
      } catch (err) {
        console.warn('Failed to load activities:', err.message);
        setMasterActivities([]);
      }
    };
    loadActivities();
  }, [formData.work_type, formData.layer_code, formData.structure_type, formData.element_code]);

  // ── Cascade reset helpers ─────────────────────────────────────────────────
  const updateField = (key, value) => setFormData(prev => ({ ...prev, [key]: value }));

  const updateWorkType = (newWorkType) => {
    setFormData(prev => ({
      ...prev,
      work_type: newWorkType,
      layer_code: '', element_code: '', structure_type: '', activity_code: '',
    }));
    setManualActivity(false);
  };

  const updateLayer = (newLayer) =>
    setFormData(prev => ({ ...prev, layer_code: newLayer, activity_code: '' }));

  const updateStructureType = (newType) =>
    setFormData(prev => ({ ...prev, structure_type: newType, element_code: '', activity_code: '' }));

  const updateElement = (newElement) =>
    setFormData(prev => ({ ...prev, element_code: newElement, activity_code: '' }));

  // ── Filtered activity / element lists (driven by master data state) ────────
  const availableActivities = useMemo(() => {
    return masterActivities;
  }, [masterActivities]);

  const availableElements = useMemo(() => {
    if (formData.work_type === 'STRUCTURE' && formData.structure_type) {
      return masterElements;
    }
    return masterElements;
  }, [formData.work_type, formData.structure_type, masterElements]);

  const isLegacyActivity = formData.activity_code &&
    masterActivities.length > 0 &&
    !masterActivities.find(a => a.code === formData.activity_code);

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = () => {
    if (!formData.project_id || !formData.activity_code) {
      toast.error('Project and Activity Code are required');
      return false;
    }
    const from = Number(formData.chainage_from);
    const to   = Number(formData.chainage_to);
    if (formData.chainage_from !== '' && formData.chainage_to !== '' && to <= from) {
      toast.error('Chainage To must be greater than Chainage From');
      return false;
    }
    return true;
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!validate()) return;

    const n = (v) => (v !== '' && v !== null && v !== undefined ? Number(v) : undefined);
    const s = (v) => (v ? String(v).trim() || undefined : undefined);

    const payload = {
      project_id:      formData.project_id.trim(),
      work_type:       formData.work_type || undefined,
      activity_code:   formData.activity_code.trim(),
      layer_code:      s(formData.layer_code),
      element_code:    s(formData.element_code),
      structure_type:  s(formData.structure_type),
      stage:           deriveStage({
                         workType:    formData.work_type,
                         layerCode:   formData.layer_code,
                         elementCode: formData.element_code,
                       }) || undefined,
      chainage_from:   n(formData.chainage_from),
      chainage_to:     n(formData.chainage_to),
      quantity_lm:     n(formData.quantity_lm),
      quantity:        n(formData.quantity),
      unit:            s(formData.unit),
      length_m:        n(formData.length_m),
      width_m:         n(formData.width_m),
      depth_m:         n(formData.depth_m),
      count:           Number(formData.count) || 1,
      contractor_name: s(formData.contractor_name),
      road_side:       formData.road_side || undefined,
      rfi_number:      formData.rfi_number !== '' ? Number(formData.rfi_number) : undefined,
      layer_section:   s(formData.layer_section),
      weather_code:    s(formData.weather_code),
      progress_status: s(formData.progress_status),
      entry_date:      formData.entry_date || undefined,
      remarks:         s(formData.remarks),
      materials_used: materialsUsed
        .filter(m => m.material_code)
        .map(m => ({ material_code: m.material_code, quantity: n(m.quantity), unit: s(m.unit), source: s(m.source) })),
      machines_deployed: machinesDeployed
        .filter(m => m.machine_code)
        .map(m => ({ machine_code: m.machine_code, count: n(m.count) ?? 1, hours: n(m.hours), operator_name: s(m.operator_name) })),
      manpower_deployed: manpowerDeployed
        .filter(m => m.category)
        .map(m => ({ category: m.category, count: n(m.count), shift_type: m.shift_type || 'DAY' })),
    };

    setSaving(true);
    try {
      if (isEdit) {
        await updateCapture(id, payload);
      } else {
        await createCapture(payload);
      }
      toast.success('Capture saved successfully');
      navigate('/captures');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Something went wrong'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading capture…" />;

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">
        {isEdit ? 'Edit Capture' : 'New Capture'}
      </h1>

      {/* ── Classification ── */}
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Classification</p>
      <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2">

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Project *</label>
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
            {selectedProject
              ? `${selectedProject.project_code} - ${selectedProject.name}`
              : formData.project_id}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Work Type</label>
          <select value={formData.work_type} onChange={e => updateWorkType(e.target.value)}
            disabled={mastersLoading} className={sel}>
            {mastersLoading
              ? <option>Loading...</option>
              : masterWorkTypes.map(w => <option key={w.code} value={w.code}>{w.label}</option>)
            }
          </select>
        </div>

        {formData.work_type === 'ROAD' && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Layer</label>
            <select value={formData.layer_code} onChange={e => updateLayer(e.target.value)} className={sel}>
              <option value="">— Select Layer —</option>
              {masterLayers
                .filter(l => l.work_type_code === 'ROAD')
                .map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </div>
        )}

        {formData.work_type === 'STRUCTURE' && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Structure Type</label>
            <select value={formData.structure_type} onChange={e => updateStructureType(e.target.value)} className={sel}>
              <option value="">— Select Structure Type —</option>
              {masterStructTypes.map(s => <option key={s.code} value={s.code}>{s.label}</option>)}
            </select>
          </div>
        )}

        {formData.work_type === 'STRUCTURE' && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Element</label>
            <select value={formData.element_code} onChange={e => updateElement(e.target.value)}
              className={sel} disabled={!formData.structure_type}>
              <option value="">
                {formData.structure_type ? '— Select Element —' : '— Select structure type first —'}
              </option>
              {availableElements.map(el => <option key={el.code} value={el.code}>{el.label}</option>)}
            </select>
          </div>
        )}

        <div className="md:col-span-2">
          <div className="mb-1 flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700">Activity Code *</label>
            <button type="button" onClick={() => setManualActivity(p => !p)}
              className="text-xs font-medium text-blue-600 hover:text-blue-700">
              {manualActivity ? 'Use list' : 'Type manually'}
            </button>
          </div>

          {manualActivity ? (
            <input type="text" value={formData.activity_code}
              onChange={e => setFormData(prev => ({ ...prev, activity_code: e.target.value.toUpperCase() }))}
              placeholder="Type activity code (e.g. WMM_LAY)"
              className={inp} />
          ) : (
            <select value={formData.activity_code}
              onChange={e => setFormData(prev => ({ ...prev, activity_code: e.target.value }))}
              className={sel}>
              <option value="">— Select Activity —</option>
              {availableActivities.map(a => (
                <option key={a.code} value={a.code}>{a.code} — {a.label}</option>
              ))}
              {isLegacyActivity && (
                <option value={formData.activity_code}>
                  {formData.activity_code} (legacy — consider updating)
                </option>
              )}
            </select>
          )}

          {!manualActivity && formData.work_type === 'ROAD' && !formData.layer_code && (
            <p className="mt-1 text-xs text-gray-400">Select a layer above to filter activities</p>
          )}
          {!manualActivity && formData.work_type === 'STRUCTURE' && !formData.structure_type && (
            <p className="mt-1 text-xs text-gray-400">Select structure type and element to filter activities</p>
          )}
          {isLegacyActivity && !manualActivity && (
            <p className="mt-1 text-xs text-amber-600">
              ⚠ Current code "{formData.activity_code}" is not in the standard list.
              Select from list or use "Type manually" to keep it.
            </p>
          )}
        </div>

      </div>

      {/* ── Location ── */}
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Location</p>
      <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Chainage From</label>
          <input type="number" step="0.001" value={formData.chainage_from}
            onChange={e => updateField('chainage_from', e.target.value)} className={inp} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Chainage To</label>
          <input type="number" step="0.001" value={formData.chainage_to}
            onChange={e => updateField('chainage_to', e.target.value)} className={inp} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Road Side</label>
          <select value={formData.road_side} onChange={e => updateField('road_side', e.target.value)} className={sel}>
            {roadSides.map(s => <option key={s.code} value={s.code}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Road Section
          </label>
          <select value={formData.layer_section}
                  onChange={e => updateField('layer_section', e.target.value)}
                  className={sel}>
            <option value="">— Select —</option>
            {roadSections.map(s =>
              <option key={s.code} value={s.code}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {/* ── Quantity & Dimensions ── */}
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Quantity & Dimensions</p>
      <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700">Quantity (LM)</label>
            <button type="button" onClick={() => setManualQuantity(p => !p)}
              className="text-xs font-medium text-blue-600 hover:text-blue-700">
              {manualQuantity ? 'Use Auto' : 'Override'}
            </button>
          </div>
          <input type="number" step="0.001" value={formData.quantity_lm}
            onChange={e => { setManualQuantity(true); updateField('quantity_lm', e.target.value); }}
            className={inp} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Quantity</label>
          <input type="number" step="0.001" value={formData.quantity}
            onChange={e => updateField('quantity', e.target.value)} className={inp} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Unit</label>
          <select value={formData.unit} onChange={e => updateField('unit', e.target.value)} className={sel}>
            {UNITS.map(u => <option key={u} value={u}>{u || '— Select Unit —'}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Length (m)</label>
          <input type="number" step="0.001" value={formData.length_m}
            onChange={e => updateField('length_m', e.target.value)} className={inp} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Width (m)</label>
          <input type="number" step="0.001" value={formData.width_m}
            onChange={e => updateField('width_m', e.target.value)} className={inp} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Depth (m)</label>
          <input type="number" step="0.001" value={formData.depth_m}
            onChange={e => updateField('depth_m', e.target.value)} className={inp} />
        </div>
        {formData.work_type === 'STRUCTURE' && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Count
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={formData.count}
              onChange={e => updateField('count', e.target.value)}
              className={inp}
              placeholder="1"
            />
            <p className="mt-1 text-xs text-gray-400">
              No. of repeating units (piers, walls, etc.)
            </p>
          </div>
        )}
      </div>

      {/* ── Site Details ── */}
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Site Details</p>
      <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Contractor</label>
          <input type="text" value={formData.contractor_name}
            onChange={e => updateField('contractor_name', e.target.value)} className={inp} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">RFI Number</label>
          <input type="number" step="1" value={formData.rfi_number}
            onChange={e => updateField('rfi_number', e.target.value)} className={inp} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Weather</label>
          <select value={formData.weather_code}
            onChange={e => updateField('weather_code', e.target.value)} className={sel}>
            {WEATHER_OPTIONS.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Progress</label>
          <select value={formData.progress_status}
            onChange={e => updateField('progress_status', e.target.value)} className={sel}>
            {PROGRESS_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Entry Date</label>
          <input type="date" value={formData.entry_date}
            onChange={e => updateField('entry_date', e.target.value)} className={inp} />
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-medium text-gray-700">Remarks</label>
          <textarea rows={2} value={formData.remarks}
            onChange={e => updateField('remarks', e.target.value)} className={inp} />
        </div>
      </div>

      {/* ── 3M Resources ── */}
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
        3M Resources — Materials / Machines / Manpower
      </p>
      <MaterialsEditor rows={materialsUsed}     setRows={setMaterialsUsed} />
      <MachinesEditor  rows={machinesDeployed}  setRows={setMachinesDeployed} />
      <ManpowerEditor  rows={manpowerDeployed}  setRows={setManpowerDeployed} />

      <div className="mt-6 flex justify-end gap-3">
        <button type="button" onClick={() => navigate(-1)}
          className="rounded-lg bg-gray-100 px-4 py-2 font-medium text-gray-700 transition hover:bg-gray-200">
          Cancel
        </button>
        <button type="button" onClick={handleSave} disabled={saving}
          className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70">
          {saving ? 'Saving…' : 'Save Capture'}
        </button>
      </div>
    </div>
  );
};

export default CaptureForm;
