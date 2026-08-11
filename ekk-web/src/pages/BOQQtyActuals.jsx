import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import useProjectSession from '../hooks/useProjectSession';
import { getApiErrorMessage } from '../services/apiService';
import { getBoqQtyActuals } from '../services/boqService';
import LoadingSpinner from '../components/LoadingSpinner';

const toUTC = (val) => {
  if (!val) return null;
  if (typeof val === 'string') {
    let iso = val.replace(' ', 'T');
    if (!iso.endsWith('Z') && !iso.includes('+') && !iso.includes('-', 10)) {
      iso = iso + 'Z';
    }
    return iso;
  }
  return val;
};

const relativeTime = (iso) => {
  if (!iso) return '—';
  const diff = Date.now() - new Date(toUTC(iso)).getTime();
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor(diff / 60000);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return 'just now';
};

const formatQty = (val) =>
  val == null ? '—' : Number(val).toLocaleString('en-IN', { maximumFractionDigits: 3 });

const naturalSortKey = (code) =>
  (code || '').split(/(\d+)/).map((p) => (/^\d+$/.test(p) ? Number(p) : p.toLowerCase()));

const naturalCompare = (a, b) => {
  const ka = naturalSortKey(a);
  const kb = naturalSortKey(b);
  const len = Math.max(ka.length, kb.length);
  for (let i = 0; i < len; i++) {
    const pa = ka[i];
    const pb = kb[i];
    if (pa === undefined) return -1;
    if (pb === undefined) return 1;
    if (pa === pb) continue;
    if (typeof pa === typeof pb) return pa < pb ? -1 : 1;
    return typeof pa === 'number' ? -1 : 1;
  }
  return 0;
};

