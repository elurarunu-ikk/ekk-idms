import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart2, Camera, CheckSquare, ChevronDown, ChevronUp,
  Compass, Database, FileText, Home, Layers, Map,
  MessageSquare, Settings, Upload, Users,
} from 'lucide-react';
import { useWizardStore } from '../../../store/wizardStore';
import { listActiveProjects, listModules } from '../../../services/apiService';
import LoadingSpinner from '../../../components/LoadingSpinner';

// ── Constants ────────────────────────────────────────────────────────────────

const MODULE_ICONS = {
  dashboard: Home, capture: Camera, entries: FileText,
  approvals: CheckSquare, report: BarChart2, chat: MessageSquare,
  projects: Compass, users: Users, companies: Layers,
  resources: Settings, masters: Database, gradesheet: Upload, refdata: Map,
};

const FALLBACK_MODULES = [
  { id: 'dashboard',  name: 'Dashboard',       description: 'Overview and KPIs' },
  { id: 'capture',    name: 'Capture',          description: 'Field data entry' },
  { id: 'entries',    name: 'Entries',          description: 'View and manage entries' },
  { id: 'approvals',  name: 'Approvals',        description: 'Approve/reject entries' },
  { id: 'report',     name: 'Reports',          description: 'Analytics and reports' },
  { id: 'chat',       name: 'AI Chat',          description: 'AI project assistant' },
  { id: 'projects',   name: 'Projects',         description: 'Project management' },
  { id: 'users',      name: 'User Management',  description: 'Manage users and access' },
  { id: 'companies',  name: 'Companies',        description: 'Company master data' },
  { id: 'resources',  name: 'Resources',        description: '3M resource masters' },
  { id: 'masters',    name: 'Masters',          description: 'Work types, layers, activities' },
  { id: 'gradesheet', name: 'Grade Sheet',      description: 'Level register import' },
  { id: 'refdata',    name: 'Reference Data',   description: 'OGL and reference data' },
];

const ACTIONS = ['view', 'add', 'edit', 'delete', 'approve'];
const ACTION_LABELS = { view: 'View', add: 'Create', edit: 'Edit', delete: 'Delete', approve: 'Approve' };

function emptyRights() {
  return { view: false, add: false, edit: false, delete: false, approve: false };
}

// ── Sub-components ───────────────────────────────────────────────────────────

