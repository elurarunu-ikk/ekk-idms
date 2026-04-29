import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { createCapture, getCapture, updateCapture } from '../services/apiService';
import LoadingSpinner from '../components/LoadingSpinner';
import useProjectSession from '../hooks/useProjectSession';

const stageOptions = ['Subgrade', 'Sub-base', 'Base', 'Prime', 'Surface'];
const roadSideOptions = ['Left', 'Right', 'Both'];

const initialState = {
  project_id: '',
  activity_code: '',
  chainage_from: '',
  chainage_to: '',
  stage: 'Subgrade',
  quantity_lm: '',
  contractor_name: '',
  road_side: 'Left',
  rfi_number: '',
  layer_section: '',
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
      setFormData((prev) => ({ ...prev, project_id: selectedProjectId }));
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
          activity_code: entry.activity_code || '',
          chainage_from: entry.chainage_from ?? '',
          chainage_to: entry.chainage_to ?? '',
          stage: entry.stage || 'Subgrade',
          quantity_lm: entry.quantity_lm ?? '',
          contractor_name: entry.contractor_name || '',
          road_side: entry.road_side || 'Left',
          rfi_number: entry.rfi_number || '',
          layer_section: entry.layer_section || '',
        });
      } catch (err) {
        toast.error(err.response?.data?.detail || 'Something went wrong');
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
        setFormData((prev) => ({ ...prev, quantity_lm: quantity.toFixed(3) }));
      }
    }
  }, [formData.chainage_from, formData.chainage_to, manualQuantity]);

  const updateField = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const validate = () => {
    const requiredFields = [
      'project_id',
      'activity_code',
      'chainage_from',
      'chainage_to',
      'stage',
      'quantity_lm',
      'contractor_name',
      'road_side',
      'rfi_number',
    ];

    const missing = requiredFields.some((field) => {
      const value = formData[field];
      return value === '' || value === null || value === undefined;
    });

    if (missing) {
      toast.error('Please fill all required fields');
      return false;
    }

    const from = Number(formData.chainage_from);
    const to = Number(formData.chainage_to);
    const qty = Number(formData.quantity_lm);

    if (to <= from) {
      toast.error('Chainage To must be greater than Chainage From');
      return false;
    }

    if (qty <= 0) {
      toast.error('Quantity (LM) must be positive');
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!validate()) {
      return;
    }

    const payload = {
      project_id: formData.project_id.trim(),
      activity_code: formData.activity_code.trim(),
      chainage_from: Number(formData.chainage_from),
      chainage_to: Number(formData.chainage_to),
      stage: formData.stage,
      quantity_lm: Number(formData.quantity_lm),
      contractor_name: formData.contractor_name.trim(),
      road_side: formData.road_side,
      rfi_number: formData.rfi_number.trim(),
      layer_section: formData.layer_section.trim(),
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
      toast.error(err.response?.data?.detail || 'Something went wrong');
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Project *</label>
          <div className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700">
            {selectedProject ? `${selectedProject.project_code} - ${selectedProject.name}` : formData.project_id}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Activity Code *</label>
          <input
            type="text"
            value={formData.activity_code}
            onChange={(e) => updateField('activity_code', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Chainage From *</label>
          <input
            type="number"
            step="0.001"
            value={formData.chainage_from}
            onChange={(e) => updateField('chainage_from', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Chainage To *</label>
          <input
            type="number"
            step="0.001"
            value={formData.chainage_to}
            onChange={(e) => updateField('chainage_to', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Stage *</label>
          <select
            value={formData.stage}
            onChange={(e) => updateField('stage', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
          >
            {stageOptions.map((stage) => (
              <option key={stage} value={stage}>
                {stage}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700">Quantity (LM) *</label>
            <button
              type="button"
              onClick={() => setManualQuantity((prev) => !prev)}
              className="text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              {manualQuantity ? 'Use Auto' : 'Override Manually'}
            </button>
          </div>
          <input
            type="number"
            step="0.001"
            value={formData.quantity_lm}
            onChange={(e) => {
              setManualQuantity(true);
              updateField('quantity_lm', e.target.value);
            }}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Contractor Name *</label>
          <input
            type="text"
            value={formData.contractor_name}
            onChange={(e) => updateField('contractor_name', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Road Side *</label>
          <select
            value={formData.road_side}
            onChange={(e) => updateField('road_side', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
          >
            {roadSideOptions.map((side) => (
              <option key={side} value={side}>
                {side}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">RFI Number *</label>
          <input
            type="text"
            value={formData.rfi_number}
            onChange={(e) => updateField('rfi_number', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Layer Section</label>
          <input
            type="text"
            value={formData.layer_section}
            onChange={(e) => updateField('layer_section', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
          />
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