const ProgressBar = ({ pct }) => {
  const color =
    pct === 0   ? 'bg-gray-200' :
    pct < 25    ? 'bg-red-400' :
    pct < 75    ? 'bg-amber-400' :
    pct < 100   ? 'bg-blue-500' :
                  'bg-green-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div
          className={`h-2 rounded-full ${color}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className="text-xs font-medium w-10 text-right">
        {pct.toFixed(1)}%
      </span>
    </div>
  );
};

const PROGRESS_FILTERS = ['All', 'Not started', 'In progress', 'Complete'];

const BOQQtyActuals = () => {
  const { selectedProject } = useProjectSession();
  const projectId = selectedProject?.project_code;

  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [billFilter, setBillFilter] = useState('');
  const [progressFilter, setProgressFilter] = useState('All');

  const fetchActuals = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(false);
    try {
      const result = await getBoqQtyActuals(projectId);
      setItems(Array.isArray(result) ? result : result?.items || []);
    } catch (err) {
      setError(true);
      toast.error(getApiErrorMessage(err, 'Failed to load BOQ progress'));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchActuals(); }, [fetchActuals]);

  const sortedItems = useMemo(() => {
    if (!items) return [];
    return [...items].sort((a, b) => naturalCompare(a.boq_item_code, b.boq_item_code));
  }, [items]);

  const billOptions = useMemo(() => {
    const seen = new Set();
    sortedItems.forEach((item) => {
      const prefix = (item.boq_item_code || '').split('.')[0];
      if (prefix) seen.add(prefix);
    });
    return Array.from(seen).sort((a, b) => naturalCompare(a, b));
  }, [sortedItems]);

  const filteredItems = useMemo(() => {
    const q = search.toLowerCase();
    return sortedItems.filter((item) => {
      if (q && !item.description?.toLowerCase().includes(q)
        && !item.boq_item_code?.toLowerCase().includes(q)) return false;
      if (billFilter && (item.boq_item_code || '').split('.')[0] !== billFilter) return false;
      const pct = item.pct_complete ?? 0;
      if (progressFilter === 'Not started' && pct !== 0) return false;
      if (progressFilter === 'In progress' && (pct <= 0 || pct >= 100)) return false;
      if (progressFilter === 'Complete' && pct !== 100) return false;
      return true;
    });
  }, [sortedItems, search, billFilter, progressFilter]);

  const summary = useMemo(() => {
    const totalApproved = sortedItems.reduce((sum, i) => sum + Number(i.approved_qty || 0), 0);
    const totalRevised = sortedItems.reduce((sum, i) => sum + Number(i.revised_scope || 0), 0);
    const totalDprEntries = sortedItems.reduce((sum, i) => sum + Number(i.dpr_entry_count || 0), 0);
    const overallPct = totalRevised > 0 ? (totalApproved / totalRevised) * 100 : 0;
    const lastUpdated = sortedItems.reduce((latest, i) => {
      if (!i.last_updated_at) return latest;
      const t = new Date(toUTC(i.last_updated_at)).getTime();
      return !latest || t > latest ? t : latest;
    }, null);
    return { totalApproved, totalDprEntries, overallPct, lastUpdated };
  }, [sortedItems]);

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            BOQ Progress Tracker — {selectedProject?.project_code ?? '—'}
          </h1>
          <p className="text-sm text-gray-500">
            {sortedItems.length} items with recorded actuals
            {summary.lastUpdated && (
              <> · Last updated {relativeTime(new Date(summary.lastUpdated).toISOString())}</>
            )}
          </p>
        </div>
        <button
          onClick={fetchActuals}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
        >
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      {items && items.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">BOQ items tracked</p>
            <p className="mt-2 text-xl font-bold text-gray-900">{sortedItems.length}</p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Total approved qty</p>
            <p className="mt-2 text-xl font-bold text-gray-900">{formatQty(summary.totalApproved)}</p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Overall % complete</p>
            <p className="mt-2 text-xl font-bold text-gray-900">{summary.overallPct.toFixed(1)}%</p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Total DPR entries</p>
            <p className="mt-2 text-xl font-bold text-gray-900">{summary.totalDprEntries}</p>
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-3 shadow-sm">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search item code or description…"
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:border-blue-400 w-60"
        />
        <select
          value={billFilter}
          onChange={(e) => setBillFilter(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:border-blue-400"
        >
          <option value="">All bills</option>
          {billOptions.map((b) => (
            <option key={b} value={b}>Bill {b}</option>
          ))}
        </select>
        <select
          value={progressFilter}
          onChange={(e) => setProgressFilter(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:border-blue-400"
        >
          {PROGRESS_FILTERS.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>

      {/* Progress table */}
      <div className="rounded-xl bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10">
            <LoadingSpinner message="Loading BOQ progress…" />
          </div>
        ) : error ? (
          <div className="py-16 text-center">
            <p className="text-sm text-red-500 mb-3">Failed to load BOQ progress.</p>
            <button
              onClick={fetchActuals}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Retry
            </button>
          </div>
        ) : !items || items.length === 0 ? (
          <div className="py-16 text-center">
            <div className="text-4xl mb-3">📊</div>
            <p className="text-gray-700 text-sm font-medium">No quantity actuals recorded yet.</p>
            <p className="mt-1 text-xs text-gray-400">
              Actuals are updated automatically when DPR entries are approved.
              Approve a DPR entry to see progress here.
            </p>
          </div>
        ) : filteredItems.length === 0 ? (
          <p className="py-16 text-center text-sm text-gray-500">No items match your filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500 w-24">BOQ No</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Description</th>
                  <th className="px-3 py-2 text-center text-xs font-medium uppercase tracking-wide text-gray-500 w-16">Unit</th>
                  <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-gray-500 w-28">Revised Scope</th>
                  <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-gray-500 w-28">Actual Qty</th>
                  <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-gray-500 w-28">Balance Qty</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500 w-40">% Complete</th>
                  <th className="px-3 py-2 text-center text-xs font-medium uppercase tracking-wide text-gray-500 w-24">DPR entries</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500 w-28">Last updated</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500 w-32">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredItems.map((item) => {
                  const revised = item.revised_scope;
                  const balance = item.balance_qty;
                  const balanceRatio = revised ? (balance ?? 0) / revised : null;
                  const balanceColor =
                    balanceRatio == null ? 'text-gray-700'
                    : balanceRatio < 0.10 ? 'text-red-600'
                    : balanceRatio < 0.25 ? 'text-amber-600'
                    : 'text-gray-700';
                  const pct = item.pct_complete ?? 0;
                  return (
                    <tr key={item.boq_item_code} className="hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-3 font-mono font-bold text-gray-800">{item.boq_item_code}</td>
                      <td className="px-3 py-3 text-gray-700">{item.description || '—'}</td>
                      <td className="px-3 py-3 text-center text-xs text-gray-500">{item.unit || '—'}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-gray-700">{formatQty(revised)}</td>
                      <td className="px-3 py-3 text-right tabular-nums font-medium text-green-600">{formatQty(item.approved_qty)}</td>
                      <td className={`px-3 py-3 text-right tabular-nums font-medium ${balanceColor}`}>{formatQty(balance)}</td>
                      <td className="px-3 py-3"><ProgressBar pct={pct} /></td>
                      <td className="px-3 py-3 text-center text-xs text-gray-400">{item.dpr_entry_count ?? 0}</td>
                      <td className="px-3 py-3 text-xs text-gray-500">{relativeTime(item.last_updated_at)}</td>
                      <td className="px-3 py-3">
                        <Link
                          to={`/captures?boq_item=${encodeURIComponent(item.boq_item_code)}`}
                          className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600
                                     hover:bg-gray-50 hover:border-gray-300 transition"
                        >
                          View DPR entries
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default BOQQtyActuals;