function ModulePicker({ selected, onChange, modules }) {
  function toggle(id) {
    onChange(selected.includes(id) ? selected.filter((m) => m !== id) : [...selected, id]);
  }
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs text-gray-500">{selected.length} of {modules.length} selected</span>
        <div className="flex gap-3 text-xs">
          <button type="button" onClick={() => onChange(modules.map((m) => m.id))} className="text-primary-600 hover:underline">All</button>
          <button type="button" onClick={() => onChange([])} className="text-gray-400 hover:underline">None</button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {modules.map((mod) => {
          const Icon = MODULE_ICONS[mod.id] || Settings;
          const isSelected = selected.includes(mod.id);
          return (
            <button key={mod.id} type="button" onClick={() => toggle(mod.id)}
              className={`relative rounded-lg border-2 p-3 text-left transition
                ${isSelected ? 'border-primary-500 bg-primary-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
            >
              {isSelected && (
                <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary-500 text-white text-xs">✓</span>
              )}
              <Icon className={`mb-1 h-4 w-4 ${isSelected ? 'text-primary-600' : 'text-gray-400'}`} />
              <p className={`text-xs font-semibold ${isSelected ? 'text-primary-700' : 'text-gray-800'}`}>{mod.name}</p>
              {mod.description && <p className="mt-0.5 text-xs text-gray-400 leading-tight">{mod.description}</p>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ModuleRightsGrid({ moduleIds, modules, rights, onChange }) {
  const moduleMap = Object.fromEntries(modules.map((m) => [m.id, m]));

  function toggle(moduleId, action) {
    const current = rights[moduleId] || emptyRights();
    const newVal = !current[action];
    const next = { ...current, [action]: newVal };
    if (action === 'view' && !newVal) {
      next.add = false; next.edit = false; next.delete = false; next.approve = false;
    }
    if (action !== 'view' && newVal) {
      next.view = true;
    }
    onChange(moduleId, next);
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="py-2 pl-4 pr-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Module</th>
            {ACTIONS.map((a) => (
              <th key={a} className="px-3 py-2 text-center text-xs font-medium uppercase tracking-wide text-gray-500">
                {ACTION_LABELS[a]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {moduleIds.map((mid) => {
            const r = rights[mid] || emptyRights();
            return (
              <tr key={mid} className="hover:bg-gray-50">
                <td className="py-2.5 pl-4 pr-3 font-medium text-gray-800">
                  {moduleMap[mid]?.name || mid}
                </td>
                {ACTIONS.map((action) => (
                  <td key={action} className="px-3 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={r[action]}
                      onChange={() => toggle(mid, action)}
                      className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SitePicker({ allSites, selected, onChange }) {
  function toggle(id) {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  }
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700">Select sites <span className="ml-1 rounded-full bg-primary-100 px-2 py-0.5 text-xs text-primary-700">{selected.length}</span></p>
        <div className="flex gap-3 text-xs">
          <button type="button" onClick={() => onChange(allSites.map((s) => s.id))} className="text-primary-600 hover:underline">All</button>
          <button type="button" onClick={() => onChange([])} className="text-gray-400 hover:underline">None</button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {allSites.map((site) => {
          const isSelected = selected.includes(site.id);
          return (
            <label key={site.id}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border-2 px-3 py-2.5 transition
                ${isSelected ? 'border-primary-500 bg-primary-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
            >
              <input type="checkbox" checked={isSelected} onChange={() => toggle(site.id)}
                className="h-4 w-4 rounded text-primary-600" />
              <div>
                <p className={`text-xs font-semibold ${isSelected ? 'text-primary-700' : 'text-gray-800'}`}>
                  {site.project_code || site.name}
                </p>
                {site.project_code && (
                  <p className="text-xs text-gray-400 leading-tight">{site.name}</p>
                )}
              </div>
            </label>
          );
        })}
      </div>
      {allSites.length === 0 && (
        <p className="text-sm text-gray-400">No active sites found.</p>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function Step2AccessConfig() {
  const { data, updateAccess } = useWizardStore();
  const userType = data.user_type || 'USER';

  const isSuper  = ['SUPER_ADMIN', 'SUPER ADMIN'].includes(userType);
  const isGlobal = ['ADMIN', 'HO_USER'].includes(userType);
  const showFormRights = ['HO_USER', 'USER'].includes(userType);

  const { data: apiModules, isLoading: modulesLoading } = useQuery({
    queryKey: ['modules'],
    queryFn: listModules,
    retry: false,
  });
  const modules = (apiModules?.items || apiModules) || FALLBACK_MODULES;

  const { data: allSitesRaw, isLoading: sitesLoading } = useQuery({
    queryKey: ['active-projects'],
    queryFn: () => listActiveProjects().then((r) => (Array.isArray(r) ? r : r.items || [])),
    enabled: !isGlobal && !isSuper,
  });
  const allSites = allSitesRaw || [];

  // ── Local state ─────────────────────────────────────────────────────────────
  // Seed from store; for global module_ids also check legacy role-suggestion pre-fill
  const [globalModuleIds, setGlobalModuleIds] = useState(
    () => data.access_global_module_ids?.length > 0 ? data.access_global_module_ids : (data.module_ids || [])
  );
  const [globalRights, setGlobalRights] = useState(() => data.access_global_rights || {});
  const [siteIds, setSiteIds] = useState(() => data.access_site_ids || []);
  const [siteConfigs, setSiteConfigs] = useState(() => data.access_site_configs || {});
  const [expandedSite, setExpandedSite] = useState(() => (data.access_site_ids || [])[0] || null);

  // ── Sync to store ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isGlobal) {
      updateAccess({ access_global_module_ids: globalModuleIds, access_global_rights: globalRights });
    } else if (!isSuper) {
      updateAccess({ access_site_ids: siteIds, access_site_configs: siteConfigs });
    }
  }, [globalModuleIds, globalRights, siteIds, siteConfigs]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── SUPER_ADMIN ──────────────────────────────────────────────────────────────
  if (isSuper) {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-5 py-6">
        <p className="font-semibold text-yellow-800">Super Admin has unrestricted access to all sites, modules, and forms.</p>
        <p className="mt-1 text-sm text-yellow-700">No further configuration is needed. Click Review to continue.</p>
      </div>
    );
  }

  if (modulesLoading || (!isGlobal && sitesLoading)) return <LoadingSpinner message="Loading…" />;

  // ── ADMIN / HO_USER ──────────────────────────────────────────────────────────
  if (isGlobal) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
          <p className="text-sm font-medium text-blue-800">
            {userType === 'ADMIN' ? 'Admin' : 'HO User'} has access to all active sites.
            Configure which modules are accessible.
          </p>
        </div>

        <div>
          <p className="mb-3 text-sm font-semibold text-gray-700">Select modules</p>
          <ModulePicker selected={globalModuleIds} onChange={setGlobalModuleIds} modules={modules} />
        </div>

        {showFormRights && globalModuleIds.length > 0 && (
          <div>
            <p className="mb-3 text-sm font-semibold text-gray-700">Configure permissions per module</p>
            <ModuleRightsGrid
              moduleIds={globalModuleIds}
              modules={modules}
              rights={globalRights}
              onChange={(mid, r) => setGlobalRights((prev) => ({ ...prev, [mid]: r }))}
            />
          </div>
        )}
      </div>
    );
  }

  // ── SITE_ADMIN / USER ────────────────────────────────────────────────────────
  function handleSiteChange(newSiteIds) {
    setSiteIds(newSiteIds);
    setSiteConfigs((prev) => {
      const next = {};
      newSiteIds.forEach((id) => { next[id] = prev[id] || { module_ids: [], rights: {} }; });
      return next;
    });
    if (!expandedSite || !newSiteIds.includes(expandedSite)) {
      setExpandedSite(newSiteIds[0] || null);
    }
  }

  function updateSiteModules(siteId, moduleIds) {
    setSiteConfigs((prev) => ({
      ...prev,
      [siteId]: { ...prev[siteId], module_ids: moduleIds },
    }));
  }

  function updateSiteRight(siteId, mid, r) {
    setSiteConfigs((prev) => ({
      ...prev,
      [siteId]: { ...prev[siteId], rights: { ...prev[siteId]?.rights, [mid]: r } },
    }));
  }

  return (
    <div className="space-y-6">
      <SitePicker allSites={allSites} selected={siteIds} onChange={handleSiteChange} />

      {siteIds.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-700">Configure access per site</p>
          {siteIds.map((siteId) => {
            const site = allSites.find((s) => s.id === siteId);
            const config = siteConfigs[siteId] || { module_ids: [], rights: {} };
            const isOpen = expandedSite === siteId;

            return (
              <div key={siteId} className="rounded-lg border border-gray-200 bg-white">
                <button type="button"
                  onClick={() => setExpandedSite(isOpen ? null : siteId)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-800">{site?.project_code || siteId}</span>
                    {site?.name && <span className="text-xs text-gray-500">{site.name}</span>}
                    {config.module_ids.length > 0 ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        {config.module_ids.length} module{config.module_ids.length > 1 ? 's' : ''}
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-600">no modules</span>
                    )}
                  </div>
                  {isOpen ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                </button>

                {isOpen && (
                  <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-5">
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Modules</p>
                      <ModulePicker
                        selected={config.module_ids}
                        onChange={(ids) => updateSiteModules(siteId, ids)}
                        modules={modules}
                      />
                    </div>

                    {showFormRights && config.module_ids.length > 0 && (
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Permissions</p>
                        <ModuleRightsGrid
                          moduleIds={config.module_ids}
                          modules={modules}
                          rights={config.rights || {}}
                          onChange={(mid, r) => updateSiteRight(siteId, mid, r)}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
