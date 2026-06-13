import { AlertCircle, AlertTriangle } from 'lucide-react';

const KEYS = ['can_create', 'can_read', 'can_update', 'can_delete'];
const LABELS = { can_create: 'C', can_read: 'R', can_update: 'U', can_delete: 'D' };

const on      = 'bg-blue-100 text-blue-700 font-medium ring-1 ring-blue-300';
const off     = 'bg-gray-100 text-gray-400 hover:bg-gray-200';
const onApprove  = 'bg-green-100 text-green-700 font-medium ring-1 ring-green-300';

export default function CrudToggle({ formId, formName, value, onChange, disabled, anomaly, showApprove = false }) {
  function toggle(key) {
    if (disabled) return;
    const next = { ...value };
    const newVal = !next[key];
    next[key] = newVal;

    if (key === 'can_read' && !newVal) {
      next.can_create = false;
      next.can_update = false;
      next.can_delete = false;
      next.can_approve = false;
    }
    if ((key === 'can_create' || key === 'can_update' || key === 'can_delete' || key === 'can_approve') && newVal) {
      next.can_read = true;
    }
    onChange(formId, next);
  }

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="py-2 pl-3 text-sm text-gray-800">{formName || formId}</td>
      {KEYS.map((k) => (
        <td key={k} className="px-1 py-2 text-center">
          <button
            type="button"
            onClick={() => toggle(k)}
            disabled={disabled}
            className={`h-7 w-7 rounded text-xs font-medium transition ${value?.[k] ? on : off} ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
          >
            {LABELS[k]}
          </button>
        </td>
      ))}
      {showApprove && (
        <td className="px-1 py-2 text-center">
          <button
            type="button"
            onClick={() => toggle('can_approve')}
            disabled={disabled}
            title="Approve/Reject"
            className={`h-7 w-7 rounded text-xs font-medium transition ${value?.can_approve ? onApprove : off} ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
          >
            A
          </button>
        </td>
      )}
      <td className="px-2 py-2 text-center">
        {anomaly?.severity === 'error' && (
          <span title={anomaly.message}>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </span>
        )}
        {anomaly?.severity === 'warning' && (
          <span title={anomaly.message}>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </span>
        )}
      </td>
    </tr>
  );
}
