import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useWizardStore } from '../../../store/wizardStore';
import { listCompanies, listSites } from '../../../services/apiService';

const AUTO_SITE_TYPES = ['ADMIN', 'HO_USER'];

export default function Step2CompanySite() {
  const { data, updateStep2 } = useWizardStore();
  const userType = data.user_type;
  const isAutoSite = AUTO_SITE_TYPES.includes(userType);
  const isSuper = userType === 'SUPER_ADMIN' || userType === 'SUPER ADMIN';

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => listCompanies().then((r) => r.items || r),
  });

  const [selectedCompanyId, setSelectedCompanyId] = useState(data.company_id || '');
  const [selectedSiteIds, setSelectedSiteIds] = useState(data.site_ids || []);

  const { data: sites = [] } = useQuery({
    queryKey: ['sites', selectedCompanyId],
    queryFn: () => listSites({ company_id: selectedCompanyId }).then((r) => r.items || r),
    enabled: !!selectedCompanyId && !isAutoSite && !isSuper,
  });

  useEffect(() => {
    updateStep2({
      company_id: selectedCompanyId,
      site_ids: selectedSiteIds,
      is_all_sites: isAutoSite || isSuper,
    });
  }, [selectedCompanyId, selectedSiteIds, isAutoSite, isSuper]);

  if (isSuper) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
        <p className="text-sm font-medium text-gray-700">Super Admin has global access to all companies and sites.</p>
        <p className="mt-1 text-xs text-gray-500">No scope selection needed — click Next to continue.</p>
      </div>
    );
  }

  function toggleSite(id) {
    setSelectedSiteIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  }

  function selectAll() { setSelectedSiteIds(sites.map((s) => s.id)); }
  function clearAll()  { setSelectedSiteIds([]); }

  const selectedSiteNames = sites.filter((s) => selectedSiteIds.includes(s.id)).map((s) => s.project_code ? `${s.project_code} · ${s.name}` : s.name || s.id);

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {/* Left: tree */}
      <div>
        <p className="mb-3 text-sm font-semibold text-gray-700">Company & Sites</p>
        {companies.map((company) => (
          <div key={company.id} className="mb-4 rounded-lg border border-gray-200 p-3">
            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2">
                <input type="radio" name="company" value={company.id}
                  checked={selectedCompanyId === company.id}
                  onChange={() => { setSelectedCompanyId(company.id); setSelectedSiteIds([]); }}
                  className="text-primary-600" />
                <span className="text-sm font-medium text-gray-800">{company.name}</span>
              </label>
              {selectedCompanyId === company.id && !isAutoSite && (
                <div className="flex gap-2 text-xs">
                  <button type="button" onClick={selectAll} className="text-primary-600 hover:underline">All</button>
                  <button type="button" onClick={clearAll}  className="text-gray-400 hover:underline">None</button>
                </div>
              )}
            </div>

            {selectedCompanyId === company.id && (
              <div className="mt-2 space-y-1.5 pl-6">
                {isAutoSite ? (
                  <p className="text-xs text-gray-500 italic">
                    {userType === 'ADMIN' ? 'Admin' : 'HO User'} automatically accesses all sites.
                  </p>
                ) : sites.map((site) => (
                  <label key={site.id} className="flex cursor-pointer items-center gap-2">
                    <input type="checkbox" checked={selectedSiteIds.includes(site.id)}
                      onChange={() => toggleSite(site.id)} className="rounded text-primary-600" />
                    <span className="text-sm text-gray-700">{site.project_code ? `${site.project_code} · ${site.name}` : site.name || site.id}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}
        {companies.length === 0 && (
          <p className="text-sm text-gray-500">No companies found. Create a company first.</p>
        )}
      </div>

      {/* Right: summary */}
      <div>
        <p className="mb-3 text-sm font-semibold text-gray-700">
          Selected sites
          <span className="ml-2 rounded-full bg-primary-100 px-2 py-0.5 text-xs text-primary-700">
            {isAutoSite ? 'All' : selectedSiteIds.length}
          </span>
        </p>
        {isAutoSite ? (
          <p className="text-sm text-gray-500 italic">All sites included automatically.</p>
        ) : selectedSiteNames.length === 0 ? (
          <p className="text-sm text-gray-400">No sites selected yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {selectedSiteNames.map((name, i) => (
              <span key={i} className="flex items-center gap-1 rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700">
                {name}
                <button type="button" onClick={() => toggleSite(sites.find((s) => (s.project_code ? `${s.project_code} · ${s.name}` : s.name || s.id) === name)?.id)}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
