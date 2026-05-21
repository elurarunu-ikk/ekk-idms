import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { listCaptures } from '../services/apiService';
import FilterBar from '../components/FilterBar';
import LoadingSpinner from '../components/LoadingSpinner';
import StatusBadge from '../components/StatusBadge';
import useProjectSession from '../hooks/useProjectSession';

const PAGE_SIZE = 20;

const CaptureList = () => {
  const navigate = useNavigate();
  const { selectedProjectId, selectedProject, hasPermission } = useProjectSession();
  const [filters, setFilters] = useState({ stage: 'All', status: 'All', search: '' });
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchEntries = async (nextSkip = skip, activeFilters = filters) => {
    setLoading(true);
    try {
      const params = {
        project_id: selectedProjectId,
        skip: nextSkip,
        limit: PAGE_SIZE,
      };

      if (activeFilters.stage !== 'All') {
        params.stage = activeFilters.stage;
      }

      if (activeFilters.status === 'Approved') {
        params.approved = true;
      }

      if (activeFilters.status === 'Rejected') {
        params.rejected = true;
      }

      if (activeFilters.status === 'Pending') {
        params.approved = false;
        params.rejected = false;
      }

      const data = await listCaptures(params);
      setEntries(data.entries || []);
      setTotal(data.total || 0);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries(0, filters);
    setSkip(0);
  }, [filters.stage, filters.status, selectedProjectId]);

  useEffect(() => {
    fetchEntries();
  }, [skip]);

  const filteredEntries = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    if (!search) {
      return entries;
    }

    return entries.filter((entry) => entry.contractor_name?.toLowerCase().includes(search));
  }, [entries, filters.search]);

  const pageIndex = Math.floor(skip / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Captures</h1>
          {selectedProject && <p className="text-sm text-gray-500">{selectedProject.project_code} - {selectedProject.name}</p>}
        </div>
        {hasPermission('capture', 'add') && <button
          type="button"
          onClick={() => navigate('/captures/new')}
          className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700"
        >
          New Entry
        </button>}
      </div>

      <FilterBar filters={filters} onChange={setFilters} />

      <div className="rounded-xl bg-white p-6 shadow-sm">
        {loading ? (
          <LoadingSpinner message="Loading captures..." />
        ) : filteredEntries.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-500">No entries found for current filters.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-600">
                    <th className="px-3 py-2">Activity Code</th>
                    <th className="px-3 py-2">Chainage From</th>
                    <th className="px-3 py-2">Chainage To</th>
                    <th className="px-3 py-2">Stage</th>
                    <th className="px-3 py-2">Qty (LM)</th>
                    <th className="px-3 py-2">Contractor</th>
                    <th className="px-3 py-2">Road Side</th>
                    <th className="px-3 py-2">RFI No</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map((entry, index) => (
                    <tr key={entry.id} className={index % 2 === 1 ? 'bg-gray-50' : 'bg-white'}>
                      <td className="px-3 py-3">{entry.activity_code}</td>
                      <td className="px-3 py-3">{entry.chainage_from}</td>
                      <td className="px-3 py-3">{entry.chainage_to}</td>
                      <td className="px-3 py-3">{entry.stage}</td>
                      <td className="px-3 py-3">{entry.quantity_lm}</td>
                      <td className="px-3 py-3">{entry.contractor_name}</td>
                      <td className="px-3 py-3">{entry.road_side}</td>
                      <td className="px-3 py-3">{entry.rfi_number}</td>
                      <td className="px-3 py-3">
                        <StatusBadge approved={entry.approved} rejected={entry.rejected} />
                      </td>
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => navigate(`/captures/${entry.id}`)}
                          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-gray-600">
                {Math.min(skip + PAGE_SIZE, total)} of {total} entries
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={skip === 0}
                  onClick={() => setSkip(Math.max(0, skip - PAGE_SIZE))}
                  className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600">
                  Page {pageIndex} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={skip + PAGE_SIZE >= total}
                  onClick={() => setSkip(skip + PAGE_SIZE)}
                  className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CaptureList;