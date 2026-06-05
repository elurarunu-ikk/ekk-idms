import { useState, useEffect, useRef } from 'react';
import { Search, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { STATUS_OPTIONS } from '../utils/captureUtils';
import { getWorkTypes, getLayers } from '../services/mastersService';

function pillClass(isActive) {
  return `rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
    isActive
      ? 'bg-gray-900 text-white border-gray-900'
      : 'bg-white text-gray-600 border-gray-300 hover:border-gray-500'
  }`;
}

const SmartFilterBar = ({ filters, onChange, config, placeholder }) => {
  const [expanded, setExpanded] = useState(false);
  const [localSearch, setLocalSearch] = useState(filters.search || '');
  const [masterWorkTypes, setMasterWorkTypes] = useState([]);
  const [masterLayers,    setMasterLayers]    = useState([]);

  useEffect(() => {
    Promise.all([getWorkTypes(true), getLayers('ROAD', true)])
      .then(([wts, lyrs]) => {
        setMasterWorkTypes(wts);
        setMasterLayers(lyrs);
      })
      .catch(() => {});
  }, []);

  // Always hold the latest filters so the debounce closure never goes stale
  const latestFilters = useRef(filters);
  useEffect(() => { latestFilters.current = filters; });

  // Skip debounce on mount — only fire when user actually types
  const didMountRef = useRef(false);

  const show = (key) => !config || config.includes(key);

  // Debounce search 400ms — uses latestFilters.current to avoid overwriting pill selections
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    const t = setTimeout(() => onChange({ ...latestFilters.current, search: localSearch }), 400);
    return () => clearTimeout(t);
  }, [localSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync localSearch when filters.search is cleared externally (e.g. "Clear all")
  useEffect(() => {
    if (filters.search === '' && localSearch !== '') {
      setLocalSearch('');
    }
  }, [filters.search]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeCount = [
    filters.workType && filters.workType !== 'All',
    filters.layerCode,
    filters.status && filters.status !== 'All',
    filters.chainageMin,
    filters.chainageMax,
    filters.dateFrom,
    filters.dateTo,
    filters.contractor,
  ].filter(Boolean).length;

  // Auto-expand when any advanced filter is active
  useEffect(() => {
    if (activeCount > 0) setExpanded(true);
  }, [activeCount]);

  const clearAll = () => {
    setLocalSearch('');
    onChange({
      search: '',
      workType: 'All',
      layerCode: '',
      status: 'All',
      chainageMin: '',
      chainageMax: '',
      dateFrom: '',
      dateTo: '',
      contractor: '',
    });
  };

  return (
    <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-4 space-y-3">

      {/* Row 1: search + filter toggle */}
      <div className="flex gap-2 items-center flex-wrap">

        {show('search') && (
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={localSearch}
              onChange={e => setLocalSearch(e.target.value)}
              placeholder={placeholder || 'Search chainage, activity, contractor, RFI…'}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg
                         focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
        )}

        <button
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200
                     rounded-lg text-gray-600 hover:bg-gray-50 whitespace-nowrap"
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filters
          {activeCount > 0 && (
            <span className="ml-1 rounded-full bg-blue-600 text-white text-xs
                             font-medium px-1.5 py-0.5 min-w-[18px] text-center leading-none">
              {activeCount}
            </span>
          )}
          <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
        </button>

        {activeCount > 0 && (
          <button onClick={clearAll} className="text-sm text-blue-600 hover:underline whitespace-nowrap">
            Clear all
          </button>
        )}
      </div>

      {/* Row 2: advanced filters (collapsible) */}
      {expanded && (
        <div className="space-y-4 pt-3 border-t border-gray-100">

          {/* Work Type pills */}
          {show('workType') && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Work type
              </p>
              <div className="flex flex-wrap gap-2">
                {masterWorkTypes.length === 0 ? (
                  <span className="text-xs text-gray-400 italic">Loading...</span>
                ) : (
                  <>
                    <button
                      onClick={() => onChange({ ...filters, workType: 'All', layerCode: '' })}
                      className={pillClass(!filters.workType || filters.workType === 'All')}
                    >
                      All
                    </button>
                    {masterWorkTypes.map(wt => (
                      <button
                        key={wt.code}
                        onClick={() => onChange({ ...filters, workType: wt.code, layerCode: '' })}
                        className={pillClass(filters.workType === wt.code)}
                      >
                        {wt.label}
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Layer pills — only visible when workType is ROAD */}
          {show('layerCode') && filters.workType === 'ROAD' && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Layer
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => onChange({ ...filters, layerCode: '' })}
                  className={pillClass(!filters.layerCode)}
                >
                  All layers
                </button>
                {masterLayers.map(l => (
                  <button
                    key={l.code}
                    onClick={() => onChange({ ...filters, layerCode: l.code })}
                    className={pillClass(filters.layerCode === l.code)}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Status pills */}
          {show('status') && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Status
              </p>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => onChange({ ...filters, status: s })}
                    className={pillClass(filters.status === s || (!filters.status && s === 'All'))}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chainage range */}
          {show('chainageMin') && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Chainage (km)
              </p>
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  placeholder="From (e.g. 45)"
                  value={filters.chainageMin || ''}
                  onChange={e => onChange({ ...filters, chainageMin: e.target.value })}
                  className="w-32 px-3 py-2 text-sm border border-gray-200 rounded-lg
                             focus:border-primary-500 focus:outline-none"
                />
                <span className="text-gray-400">→</span>
                <input
                  type="number"
                  placeholder="To (e.g. 60)"
                  value={filters.chainageMax || ''}
                  onChange={e => onChange({ ...filters, chainageMax: e.target.value })}
                  className="w-32 px-3 py-2 text-sm border border-gray-200 rounded-lg
                             focus:border-primary-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Date range + Contractor */}
          {(show('dateFrom') || show('dateTo') || show('contractor')) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {show('dateFrom') && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                    Date from
                  </p>
                  <input
                    type="date"
                    value={filters.dateFrom || ''}
                    onChange={e => onChange({ ...filters, dateFrom: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
                               focus:border-primary-500 focus:outline-none"
                  />
                </div>
              )}
              {show('dateTo') && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                    Date to
                  </p>
                  <input
                    type="date"
                    value={filters.dateTo || ''}
                    onChange={e => onChange({ ...filters, dateTo: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
                               focus:border-primary-500 focus:outline-none"
                  />
                </div>
              )}
              {show('contractor') && (
                <div className="sm:col-span-2">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                    Contractor
                  </p>
                  <input
                    type="text"
                    placeholder="Filter by contractor name"
                    value={filters.contractor || ''}
                    onChange={e => onChange({ ...filters, contractor: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
                               focus:border-primary-500 focus:outline-none"
                  />
                </div>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  );
};

export default SmartFilterBar;
