import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { listCaptures } from '../services/apiService';
import LoadingSpinner from '../components/LoadingSpinner';
import FilterBar from '../components/FilterBar';
import useProjectSession from '../hooks/useProjectSession';

const DATE_FIELDS = new Set(['created_at', 'approved_at']);
const BOOLEAN_FIELDS = new Set(['approved', 'rejected', 'payment_qualifies']);
const HUMANIZED_CODE_FIELDS = new Set([
  'work_type',
  'structure_type',
  'layer_code',
  'element_code',
  'weather_code',
  'progress_status',
  'source',
]);

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatDateTime = (value) => {
  if (!value) return 'Not set';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleString('en-US', { month: 'short' });
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
};

const humanizeCode = (value) =>
  String(value)
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const inferLegacyFieldValue = (entry, fieldKey) => {
  if (!entry) return null;

  if (fieldKey === 'layer_code' && entry.stage) {
    return entry.stage;
  }

  if (fieldKey === 'work_type') {
    if (entry.work_type) return entry.work_type;
    if (entry.layer_code || entry.stage) return 'ROAD';
  }

  if (fieldKey === 'length_m') {
    const from = Number(entry.chainage_from);
    const to = Number(entry.chainage_to);
    if (Number.isFinite(from) && Number.isFinite(to) && to > from) {
      return Number(((to - from) * 1000).toFixed(3));
    }
  }

  return null;
};

