import { X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import {
  formatChainageRange,
  getWorkTypeLabel,
  getLayerLabel,
  getEntryStatus,
  getStatusBadgeClass,
  getProgressLabel,
  getProgressColor,
  getWeatherDisplay,
  get3MSummary,
  getAgeLabel,
} from '../utils/captureUtils';

/**
 * Right-side slide-over panel showing a capture entry summary.
 *
 * Props:
 *   entry        — the capture object (or null to hide)
 *   onClose      — called when backdrop or X is clicked
 *   onOpenFull   — called when "Open full entry" is clicked
 *   footerActions — optional extra buttons rendered in the footer (e.g. Approve/Reject)
 */
const CapturePreviewPanel = ({ entry, onClose, onOpenFull, footerActions }) => {
  if (!entry) return null;

  const age       = getAgeLabel(entry.created_at);
  const weather   = getWeatherDisplay(entry.weather_code);
  const summary3M = get3MSummary(entry);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-30 bg-black/20" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 z-40 w-[380px] bg-white
                      shadow-2xl border-l border-gray-200 overflow-y-auto flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold
              ${getStatusBadgeClass(entry)}`}>
              {getEntryStatus(entry)}
            </span>
            {entry.progress_status && (
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium
                ${getProgressColor(entry.progress_status)}`}>
                {getProgressLabel(entry.progress_status)}
              </span>
            )}
            {entry.weather_code && (
              <span className="text-base">{weather.icon}</span>
            )}
            {entry.created_at && (
              <span className={`text-xs font-medium ${age.colorClass}`}>
                {age.label}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 p-4 space-y-4">

          {/* Classification */}
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
              Classification
            </p>
            <p className="text-lg font-semibold text-gray-900">
              {entry.activity_code || '—'}
            </p>
            <p className="text-sm text-gray-500">
              {getWorkTypeLabel(entry.work_type)}
              {entry.layer_code && ` · ${getLayerLabel(entry.layer_code)}`}
              {!entry.layer_code && entry.stage && ` · ${entry.stage}`}
            </p>
          </div>

          {/* Chainage */}
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
              Chainage
            </p>
            <p className="text-base font-mono font-semibold text-gray-900">
              {formatChainageRange(entry.chainage_from, entry.chainage_to)}
            </p>
            {entry.road_side && (
              <p className="text-xs text-gray-500 mt-0.5">Side: {entry.road_side}</p>
            )}
          </div>

          {/* Quantity */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-400 mb-1">Quantity (LM)</p>
              <p className="text-lg font-bold text-gray-900">{entry.quantity_lm ?? '—'}</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-400 mb-1">
                L × W × D{entry.count > 1 ? ' × Count' : ''}
              </p>
              <p className="text-sm font-medium text-gray-700">
                {[entry.length_m, entry.width_m, entry.depth_m].map(v => v ?? '—').join(' × ')}
                {entry.count > 1 ? ` × ${entry.count}` : ''}
              </p>
            </div>
          </div>

          {/* Site details */}
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
              Site details
            </p>
            <div className="space-y-1.5">
              {[
                ['Contractor',  entry.contractor_name],
                ['RFI No',      entry.rfi_number],
                ['Entered by',  entry.entered_by],
                ['Entry date',  entry.entry_date
                  ? format(parseISO(entry.entry_date), 'dd MMM yyyy')
                  : null],
                ['Payment',     entry.payment_qualifies ? '✓ Qualifies' : null],
              ].filter(([, v]) => v != null && v !== '').map(([label, value]) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-gray-500">{label}</span>
                  <span className="text-gray-900 font-medium">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 3M summary */}
          {summary3M && (
            <div className="rounded-lg border border-dashed border-gray-200 p-3">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
                3M Resources
              </p>
              <p className="text-sm text-gray-700">{summary3M}</p>
            </div>
          )}

          {/* Voice transcript badge */}
          {entry.voice_transcript && (
            <div className="flex items-center gap-2 rounded-lg bg-violet-50 px-3 py-2">
              <span className="text-xs font-medium text-violet-700">🎤 AI transcribed entry</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 flex flex-col gap-2">
          <button
            onClick={onOpenFull}
            className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium
                       text-gray-700 hover:bg-gray-50 transition"
          >
            Open full entry
          </button>
          {footerActions && (
            <div className="flex gap-2">
              {footerActions}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default CapturePreviewPanel;
