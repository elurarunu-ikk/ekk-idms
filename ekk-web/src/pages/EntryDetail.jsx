import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { formatChainage } from '../utils/captureUtils';
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
  const [lightboxIndex, setLightboxIndex] = useState(null);

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
            Rejected by {entry.rejected_by || 'Unknown'}: {entry.reject_reason || 'No reason provided'}
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
          <div className={fieldRowClass}><p className="text-xs text-gray-500">Chainage From</p><p className="text-sm font-mono text-gray-900">{formatChainage(entry.chainage_from)}</p></div>
          <div className={fieldRowClass}><p className="text-xs text-gray-500">Chainage To</p><p className="text-sm font-mono text-gray-900">{formatChainage(entry.chainage_to)}</p></div>
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
          <div className={fieldRowClass}><p className="text-xs text-gray-500">Entered By</p><p className="text-sm text-gray-900">{entry.entered_by || '-'}</p></div>
          <div className={fieldRowClass}><p className="text-xs text-gray-500">Created At</p><p className="text-sm text-gray-900">{new Date(entry.created_at).toLocaleString()}</p></div>
          {entry.remarks && (
            <div className={`${fieldRowClass} md:col-span-2`}><p className="text-xs text-gray-500">Remarks</p><p className="text-sm text-gray-900">{entry.remarks}</p></div>
          )}
        </div>

        {/* ── 3M Resources ── */}
        <h2 className="mb-3 mt-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          3M Resources — Materials / Machines / Manpower
        </h2>

        {/* Materials */}
        <div className="mb-4">
          <p className="mb-2 text-xs font-bold text-blue-700 uppercase tracking-wide">Materials Used</p>
          {entry.materials_used?.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-blue-100">
              <table className="min-w-full text-sm">
                <thead className="bg-blue-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-blue-700">Material</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-blue-700">Quantity</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-blue-700">Unit</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-blue-700">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-50 bg-white">
                  {entry.materials_used.map((m, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2 font-medium text-gray-900">{m.material_code || m.material_name || '-'}</td>
                      <td className="px-4 py-2 text-gray-700">{m.quantity ?? '-'}</td>
                      <td className="px-4 py-2 text-gray-700">{m.unit || '-'}</td>
                      <td className="px-4 py-2 text-gray-500">{m.source || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-blue-200 px-4 py-3 text-sm text-gray-400">No materials recorded</p>
          )}
        </div>

        {/* Machines */}
        <div className="mb-4">
          <p className="mb-2 text-xs font-bold text-orange-700 uppercase tracking-wide">Machines Deployed</p>
          {entry.machines_deployed?.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-orange-100">
              <table className="min-w-full text-sm">
                <thead className="bg-orange-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-orange-700">Machine</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-orange-700">Count</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-orange-700">Hours</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-orange-700">Operator</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-orange-50 bg-white">
                  {entry.machines_deployed.map((m, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2 font-medium text-gray-900">{m.machine_code || m.machine_name || '-'}</td>
                      <td className="px-4 py-2 text-gray-700">{m.count ?? 1}</td>
                      <td className="px-4 py-2 text-gray-700">{m.hours != null ? `${m.hours} hrs` : '-'}</td>
                      <td className="px-4 py-2 text-gray-500">{m.operator_name || m.operator || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-orange-200 px-4 py-3 text-sm text-gray-400">No machines recorded</p>
          )}
        </div>

        {/* Manpower */}
        <div className="mb-4">
          <p className="mb-2 text-xs font-bold text-green-700 uppercase tracking-wide">Manpower Deployed</p>
          {entry.manpower_deployed?.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-green-100">
              <table className="min-w-full text-sm">
                <thead className="bg-green-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-green-700">Category</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-green-700">Count</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-green-700">Shift</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-green-700">Hours</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-green-50 bg-white">
                  {entry.manpower_deployed.map((m, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2 font-medium text-gray-900">{m.category || '-'}</td>
                      <td className="px-4 py-2 text-gray-700">{m.count ?? '-'}</td>
                      <td className="px-4 py-2 text-gray-700">{m.shift_type || 'DAY'}</td>
                      <td className="px-4 py-2 text-gray-500">{m.shift_hours != null ? `${m.shift_hours} hrs` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-green-200 px-4 py-3 text-sm text-gray-400">No manpower recorded</p>
          )}
        </div>

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
          {(() => {
            const photos = mediaItems.filter((m) => m.media_type === 'photo');
            const videos = mediaItems.filter((m) => m.media_type === 'video');
            if (photos.length === 0 && videos.length === 0) {
              return <p className="text-sm text-gray-500">No media uploaded for this entry.</p>;
            }
            return (
              <>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {photos.map((m, i) => {
                    const src = m.url?.startsWith('http') ? m.url : `${API_BASE}${m.url}`;
                    return (
                      <div key={m.id} className="overflow-hidden rounded-lg border border-gray-200 bg-white cursor-pointer"
                        onClick={() => setLightboxIndex(i)}>
                        <img
                          src={src}
                          alt={m.filename || 'Entry image'}
                          className="h-32 w-full object-cover hover:opacity-90 transition"
                        />
                        <div className="px-2 py-1 text-xs text-gray-600">{m.filename || 'image'}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Video section */}
                {videos.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                      Videos ({videos.length})
                    </p>
                    <div className="space-y-3">
                      {videos.map((m, i) => {
                        const src = m.url?.startsWith('http') ? m.url : `${API_BASE}${m.url}`;
                        return (
                          <div key={i} className="rounded-lg overflow-hidden border border-gray-200">
                            <video
                              controls
                              preload="metadata"
                              className="w-full max-h-64 bg-black"
                              src={src}
                            >
                              Your browser does not support video playback.
                            </video>
                            <div className="px-2 py-1 text-xs text-gray-600 flex justify-between">
                              <span>{m.filename || 'video'}</span>
                              <span>{m.size_mb ? `${m.size_mb.toFixed(1)} MB` : ''}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Lightbox */}
                {lightboxIndex !== null && (
                  <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
                    onClick={() => setLightboxIndex(null)}
                  >
                    <button
                      className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10
                                 p-3 text-white hover:bg-white/20 transition"
                      onClick={e => { e.stopPropagation(); setLightboxIndex(i => Math.max(0, i - 1)); }}
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                    <img
                      src={photos[lightboxIndex]?.url?.startsWith('http')
                        ? photos[lightboxIndex].url
                        : `${API_BASE}${photos[lightboxIndex]?.url}`}
                      alt="Full size"
                      className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
                      onClick={e => e.stopPropagation()}
                    />
                    <button
                      className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10
                                 p-3 text-white hover:bg-white/20 transition"
                      onClick={e => { e.stopPropagation(); setLightboxIndex(i => Math.min(photos.length - 1, i + 1)); }}
                    >
                      <ChevronRight className="w-6 h-6" />
                    </button>
                    <button
                      className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
                      onClick={() => setLightboxIndex(null)}
                    >
                      <X className="w-5 h-5" />
                    </button>
                    <div className="absolute bottom-4 text-white text-sm">
                      {lightboxIndex + 1} / {photos.length}
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>

        {/* Sticky action bar */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-3
                        flex items-center gap-2 flex-wrap mt-4 -mx-6 -mb-6 rounded-b-xl">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2
                       text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="flex-1" />
          {(isPending || isRejected) && (
            <button
              type="button"
              onClick={() => navigate(`/captures/${id}/edit`)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium
                         text-gray-700 hover:bg-gray-50 transition"
            >
              Edit
            </button>
          )}
          {isPending && (
            <button
              type="button"
              onClick={() => setShowApproveModal(true)}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white
                         hover:bg-green-700 transition"
            >
              ✓ Approve
            </button>
          )}
          {isPending && (
            <button
              type="button"
              onClick={() => setShowRejectModal(true)}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white
                         hover:bg-amber-600 transition"
            >
              ✕ Reject
            </button>
          )}
          {(isPending || isRejected) && (
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white
                         hover:bg-red-700 transition"
            >
              Delete
            </button>
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

      <ConfirmModal
        isOpen={showApproveModal}
        title="Approve entry?"
        message={`Approved by: ${approvedBy || localStorage.getItem('username') || 'Unknown'}`}
        onConfirm={handleApprove}
        onCancel={() => setShowApproveModal(false)}
        confirmLabel={processing ? 'Approving...' : 'Approve'}
        confirmClassName="bg-green-600 hover:bg-green-700"
      />

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