import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  approveCapture,
  deleteCapture,
  getCapture,
  getProject,
  listEntryMedia,
  rejectCapture,
} from '../services/apiService';
import ConfirmModal from '../components/ConfirmModal';
import LoadingSpinner from '../components/LoadingSpinner';
import StatusBadge from '../components/StatusBadge';

const fieldRowClass = 'rounded-lg border border-gray-200 bg-gray-50 p-3';
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const EntryDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  const [entry, setEntry] = useState(null);
  const [projectName, setProjectName] = useState('-');
  const [mediaItems, setMediaItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);

  const [approvedBy, setApprovedBy] = useState(localStorage.getItem('username') || '');
  const [rejectReason, setRejectReason] = useState('');

  const isPending = useMemo(() => entry && !entry.approved && !entry.rejected, [entry]);
  const isApproved = useMemo(() => entry?.approved, [entry]);
  const isRejected = useMemo(() => entry?.rejected, [entry]);

  const fetchEntry = async () => {
    setLoading(true);
    try {
      const data = await getCapture(id);
      setEntry(data);

      try {
        const [project, media] = await Promise.all([
          getProject(data.project_id),
          listEntryMedia(id),
        ]);
        setProjectName(project?.name || '-');
        setMediaItems(Array.isArray(media) ? media : []);
      } catch {
        setProjectName('-');
        setMediaItems([]);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntry();
  }, [id]);

  const handleDelete = async () => {
    setProcessing(true);
    try {
      await deleteCapture(id);
      toast.success('Entry deleted successfully');
      navigate('/captures');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Something went wrong');
    } finally {
      setProcessing(false);
      setShowDeleteModal(false);
    }
  };

  const handleApprove = async () => {
    if (!approvedBy.trim()) {
      toast.error('Approved By is required');
      return;
    }

    setProcessing(true);
    try {
      await approveCapture(id, approvedBy.trim());
      toast.success('Entry approved successfully');
      setShowApproveModal(false);
      await fetchEntry();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Something went wrong');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error('Rejection reason is required');
      return;
    }

    setProcessing(true);
    try {
      await rejectCapture(id, rejectReason.trim());
      toast.success('Entry rejected successfully');
      setShowRejectModal(false);
      setRejectReason('');
      await fetchEntry();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Something went wrong');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading entry..." />;
  }

  if (!entry) {
    return (
      <div className="rounded-xl bg-white p-6 text-center shadow-sm">
        <p className="text-gray-600">Entry not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-gray-900">Entry Detail</h1>
          <StatusBadge approved={entry.approved} rejected={entry.rejected} />
        </div>

        {isPending && (
          <div className="mb-4 rounded-lg bg-amber-100 px-4 py-3 text-sm font-medium text-amber-800">
            Awaiting Approval
          </div>
        )}

        {isApproved && (
          <div className="mb-4 rounded-lg bg-green-100 px-4 py-3 text-sm font-medium text-green-800">
            Approved by {entry.approved_by || 'Unknown'} on{' '}
            {entry.approved_at ? new Date(entry.approved_at).toLocaleString() : '-'}
          </div>
        )}

        {isRejected && (
          <div className="mb-4 rounded-lg bg-red-100 px-4 py-3 text-sm font-medium text-red-800">
            Rejected: {entry.reject_reason || 'No reason provided'}
          </div>
        )}

        {/* ── Core classification ── */}
        <h2 className="mb-2 mt-1 text-sm font-semibold uppercase tracking-wide text-gray-500">Classification</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className={fieldRowClass}><p className="text-xs text-gray-500">Project</p><p className="text-sm font-medium text-gray-900">{projectName}</p></div>
          <div className={fieldRowClass}><p className="text-xs text-gray-500">Source</p><p className="text-sm text-gray-900">{entry.source || '-'}</p></div>
          <div className={fieldRowClass}><p className="text-xs text-gray-500">Work Type</p><p className="text-sm text-gray-900">{entry.work_type || '-'}</p></div>
          <div className={fieldRowClass}><p className="text-xs text-gray-500">Activity Code</p><p className="text-sm text-gray-900">{entry.activity_code || '-'}</p></div>
          <div className={fieldRowClass}><p className="text-xs text-gray-500">Stage / Layer</p><p className="text-sm text-gray-900">{entry.stage || '-'}</p></div>
          <div className={fieldRowClass}><p className="text-xs text-gray-500">Layer Code</p><p className="text-sm text-gray-900">{entry.layer_code || '-'}</p></div>
          <div className={fieldRowClass}><p className="text-xs text-gray-500">Element</p><p className="text-sm text-gray-900">{entry.element_code || '-'}</p></div>
          <div className={fieldRowClass}><p className="text-xs text-gray-500">Structure Type</p><p className="text-sm text-gray-900">{entry.structure_type || '-'}</p></div>
        </div>

        {/* ── Location ── */}
        <h2 className="mb-2 mt-4 text-sm font-semibold uppercase tracking-wide text-gray-500">Location</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className={fieldRowClass}><p className="text-xs text-gray-500">Chainage From</p><p className="text-sm text-gray-900">{entry.chainage_from ?? '-'}</p></div>
          <div className={fieldRowClass}><p className="text-xs text-gray-500">Chainage To</p><p className="text-sm text-gray-900">{entry.chainage_to ?? '-'}</p></div>
          <div className={fieldRowClass}><p className="text-xs text-gray-500">Road Side</p><p className="text-sm text-gray-900">{entry.road_side || '-'}</p></div>
          <div className={fieldRowClass}><p className="text-xs text-gray-500">Layer Section</p><p className="text-sm text-gray-900">{entry.layer_section || '-'}</p></div>
          {entry.gps_start_lat && (
            <div className={fieldRowClass}><p className="text-xs text-gray-500">GPS Start</p><p className="text-sm text-gray-900">{entry.gps_start_lat}, {entry.gps_start_lng}</p></div>
          )}
          {entry.gps_end_lat && (
            <div className={fieldRowClass}><p className="text-xs text-gray-500">GPS End</p><p className="text-sm text-gray-900">{entry.gps_end_lat}, {entry.gps_end_lng}</p></div>
          )}
        </div>

        {/* ── Quantity & Dimensions ── */}
        <h2 className="mb-2 mt-4 text-sm font-semibold uppercase tracking-wide text-gray-500">Quantity & Dimensions</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className={fieldRowClass}><p className="text-xs text-gray-500">Quantity (LM)</p><p className="text-sm text-gray-900">{entry.quantity_lm ?? '-'}</p></div>
          <div className={fieldRowClass}><p className="text-xs text-gray-500">Quantity</p><p className="text-sm text-gray-900">{entry.quantity != null ? `${entry.quantity} ${entry.unit || ''}` : '-'}</p></div>
          <div className={fieldRowClass}><p className="text-xs text-gray-500">Length (m)</p><p className="text-sm text-gray-900">{entry.length_m ?? '-'}</p></div>
          <div className={fieldRowClass}><p className="text-xs text-gray-500">Width (m)</p><p className="text-sm text-gray-900">{entry.width_m ?? '-'}</p></div>
          <div className={fieldRowClass}><p className="text-xs text-gray-500">Depth (m)</p><p className="text-sm text-gray-900">{entry.depth_m ?? '-'}</p></div>
          <div className={fieldRowClass}><p className="text-xs text-gray-500">Thickness (mm)</p><p className="text-sm text-gray-900">{entry.thickness_mm ?? '-'}</p></div>
        </div>

        {/* ── Site details ── */}
        <h2 className="mb-2 mt-4 text-sm font-semibold uppercase tracking-wide text-gray-500">Site Details</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className={fieldRowClass}><p className="text-xs text-gray-500">Contractor</p><p className="text-sm text-gray-900">{entry.contractor_name || '-'}</p></div>
          <div className={fieldRowClass}><p className="text-xs text-gray-500">RFI Number</p><p className="text-sm text-gray-900">{entry.rfi_number ?? '-'}</p></div>
          <div className={fieldRowClass}><p className="text-xs text-gray-500">Weather</p><p className="text-sm text-gray-900">{entry.weather_code || '-'}</p></div>
          <div className={fieldRowClass}><p className="text-xs text-gray-500">Progress</p><p className="text-sm text-gray-900">{entry.progress_status || '-'}</p></div>
          <div className={fieldRowClass}><p className="text-xs text-gray-500">Entry Date</p><p className="text-sm text-gray-900">{entry.entry_date ? new Date(entry.entry_date).toLocaleDateString() : '-'}</p></div>
          <div className={fieldRowClass}><p className="text-xs text-gray-500">Payment Qualifies</p><p className="text-sm text-gray-900">{entry.payment_qualifies ? 'Yes' : 'No'}</p></div>
          <div className={fieldRowClass}><p className="text-xs text-gray-500">Created At</p><p className="text-sm text-gray-900">{new Date(entry.created_at).toLocaleString()}</p></div>
          {entry.remarks && (
            <div className={`${fieldRowClass} md:col-span-2`}><p className="text-xs text-gray-500">Remarks</p><p className="text-sm text-gray-900">{entry.remarks}</p></div>
          )}
        </div>

        {/* ── 3M Resources ── */}
        {(entry.materials_used?.length > 0 || entry.machines_deployed?.length > 0 || entry.manpower_deployed?.length > 0) && (
          <>
            <h2 className="mb-2 mt-4 text-sm font-semibold uppercase tracking-wide text-gray-500">3M Resources</h2>
            {entry.materials_used?.length > 0 && (
              <div className="mb-3">
                <p className="mb-1 text-xs font-semibold text-gray-600">Materials</p>
                <div className="flex flex-wrap gap-2">
                  {entry.materials_used.map((m, i) => (
                    <span key={i} className="rounded-full bg-blue-100 px-3 py-1 text-xs text-blue-800">
                      {m.material_code} {m.quantity ? `${m.quantity} ${m.unit || ''}` : ''}
                      {m.source ? ` (${m.source})` : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {entry.machines_deployed?.length > 0 && (
              <div className="mb-3">
                <p className="mb-1 text-xs font-semibold text-gray-600">Machines</p>
                <div className="flex flex-wrap gap-2">
                  {entry.machines_deployed.map((m, i) => (
                    <span key={i} className="rounded-full bg-orange-100 px-3 py-1 text-xs text-orange-800">
                      {m.machine_code} ×{m.count || 1}{m.hours ? ` — ${m.hours}h` : ''}
                      {m.operator_name ? ` (${m.operator_name})` : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {entry.manpower_deployed?.length > 0 && (
              <div className="mb-3">
                <p className="mb-1 text-xs font-semibold text-gray-600">Manpower</p>
                <div className="flex flex-wrap gap-2">
                  {entry.manpower_deployed.map((m, i) => (
                    <span key={i} className="rounded-full bg-green-100 px-3 py-1 text-xs text-green-800">
                      {m.category} ×{m.count || 1} ({m.shift_type || 'DAY'})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Voice transcript ── */}
        {entry.voice_transcript && (
          <>
            <h2 className="mb-2 mt-4 text-sm font-semibold uppercase tracking-wide text-gray-500">Voice Transcript</h2>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm italic text-gray-600">
              "{entry.voice_transcript}"
            </div>
          </>
        )}

        <div className="mt-6">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Entry Images</h2>
          {mediaItems.filter((m) => m.media_type === 'photo').length === 0 ? (
            <p className="text-sm text-gray-500">No images uploaded for this entry.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {mediaItems
                .filter((m) => m.media_type === 'photo')
                .map((m) => {
                  const src = m.url?.startsWith('http') ? m.url : `${API_BASE}${m.url}`;
                  return (
                    <a key={m.id} href={src} target="_blank" rel="noreferrer" className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                      <img src={src} alt={m.filename || 'Entry image'} className="h-32 w-full object-cover" />
                      <div className="px-2 py-1 text-xs text-gray-600">{m.filename || 'image'}</div>
                    </a>
                  );
                })}
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {(isPending || isRejected) && (
            <button
              type="button"
              onClick={() => navigate(`/captures/${id}/edit`)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              Edit
            </button>
          )}

          {isPending && (
            <button
              type="button"
              onClick={() => setShowApproveModal(true)}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700"
            >
              Approve
            </button>
          )}

          {isPending && (
            <button
              type="button"
              onClick={() => setShowRejectModal(true)}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-600"
            >
              Reject
            </button>
          )}

          {(isPending || isRejected) && (
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
            >
              Delete
            </button>
          )}

          {isApproved && (
            <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-800">
              Approved
            </span>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={showDeleteModal}
        title="Delete Entry"
        message="Are you sure you want to delete this entry? This action cannot be undone."
        onCancel={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        confirmLabel={processing ? 'Deleting...' : 'Delete'}
        confirmClassName="bg-red-600 hover:bg-red-700"
      />

      {showApproveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900">Approve Entry</h3>
            <p className="mt-1 text-sm text-gray-600">Enter approver name to confirm approval.</p>

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
                onClick={() => setShowApproveModal(false)}
                className="rounded-lg bg-gray-100 px-4 py-2 font-medium text-gray-700 transition hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={processing}
                onClick={handleApprove}
                className="rounded-lg bg-green-600 px-4 py-2 font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {processing ? 'Approving...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900">Reject Entry</h3>
            <p className="mt-1 text-sm text-gray-600">Provide a rejection reason.</p>

            <textarea
              rows={4}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              placeholder="Reason"
            />

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="rounded-lg bg-gray-100 px-4 py-2 font-medium text-gray-700 transition hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={processing}
                onClick={handleReject}
                className="rounded-lg bg-amber-500 px-4 py-2 font-medium text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {processing ? 'Rejecting...' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EntryDetail;