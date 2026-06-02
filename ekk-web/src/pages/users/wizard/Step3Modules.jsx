import { useQuery } from '@tanstack/react-query';
import {
  BarChart2, Camera, CheckSquare, Compass, FileText,
  Home, Layers, MessageSquare, Settings, Users,
} from 'lucide-react';
import { useWizardStore } from '../../../store/wizardStore';
import { listModules } from '../../../services/apiService';
import LoadingSpinner from '../../../components/LoadingSpinner';

const MODULE_ICONS = {
  dashboard: Home, capture: Camera, entries: FileText,
  approvals: CheckSquare, report: BarChart2, chat: MessageSquare,
  projects: Compass, users: Users, companies: Layers,
  resources: Settings,
};

const AUTO_MODULE_TYPES = ['SUPER_ADMIN', 'SUPER ADMIN', 'SITE_ADMIN'];

// Fallback module list when API not ready
const FALLBACK_MODULES = [
  { id: 'dashboard', name: 'Dashboard', description: 'Overview and KPIs', form_count: 1 },
  { id: 'capture', name: 'Capture', description: 'Field data entry', form_count: 3 },
  { id: 'entries', name: 'Entries', description: 'View and manage entries', form_count: 2 },
  { id: 'approvals', name: 'Approvals', description: 'Approve/reject entries', form_count: 1 },
  { id: 'report', name: 'Reports', description: 'Analytics and reports', form_count: 2 },
  { id: 'chat', name: 'AI Chat', description: 'AI project assistant', form_count: 1 },
  { id: 'projects', name: 'Projects', description: 'Project management', form_count: 2 },
  { id: 'users', name: 'User Management', description: 'Manage users and access', form_count: 4 },
  { id: 'companies', name: 'Companies', description: 'Company master data', form_count: 1 },
  { id: 'resources', name: 'Resources', description: '3M resource masters', form_count: 3 },
];

export default function Step3Modules() {
  const { data, updateStep3 } = useWizardStore();
  const userType = data.user_type;
  const isAuto = AUTO_MODULE_TYPES.includes(userType);

  const { data: apiModules, isLoading } = useQuery({
    queryKey: ['modules'],
    queryFn: listModules,
    retry: false,
  });

  const modules = (apiModules?.items || apiModules) || FALLBACK_MODULES;
  const selected = data.module_ids || [];
  const suggested = data.role_suggestion?.module_ids || [];

  if (isAuto) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
        <p className="text-sm font-medium text-gray-700">
          {userType === 'SITE_ADMIN' ? 'Site Admin' : 'Super Admin'} automatically has access to all modules.
        </p>
        <p className="mt-1 text-xs text-gray-500">No module selection needed — click Next to continue.</p>
      </div>
    );
  }

  if (isLoading) return <LoadingSpinner message="Loading modules..." />;

  function toggle(id) {
    updateStep3(selected.includes(id) ? selected.filter((m) => m !== id) : [...selected, id]);
  }
  function selectAll() { updateStep3(modules.map((m) => m.id)); }
  function clearAll()  { updateStep3([]); }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-medium text-gray-600">{selected.length} of {modules.length} selected</p>
        <div className="flex gap-3 text-xs">
          <button type="button" onClick={selectAll} className="text-primary-600 hover:underline">Select all</button>
          <button type="button" onClick={clearAll}  className="text-gray-400 hover:underline">Clear</button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((mod) => {
          const Icon = MODULE_ICONS[mod.id] || Settings;
          const isSelected = selected.includes(mod.id);
          const isSuggested = suggested.includes(mod.id);
          return (
            <button key={mod.id} type="button" onClick={() => toggle(mod.id)}
              className={`relative rounded-xl border-2 p-4 text-left transition
                ${isSelected ? 'border-primary-500 bg-primary-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
            >
              {isSelected && (
                <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary-500 text-white text-xs">✓</span>
              )}
              {isSuggested && !isSelected && (
                <span className="absolute right-2 top-2 rounded-full bg-blue-100 px-1.5 py-0.5 text-xs text-blue-600">AI</span>
              )}
              <Icon className={`mb-2 h-5 w-5 ${isSelected ? 'text-primary-600' : 'text-gray-400'}`} />
              <p className={`text-sm font-semibold ${isSelected ? 'text-primary-700' : 'text-gray-800'}`}>{mod.name}</p>
              {mod.description && <p className="mt-0.5 text-xs text-gray-500">{mod.description}</p>}
              {mod.form_count != null && (
                <p className="mt-1 text-xs text-gray-400">{mod.form_count} forms</p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
