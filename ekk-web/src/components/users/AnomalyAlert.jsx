import { useState } from 'react';
import { AlertCircle, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

export default function AnomalyAlert({ findings = [] }) {
  const [open, setOpen] = useState(findings.length <= 3);
  if (!findings.length) return null;

  const hasErrors = findings.some((f) => f.severity === 'error');
  const count = findings.length;

  return (
    <div className={`rounded-lg border p-3 ${hasErrors ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {hasErrors
            ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          }
          <p className={`text-sm font-medium ${hasErrors ? 'text-red-800' : 'text-amber-800'}`}>
            {hasErrors
              ? `${count} issue(s) must be resolved before saving`
              : `${count} unusual combination(s) detected — you can still save`
            }
          </p>
        </div>
        <button type="button" onClick={() => setOpen((o) => !o)} className="text-gray-400 hover:text-gray-600">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>
      {open && (
        <ul className="mt-2 space-y-1 pl-6">
          {findings.map((f, i) => (
            <li key={i} className={`text-xs ${f.severity === 'error' ? 'text-red-700' : 'text-amber-700'}`}>
              • {f.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