const formatReportValue = (entry, fieldKey) => {
  const rawValue = entry?.[fieldKey];
  const inferredValue = inferLegacyFieldValue(entry, fieldKey);
  const value = rawValue ?? inferredValue;

  if (DATE_FIELDS.has(fieldKey)) {
    return formatDateTime(value);
  }

  if (BOOLEAN_FIELDS.has(fieldKey)) {
    if (value === true) return 'Yes';
    return 'No';
  }

  if (value === null || value === undefined || value === '') {
    return 'Not captured';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  if (HUMANIZED_CODE_FIELDS.has(fieldKey)) {
    return humanizeCode(value);
  }

  return String(value);
};

const AVAILABLE_FIELDS = [
  { key: 'id', label: 'Entry ID', category: 'Identity' },
  { key: 'project_id', label: 'Project ID', category: 'Identity' },
  { key: 'activity_code', label: 'Activity Code', category: 'Activity' },
  { key: 'stage', label: 'Stage', category: 'Activity' },
  { key: 'chainage_from', label: 'Chainage From', category: 'Location' },
  { key: 'chainage_to', label: 'Chainage To', category: 'Location' },
  { key: 'quantity_lm', label: 'Quantity (LM)', category: 'Quantity' },
  { key: 'quantity', label: 'Quantity', category: 'Quantity' },
  { key: 'unit', label: 'Unit', category: 'Quantity' },
  { key: 'contractor_name', label: 'Contractor Name', category: 'Details' },
  { key: 'road_side', label: 'Road Side', category: 'Location' },
  { key: 'rfi_number', label: 'RFI Number', category: 'Details' },
  { key: 'layer_section', label: 'Layer Section', category: 'Details' },
  { key: 'remarks', label: 'Remarks', category: 'Details' },
  { key: 'weather_code', label: 'Weather', category: 'Conditions' },
  { key: 'progress_status', label: 'Progress Status', category: 'Conditions' },
  { key: 'source', label: 'Source', category: 'Details' },
  { key: 'approved', label: 'Approved', category: 'Status' },
  { key: 'rejected', label: 'Rejected', category: 'Status' },
  { key: 'approved_by', label: 'Approved By', category: 'Status' },
  { key: 'approved_at', label: 'Approved At', category: 'Status' },
  { key: 'reject_reason', label: 'Reject Reason', category: 'Status' },
  { key: 'created_at', label: 'Created At', category: 'Timestamps' },
  { key: 'gps_start_lat', label: 'GPS Start Latitude', category: 'GPS' },
  { key: 'gps_start_lng', label: 'GPS Start Longitude', category: 'GPS' },
  { key: 'gps_end_lat', label: 'GPS End Latitude', category: 'GPS' },
  { key: 'gps_end_lng', label: 'GPS End Longitude', category: 'GPS' },
  { key: 'gps_accuracy_m', label: 'GPS Accuracy (m)', category: 'GPS' },
  { key: 'work_type', label: 'Work Type', category: 'Activity' },
  { key: 'structure_type', label: 'Structure Type', category: 'Activity' },
  { key: 'layer_code', label: 'Layer Code', category: 'Activity' },
  { key: 'element_code', label: 'Element Code', category: 'Activity' },
  { key: 'length_m', label: 'Length (M)', category: 'Dimensions' },
  { key: 'width_m', label: 'Width (M)', category: 'Dimensions' },
  { key: 'depth_m', label: 'Depth (M)', category: 'Dimensions' },
  { key: 'cost', label: 'Cost', category: 'Financial' },
  { key: 'payment_qualifies', label: 'Payment Qualifies', category: 'Financial' },
];

const DEFAULT_FIELDS = ['activity_code', 'chainage_from', 'chainage_to', 'stage', 'quantity_lm', 'contractor_name', 'road_side', 'created_at'];
const MOBILE_CAPTURE_FIELDS = [
  'created_at',
  'work_type',
  'structure_type',
  'layer_code',
  'element_code',
  'activity_code',
  'stage',
  'chainage_from',
  'chainage_to',
  'length_m',
  'width_m',
  'depth_m',
  'quantity_lm',
  'quantity',
  'unit',
  'contractor_name',
  'road_side',
  'weather_code',
  'progress_status',
  'remarks',
  'gps_start_lat',
  'gps_start_lng',
  'gps_end_lat',
  'gps_end_lng',
  'gps_accuracy_m',
  'approved',
  'rejected',
  'payment_qualifies',
];

const Report = () => {
  const { selectedProjectId, selectedProject } = useProjectSession();
  const [selectedFields, setSelectedFields] = useState(DEFAULT_FIELDS);
  const [searchField, setSearchField] = useState('');
  const [filters, setFilters] = useState({ stage: 'All', status: 'All', search: '' });
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState({
    Activity: true,
    Identity: false,
    Location: true,
    Quantity: true,
    Details: true,
    Status: false,
    Conditions: false,
    Timestamps: false,
    GPS: false,
    Dimensions: false,
    Financial: false,
  });

  // Filter saving/loading state
  const [savedFilters, setSavedFilters] = useState([]);
  const [filterName, setFilterName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  // Load saved filters from localStorage on mount
  const loadSavedFilters = () => {
    try {
      const saved = localStorage.getItem('ekk_report_filters');
      if (saved) {
        setSavedFilters(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Error loading saved filters:', error);
    }
  };

  const saveCurrentFilter = () => {
    if (!filterName.trim()) {
      toast.error('Please enter a filter name');
      return;
    }

    const newFilter = {
      id: Date.now(),
      name: filterName,
      filters,
      selectedFields,
      timestamp: new Date().toLocaleString(),
    };

    const updated = [...savedFilters, newFilter];
    setSavedFilters(updated);
    localStorage.setItem('ekk_report_filters', JSON.stringify(updated));
    toast.success(`Filter "${filterName}" saved`);
    setFilterName('');
    setShowSaveDialog(false);
  };

  const loadFilter = (savedFilter) => {
    setFilters(savedFilter.filters);
    setSelectedFields(savedFilter.selectedFields);
    setDataLoaded(false);
    toast.success(`Loaded filter: "${savedFilter.name}"`);
  };

  const deleteFilter = (id) => {
    const updated = savedFilters.filter((f) => f.id !== id);
    setSavedFilters(updated);
    localStorage.setItem('ekk_report_filters', JSON.stringify(updated));
    toast.success('Filter deleted');
  };

  // Load saved filters on component mount
  useEffect(() => {
    loadSavedFilters();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = { project_id: selectedProjectId, skip: 0, limit: 500 };

      if (filters.stage !== 'All') {
        params.stage = filters.stage;
      }

      if (filters.status === 'Approved') {
        params.approved = true;
      } else if (filters.status === 'Rejected') {
        params.rejected = true;
      } else if (filters.status === 'Pending') {
        params.approved = false;
        params.rejected = false;
      }

      const data = await listCaptures(params);
      setEntries(data.entries || []);
      setDataLoaded(true);
    } catch (err) {
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to load data';
      toast.error(typeof errorMessage === 'string' ? errorMessage : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectField = (fieldKey) => {
    setSelectedFields((prev) =>
      prev.includes(fieldKey) ? prev.filter((f) => f !== fieldKey) : [...prev, fieldKey]
    );
  };

  const handleSelectAll = () => {
    if (selectedFields.length === AVAILABLE_FIELDS.length) {
      setSelectedFields([]);
    } else {
      setSelectedFields(AVAILABLE_FIELDS.map((f) => f.key));
    }
  };

  const handleResetFields = () => {
    setSelectedFields(DEFAULT_FIELDS);
  };

  const handleUseMobileFields = () => {
    setSelectedFields(MOBILE_CAPTURE_FIELDS);
  };

  const getFilteredFields = () => {
    if (!searchField.trim()) {
      return AVAILABLE_FIELDS;
    }
    const search = searchField.toLowerCase();
    return AVAILABLE_FIELDS.filter(
      (field) =>
        field.label.toLowerCase().includes(search) || field.key.toLowerCase().includes(search)
    );
  };

  const exportToExcel = () => {
    if (selectedFields.length === 0) {
      toast.error('Please select at least one field');
      return;
    }

    if (entries.length === 0) {
      toast.error('No data to export. Please load data first.');
      return;
    }

    try {
      // Create CSV content
      const headers = selectedFields
        .map((fieldKey) => {
          const field = AVAILABLE_FIELDS.find((f) => f.key === fieldKey);
          return field?.label || fieldKey;
        });

      const rows = entries.map((entry) =>
        selectedFields.map((fieldKey) => formatReportValue(entry, fieldKey).replace(/"/g, '""'))
      );

      // Build CSV string
      const csvContent = [
        headers.map((h) => `"${h}"`).join(','),
        ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
      ].join('\n');

      // Download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `report_${new Date().getTime()}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`Report exported to Excel (${entries.length} rows)`);
    } catch (error) {
      toast.error('Failed to export Excel');
      console.error(error);
    }
  };

  const exportToHTML = () => {
    if (selectedFields.length === 0) {
      toast.error('Please select at least one field');
      return;
    }

    if (entries.length === 0) {
      toast.error('No data to export. Please load data first.');
      return;
    }

    try {
      const headers = selectedFields.map((fieldKey) => {
        const field = AVAILABLE_FIELDS.find((f) => f.key === fieldKey);
        return field?.label || fieldKey;
      });

      let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>EKK IDMS Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #333; }
    table { border-collapse: collapse; width: 100%; margin-top: 20px; }
    th { background-color: #1e40af; color: white; padding: 12px; text-align: left; border: 1px solid #ddd; }
    td { padding: 10px; border: 1px solid #ddd; }
    tr:nth-child(even) { background-color: #f9fafb; }
    .timestamp { color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <h1>EKK IDMS - Capture Report</h1>
  <p class="timestamp">Generated on ${new Date().toLocaleString()}</p>
  <p><strong>Total Records:</strong> ${entries.length}</p>
  <table>
    <thead>
      <tr>
        ${headers.map((h) => `<th>${h}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${entries
        .map(
          (entry) => `
      <tr>
        ${selectedFields
          .map((fieldKey) => {
            const displayValue = formatReportValue(entry, fieldKey);
            return `<td>${escapeHtml(displayValue)}</td>`;
          })
          .join('')}
      </tr>
      `
        )
        .join('')}
    </tbody>
  </table>
</body>
</html>`;

      const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `report_${new Date().getTime()}.html`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`Report exported to HTML (${entries.length} rows)`);
    } catch (error) {
      toast.error('Failed to export HTML');
      console.error(error);
    }
  };

  const groupedFields = AVAILABLE_FIELDS.reduce((acc, field) => {
    if (!acc[field.category]) {
      acc[field.category] = [];
    }
    acc[field.category].push(field);
    return acc;
  }, {});

  const filteredFieldsList = getFilteredFields();
  const fieldsByCategory = Object.keys(groupedFields).reduce((acc, category) => {
    acc[category] = groupedFields[category].filter((field) => filteredFieldsList.includes(field));
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {selectedProject && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          Report scope: <span className="font-semibold">{selectedProject.project_code} - {selectedProject.name}</span>
        </div>
      )}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Generate Report</h1>
      </div>

      {/* Data Filter Section */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Filter Data</h2>
          {savedFilters.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Load Saved:</label>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    const filter = savedFilters.find((f) => f.id === parseInt(e.target.value));
                    if (filter) loadFilter(filter);
                    e.target.value = '';
                  }
                }}
                className="rounded-lg border border-gray-300 px-3 py-1 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="">-- Select a saved filter --</option>
                {savedFilters.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <FilterBar filters={filters} onChange={setFilters} />

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Load Data'}
          </button>
          <button
            type="button"
            onClick={() => setShowSaveDialog(!showSaveDialog)}
            className="rounded-lg bg-green-600 px-6 py-2 font-medium text-white transition hover:bg-green-700"
          >
            💾 Save Filter
          </button>
        </div>

        {showSaveDialog && (
          <div className="mt-4 flex gap-2 rounded-lg bg-green-50 p-4">
            <input
              type="text"
              placeholder="Enter filter name (e.g., 'Pending BASE Stage')"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && saveCurrentFilter()}
              className="flex-1 rounded-lg border border-green-300 px-3 py-2 focus:border-green-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={saveCurrentFilter}
              className="rounded-lg bg-green-600 px-4 py-2 font-medium text-white transition hover:bg-green-700"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setShowSaveDialog(false);
                setFilterName('');
              }}
              className="rounded-lg bg-gray-300 px-4 py-2 font-medium text-gray-700 transition hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        )}

        {savedFilters.length > 0 && (
          <div className="mt-4 space-y-2 rounded-lg bg-blue-50 p-4">
            <p className="text-sm font-semibold text-gray-700">📋 Saved Filters ({savedFilters.length}):</p>
            <div className="flex flex-wrap gap-2">
              {savedFilters.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center gap-2 rounded-lg bg-blue-100 px-3 py-2 text-sm text-gray-700"
                >
                  <span className="font-medium">{f.name}</span>
                  <button
                    type="button"
                    onClick={() => loadFilter(f)}
                    className="rounded bg-blue-600 px-2 py-0.5 text-xs font-medium text-white transition hover:bg-blue-700"
                  >
                    Load
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteFilter(f.id)}
                    className="rounded bg-red-600 px-2 py-0.5 text-xs font-medium text-white transition hover:bg-red-700"
                  >
                    Delete
                  </button>
                  <span className="text-xs text-gray-500">{f.timestamp}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {dataLoaded && <p className="mt-2 text-sm text-gray-600">Loaded {entries.length} records</p>}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Field Selection Panel */}
        <div className="lg:col-span-2">
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Select Fields</h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="rounded-lg bg-gray-200 px-3 py-1 text-sm font-medium text-gray-700 transition hover:bg-gray-300"
                >
                  {selectedFields.length === AVAILABLE_FIELDS.length ? 'Deselect All' : 'Select All'}
                </button>
                <button
                  type="button"
                  onClick={handleUseMobileFields}
                  className="rounded-lg bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700 transition hover:bg-blue-200"
                >
                  Mobile Fields
                </button>
                <button
                  type="button"
                  onClick={handleResetFields}
                  className="rounded-lg bg-gray-200 px-3 py-1 text-sm font-medium text-gray-700 transition hover:bg-gray-300"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Search Fields */}
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search fields..."
                value={searchField}
                onChange={(e) => setSearchField(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* Fields List */}
            <div className="max-h-96 space-y-2 overflow-y-auto">
              {Object.keys(fieldsByCategory).map((category) => (
                <div key={category}>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedCategories((prev) => ({
                        ...prev,
                        [category]: !prev[category],
                      }))
                    }
                    className="flex w-full items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-200"
                  >
                    <span>{expandedCategories[category] ? '▼' : '▶'}</span>
                    {category} ({fieldsByCategory[category].length})
                  </button>

                  {expandedCategories[category] && (
                    <div className="ml-4 space-y-2 py-2">
                      {fieldsByCategory[category].map((field) => (
                        <label key={field.key} className="flex items-center gap-3 rounded-lg px-2 py-1 hover:bg-gray-50">
                          <input
                            type="checkbox"
                            checked={selectedFields.includes(field.key)}
                            onChange={() => handleSelectField(field.key)}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600"
                          />
                          <span className="flex-1 text-sm text-gray-700">{field.label}</span>
                          <span className="text-xs text-gray-400">{field.key}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Export Panel */}
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Export Report</h2>

          <div className="space-y-4">
            <div className="rounded-lg bg-blue-50 p-3">
              <p className="text-sm text-gray-700">
                <strong>Selected Fields:</strong> {selectedFields.length}
              </p>
              <p className="text-sm text-gray-700">
                <strong>Total Records:</strong> {entries.length}
              </p>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Dates are shown as dd-mmm-yyyy hh:mm:ss. Empty mobile fields display as “Not captured”, and status flags display as Yes/No.
            </div>

            <button
              type="button"
              onClick={exportToExcel}
              disabled={loading || !dataLoaded}
              className="w-full rounded-lg bg-green-600 px-4 py-3 font-medium text-white transition hover:bg-green-700 disabled:opacity-50"
            >
              📊 Export to Excel
            </button>

            <button
              type="button"
              onClick={exportToHTML}
              disabled={loading || !dataLoaded}
              className="w-full rounded-lg bg-purple-600 px-4 py-3 font-medium text-white transition hover:bg-purple-700 disabled:opacity-50"
            >
              📄 Export to HTML
            </button>

            <div className="border-t border-gray-200 pt-4 text-xs text-gray-500">
              <p>• Select fields from the list</p>
              <p>• Filter and load data</p>
              <p>• Choose export format</p>
              <p>• File will download automatically</p>
            </div>
          </div>
        </div>
      </div>

      {/* Data Preview */}
      {dataLoaded && entries.length > 0 && (
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Data Preview (First 5 rows)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {selectedFields.map((fieldKey) => {
                    const field = AVAILABLE_FIELDS.find((f) => f.key === fieldKey);
                    return (
                      <th key={fieldKey} className="px-3 py-2 text-left font-semibold text-gray-700">
                        {field?.label || fieldKey}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {entries.slice(0, 5).map((entry, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    {selectedFields.map((fieldKey) => {
                      const displayValue = formatReportValue(entry, fieldKey);
                      return (
                        <td key={fieldKey} className="px-3 py-2 text-gray-600">
                          {displayValue.length > 50 ? `${displayValue.substring(0, 50)}...` : displayValue}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Report;
