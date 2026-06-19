import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useWizardStore } from '../../../store/wizardStore';
import { validatePermissions } from '../../../services/apiService';
import AnomalyAlert from '../../../components/users/AnomalyAlert';
import CrudToggle from '../../../components/users/CrudToggle';

const AUTO_FULL_TYPES = ['SUPER_ADMIN', 'SUPER ADMIN', 'SITE_ADMIN'];

// Fallback forms per module when API not ready
function getFallbackForms(moduleId) {
  const map = {
    capture:   [{ id: 'capture.create', name: 'Create Entry' }, { id: 'capture.edit', name: 'Edit Entry' }],
    approvals: [{ id: 'approvals.approve', name: 'Approve/Reject Entries', hasApprove: true }],
    users:     [{ id: 'user_mgmt.create', name: 'Create User' }, { id: 'user_mgmt.view', name: 'View Users' }, { id: 'user_mgmt.edit', name: 'Edit User' }],
    report:    [{ id: 'report.view', name: 'View Reports' }, { id: 'report.export', name: 'Export Reports' }],
  };
  return map[moduleId] || [{ id: `${moduleId}.view`, name: `View ${moduleId}` }];
}

export default function Step4FormRights() {
  const { data, updateStep4 } = useWizardStore();
  const userType = data.user_type;
  const moduleIds = data.module_ids || [];
  const isAuto = AUTO_FULL_TYPES.includes(userType);

  const [rights, setRights]       = useState(() => {
    const map = {};
    (data.form_rights || []).forEach((r) => { map[r.form_id] = r; });
    return map;
  });
  const [expanded, setExpanded]   = useState({});
  const [findings, setFindings]   = useState(data.anomaly_findings || []);
  const anomalyTimer = useRef(null);

  function toggle(moduleId) {
    setExpanded((e) => ({ ...e, [moduleId]: !e[moduleId] }));
  }

  function handleChange(formId, val) {
    const next = { ...rights, [formId]: { form_id: formId, ...val } };
    setRights(next);
    updateStep4(Object.values(next), findings);
    // Debounced anomaly check
    clearTimeout(anomalyTimer.current);
    anomalyTimer.current = setTimeout(async () => {
      try {
        const res = await validatePermissions({
          user_type: userType,
          form_rights: Object.values(next),
        });
        setFindings(res.findings || []);
        updateStep4(Object.values(next), res.findings || []);
      } catch {}
    }, 600);
  }

  function bulkSet(moduleId, forms, mode) {
    const next = { ...rights };
    forms.forEach((f) => {
      if (mode === 'crud') next[f.id] = { form_id: f.id, form_name: f.name, can_create: true, can_read: true, can_update: true, can_delete: true };
      if (mode === 'read') next[f.id] = { form_id: f.id, form_name: f.name, can_create: false, can_read: true, can_update: false, can_delete: false };
      if (mode === 'none') next[f.id] = { form_id: f.id, form_name: f.name, can_create: false, can_read: false, can_update: false, can_delete: false };
    });
    setRights(next);
    updateStep4(Object.values(next), findings);
  }

  const modulesWithForms = moduleIds.map((id) => ({
    id,
    name: id.charAt(0).toUpperCase() + id.slice(1),
    forms: getFallbackForms(id),
  }));

  const findingMap = {};
  findings.forEach((f) => { findingMap[f.field] = f; });

  if (isAuto) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
        <p className="text-sm font-medium text-gray-700">Full access to all forms automatically granted.</p>
        <p className="mt-1 text-xs text-gray-500">No form rights selection needed — click Next to continue.</p>
      </div>
    );
  }

  if (moduleIds.length === 0) {
    return <p className="text-sm text-gray-500">No modules selected. Go back to Step 3 and select at least one module.</p>;
  }

  return (
    <div className="space-y-3">
      <AnomalyAlert findings={findings} />
      {modulesWithForms.map((mod) => (
        <div key={mod.id} className="rounded-lg border border-gray-200 bg-white">
          <div className="flex items-center justify-between px-4 py-3">
            <button type="button" onClick={() => toggle(mod.id)}
              className="flex items-center gap-2 text-sm font-semibold text-gray-800">
              {expanded[mod.id] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {mod.name}
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{mod.forms.length} forms</span>
            </button>
            <div className="flex gap-2 text-xs">
              <button type="button" onClick={() => bulkSet(mod.id, mod.forms, 'crud')} className="text-primary-600 hover:underline">All CRUD</button>
              <button type="button" onClick={() => bulkSet(mod.id, mod.forms, 'read')} className="text-gray-500 hover:underline">Read only</button>
              <button type="button" onClick={() => bulkSet(mod.id, mod.forms, 'none')} className="text-gray-400 hover:underline">None</button>
            </div>
          </div>
          {expanded[mod.id] && (
            <div className="border-t border-gray-100 px-4 pb-3">
              <table className="w-full">
                <thead>
                  <tr className="text-center text-xs font-medium uppercase tracking-wide text-gray-400">
                    <th className="py-2 text-left">Form</th>
                    <th className="px-1">C</th><th className="px-1">R</th>
                    <th className="px-1">U</th><th className="px-1">D</th>
                    {mod.forms.some(f => f.hasApprove) && <th className="px-1 text-green-600">A</th>}
                    <th className="px-1 w-6" />
                  </tr>
                </thead>
                <tbody>
                  {mod.forms.map((f) => (
                    <CrudToggle key={f.id}
                      formId={f.id} formName={f.name}
                      value={rights[f.id] || { can_create: false, can_read: false, can_update: false, can_delete: false }}
                      onChange={handleChange}
                      anomaly={findingMap[f.id] || null}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
