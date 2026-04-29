import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { approveCapture, listPending, rejectCapture } from '../services/apiService';
import LoadingSpinner from '../components/LoadingSpinner';
import useProjectSession from '../hooks/useProjectSession';

const PendingApprovals = () => {
  const navigate = useNavigate();
  const { selectedProjectId, selectedProject, user } = useProjectSession();

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  const [approveTarget, setApproveTarget] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);

  const [approvedBy, setApprovedBy] = useState(user?.username || user?.email || '');
  const [reason, setReason] = useState('');

  const fetchPendingEntries = async () => {
    setLoading(true);
    try {
      const data = await listPending(selectedProjectId || undefined);
      setEntries(data.entries || []);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingEntries();
  }, [selectedProjectId]);

  const handleApprove = async () => {
    if (!approveTarget) {
      return;
    }

    if (!approvedBy.trim()) {
      toast.error('Approved By is required');
      return;
    }

    setProcessingId(approveTarget.id);
    try {
      await approveCapture(approveTarget.id, approvedBy.trim());
      toast.success('Entry approved successfully');
      setApproveTarget(null);
      await fetchPendingEntries();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Something went wrong');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) {
      return;
    }

    if (!reason.trim()) {
      toast.error('Rejection reason is required');
      return;
    }

    setProcessingId(rejectTarget.id);
    try {
      await rejectCapture(rejectTarget.id, reason.trim());
      toast.success('Entry rejected successfully');
      setRejectTarget(null);
      setReason('');
      await fetchPendingEntries();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Something went wrong');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading pending approvals..." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pending Approvals</h1>
          {selectedProject && <p className="text-sm text-gray-500">{selectedProject.project_code} - {selectedProject.name}</p>}
        </div>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800">
          {entries.length} entries awaiting approval
        </span>
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm">
        {entries.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">No entries pending approval.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-600">
                  <th className="px-3 py-2">Activity Code</th>
                  <th className="px-3 py-2">Stage</th>
                  <th className="px-3 py-2">Chainage</th>
                  <th className="px-3 py-2">Qty (LM)</th>
                  <th className="px-3 py-2">Contractor</th>
                  <th className="px-3 py-2">RFI No</th>
                  <th className="px-3 py-2">Submitted Date</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => (
                  <tr key={entry.id} className={index % 2 === 1 ? 'bg-gray-50' : 'bg-white'}>
                    <td className="px-3 py-3">{entry.activity_code}</td>
                    <td className="px-3 py-3">{entry.stage}</td>
                    <td className="px-3 py-3">
                      {entry.chainage_from} → {entry.chainage_to}
                    </td>
                    <td className="px-3 py-3">{entry.quantity_lm}</td>
                    <td className="px-3 py-3">{entry.contractor_name}</td>
                    <td className="px-3 py-3">{entry.rfi_number}</td>
                    <td className="px-3 py-3">{new Date(entry.created_at).toLocaleString()}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => navigate(`/captures/${entry.id}`)}
                          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setApprovedBy(user?.username || user?.email || '');
                            setApproveTarget(entry);
                          }}
                          className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-green-700"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setReason('');
                            setRejectTarget(entry);
                          }}
                          className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-amber-600"
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {approveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900">Approve Entry</h3>
            <p className="mt-1 text-sm text-gray-600">Enter approver name to continue.</p>

            <input
              type="text"
              value={approvedBy}
              onChange={(e) => setApprovedBy(e.target.value)}
              className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              placeholder="Approved by"
            />

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setApproveTarget(null)}
                className="rounded-lg bg-gray-100 px-4 py-2 font-medium text-gray-700 transition hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={processingId === approveTarget.id}
                onClick={handleApprove}
                className="rounded-lg bg-green-600 px-4 py-2 font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {processingId === approveTarget.id ? 'Approving...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900">Reject Entry</h3>
            <p className="mt-1 text-sm text-gray-600">Provide a rejection reason.</p>

            <textarea
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              placeholder="Reason"
            />

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setRejectTarget(null)}
                className="rounded-lg bg-gray-100 px-4 py-2 font-medium text-gray-700 transition hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={processingId === rejectTarget.id}
                onClick={handleReject}
                className="rounded-lg bg-amber-500 px-4 py-2 font-medium text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {processingId === rejectTarget.id ? 'Rejecting...' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PendingApprovals;