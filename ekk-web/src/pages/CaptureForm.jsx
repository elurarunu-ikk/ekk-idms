import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { createCapture, getApiErrorMessage, getCapture, updateCapture } from '../services/apiService';
import LoadingSpinner from '../components/LoadingSpinner';
import useProjectSession from '../hooks/useProjectSession';

const WORK_TYPES = ['ROAD', 'STRUCTURE', 'DRAIN', 'ANCILLARY', 'MISC'];
const LAYERS = [
  { code: '', label: '— Select Layer —' },
  { code: 'EMBANKMENT', label: 'Embankment' },
  { code: 'SUBGRADE', label: 'Subgrade' },
  { code: 'GSB', label: 'GSB' },
  { code: 'CTSB', label: 'CTSB' },
  { code: 'CTB', label: 'CTB' },
  { code: 'WMM', label: 'WMM' },
  { code: 'BASE', label: 'Base Course' },
  { code: 'BINDER', label: 'Binder Course (DBM)' },
  { code: 'WEARING', label: 'Wearing Course (BC)' },
  { code: 'PRIME', label: 'Prime Coat' },
  { code: 'TACK', label: 'Tack Coat' },
  { code: 'SHOULDER', label: 'Shoulder' },
  { code: 'MEDIAN', label: 'Median' },
];
const ELEMENTS = [
  '', 'FOUNDATION', 'FOOTING', 'PIER', 'PIER_CAP', 'ABUTMENT',
  'DECK', 'GIRDER', 'SLAB', 'WING_WALL', 'BEARING', 'EXPANSION_JOINT',
];
const ROAD_SIDES = ['LHS', 'RHS', 'Both', 'Median'];
const WEATHER_OPTIONS = ['', 'SUNNY', 'CLOUDY', 'RAINY'];
const PROGRESS_OPTIONS = ['', 'STARTED', 'ONGOING', 'COMPLETED'];
const UNITS = ['', 'CUM', 'MT', 'KG', 'SQM', 'LM', 'BAG', 'NOS', 'LTR', 'TON'];

const initialState = {
  project_id: '',
  work_type: 'ROAD',
  activity_code: '',
  layer_code: '',
  element_code: '',
  structure_type: '',
  chainage_from: '',
  chainage_to: '',
  stage: '',
  quantity_lm: '',
  quantity: '',
  unit: '',
  length_m: '',
  width_m: '',
  depth_m: '',
  contractor_name: '',
  road_side: 'LHS',
  rfi_number: '',
  layer_section: '',
  weather_code: '',
  progress_status: '',
  entry_date: '',
  remarks: '',
};

const CaptureForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = useMemo(() => Boolean(id), [id]);
  const { selectedProjectId, selectedProject } = useProjectSession();

  const [formData, setFormData] = useState(initialState);
  const [manualQuantity, setManualQuantity] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEdit && selectedProjectId) {
      setFormData((prev) => {
        if (prev.project_id === selectedProjectId) {
          return prev;
        }
        return { ...prev, project_id: selectedProjectId };
      });
    }
  }, [isEdit, selectedProjectId]);

  useEffect(() => {
    if (!isEdit) {
      return;
    }

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
          project_id: entry.project_id || '',
          work_type: entry.work_type || 'ROAD',
          activity_code: entry.activity_code || '',
          layer_code: entry.layer_code || '',
          element_code: entry.element_code || '',
          structure_type: entry.structure_type || '',
          chainage_from: entry.chainage_from ?? '',
          chainage_to: entry.chainage_to ?? '',
          stage: entry.stage || '',
          quantity_lm: entry.quantity_lm ?? '',
          quantity: entry.quantity ?? '',
          unit: entry.unit || '',
          length_m: entry.length_m ?? '',
          width_m: entry.width_m ?? '',
          depth_m: entry.depth_m ?? '',
          contractor_name: entry.contractor_name || '',
          road_side: entry.road_side || 'LHS',
          rfi_number: entry.rfi_number ?? '',
          layer_section: entry.layer_section || '',
          weather_code: entry.weather_code || '',
          progress_status: entry.progress_status || '',
          entry_date: entry.entry_date ? entry.entry_date.substring(0, 10) : '',
          remarks: entry.remarks || '',
        });
      } catch (err) {
        toast.error(getApiErrorMessage(err, 'Something went wrong'));
      } finally {
        setLoading(false);
      }
    };

    fetchEntry();
  }, [id, isEdit, navigate]);

  useEffect(() => {
    if (manualQuantity) {
      return;
    }

    const from = Number(formData.chainage_from);
    const to = Number(formData.chainage_to);

    if (!Number.isNaN(from) && !Number.isNaN(to) && formData.chainage_from !== '' && formData.chainage_to !== '') {
      const quantity = to - from;
      if (quantity > 0) {
        const autoQuantity = quantity.toFixed(3);
        setFormData((prev) => {
          if (prev.quantity_lm === autoQuantity) {
            return prev;
          }
          return { ...prev, quantity_lm: autoQuantity };
        });
      }
    }
  }, [formData.chainage_from, formData.chainage_to, manualQuantity]);

  const updateField = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const validate = () => {
    if (!formData.project_id || !formData.activity_code) {
      toast.error('Project and Activity Code are required');
      return false;
    }
    const from = Number(formData.chainage_from);
    const to = Number(formData.chainage_to);
    if (formData.chainage_from !== '' && formData.chainage_to !== '' && to <= from) {
      toast.error('Chainage To must be greater than Chainage From');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validate()) {
      return;
    }

    const n = (v) => (v !== '' && v !== null ? Number(v) : undefined);
    const s = (v) => (v ? v.trim() : undefined);
    const payload = {
      project_id: formData.project_id.trim(),
      work_type: formData.work_type || undefined,
      activity_code: formData.activity_code.trim(),
      layer_code: s(formData.layer_code),
      element_code: s(formData.element_code),
      structure_type: s(formData.structure_type),
      chainage_from: n(formData.chainage_from),
      chainage_to: n(formData.chainage_to),
      stage: s(formData.stage),
      quantity_lm: n(formData.quantity_lm),
      quantity: n(formData.quantity),
      unit: s(formData.unit),
      length_m: n(formData.length_m),
      width_m: n(formData.width_m),
      depth_m: n(formData.depth_m),
      contractor_name: formData.contractor_name.trim() || undefined,
      road_side: formData.road_side || undefined,
      rfi_number: formData.rfi_number !== '' ? Number(formData.rfi_number) : undefined,
      layer_section: s(formData.layer_section),
      weather_code: s(formData.weather_code),
      progress_status: s(formData.progress_status),
      entry_date: formData.entry_date || undefined,
      remarks: s(formData.remarks),
    };

    setSaving(true);
    try {
      if (isEdit) {
        await updateCapture(id, payload);
      } else {
        await createCapture(payload);
      }
      toast.success('Entry saved successfully');
      navigate('/captures');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Something went wrong'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading entry..." />;
  }

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">{isEdit ? 'Edit Entry' : 'New Entry'}</h1>

      {/* ── Classification ── */}
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Classification</p>
      <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Project *</label>
          <div className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700">
            {selectedProject ? `${selectedProject.project_code} - ${selectedProject.name}` : formData.project_id}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Work Type</label>
          <select value={formData.work_type} onChange={(e) => updateField('work_type', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none">
            {WORK_TYPES.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Activity Code *</label>
          <input type="text" value={formData.activity_code} onChange={(e) => updateField('activity_code', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none" />
        </div>
        {formData.work_type === 'ROAD' && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Layer</label>
            <select value={formData.layer_code} onChange={(e) => updateField('layer_code', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none">
              {LAYERS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </div>
        )}
        {formData.work_type === 'STRUCTURE' && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Element</label>
            <select value={formData.element_code} onChange={(e) => updateField('element_code', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none">
              {ELEMENTS.map((e) => <option key={e} value={e}>{e || '— Select Element —'}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Stage</label>
          <input type="text" value={formData.stage} onChange={(e) => updateField('stage', e.target.value)} placeholder="e.g. SUBGRADE, WMM, DBM" className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none" />
        </div>
      </div>

      {/* ── Location ── */}
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Location</p>
      <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Chainage From</label>
          <input type="number" step="0.001" value={formData.chainage_from} onChange={(e) => updateField('chainage_from', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Chainage To</label>
          <input type="number" step="0.001" value={formData.chainage_to} onChange={(e) => updateField('chainage_to', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Road Side</label>
          <select value={formData.road_side} onChange={(e) => updateField('road_side', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none">
            {ROAD_SIDES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Layer Section</label>
          <input type="text" value={formData.layer_section} onChange={(e) => updateField('layer_section', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none" />
        </div>
      </div>

      {/* ── Quantity & Dimensions ── */}
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Quantity & Dimensions</p>
      <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700">Quantity (LM)</label>
            <button type="button" onClick={() => setManualQuantity((p) => !p)} className="text-xs font-medium text-blue-600 hover:text-blue-700">{manualQuantity ? 'Use Auto' : 'Override'}</button>
          </div>
          <input type="number" step="0.001" value={formData.quantity_lm} onChange={(e) => { setManualQuantity(true); updateField('quantity_lm', e.target.value); }} className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Quantity</label>
          <input type="number" step="0.001" value={formData.quantity} onChange={(e) => updateField('quantity', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Unit</label>
          <select value={formData.unit} onChange={(e) => updateField('unit', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none">
            {UNITS.map((u) => <option key={u} value={u}>{u || '— Select Unit —'}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Length (m)</label>
          <input type="number" step="0.001" value={formData.length_m} onChange={(e) => updateField('length_m', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Width (m)</label>
          <input type="number" step="0.001" value={formData.width_m} onChange={(e) => updateField('width_m', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Depth (m)</label>
          <input type="number" step="0.001" value={formData.depth_m} onChange={(e) => updateField('depth_m', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none" />
        </div>
      </div>

      {/* ── Site Details ── */}
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Site Details</p>
      <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Contractor</label>
          <input type="text" value={formData.contractor_name} onChange={(e) => updateField('contractor_name', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">RFI Number</label>
          <input type="number" step="1" value={formData.rfi_number} onChange={(e) => updateField('rfi_number', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Weather</label>
          <select value={formData.weather_code} onChange={(e) => updateField('weather_code', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none">
            {WEATHER_OPTIONS.map((w) => <option key={w} value={w}>{w || '— Select —'}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Progress</label>
          <select value={formData.progress_status} onChange={(e) => updateField('progress_status', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none">
            {PROGRESS_OPTIONS.map((p) => <option key={p} value={p}>{p || '— Select —'}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Entry Date</label>
          <input type="date" value={formData.entry_date} onChange={(e) => updateField('entry_date', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none" />
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-medium text-gray-700">Remarks</label>
          <textarea rows={2} value={formData.remarks} onChange={(e) => updateField('remarks', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none" />
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-lg bg-gray-100 px-4 py-2 font-medium text-gray-700 transition hover:bg-gray-200"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {saving ? 'Saving...' : 'Save Entry'}
        </button>
      </div>
    </div>
  );
};

export default CaptureForm;