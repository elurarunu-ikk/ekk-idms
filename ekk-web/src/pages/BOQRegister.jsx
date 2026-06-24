import { useMemo, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import useProjectSession from '../hooks/useProjectSession';
import { getApiErrorMessage } from '../services/apiService';
import { listBoqVersions, getBoqRegister } from '../services/boqService';
import ChangeRequestModal from '../components/ChangeRequestModal';
import LoadingSpinner from '../components/LoadingSpinner';

const formatCr = (val) =>
  val == null ? '—' : '₹ ' + (Number(val) / 1e7).toFixed(2) + ' Cr';

const formatQty = (val) =>
  val == null ? '—' : Number(val).toLocaleString('en-IN', { maximumFractionDigits: 3 });

const formatRate = (val) =>
  val == null ? '—' : '₹ ' + Number(val).toLocaleString('en-IN', { maximumFractionDigits: 2 });

const CHANGE_FLAG = {
  NO_CHANGE:    { label: 'No change',    cls: 'bg-gray-100 text-gray-600' },
  QTY_CHANGED:  { label: 'Qty changed',  cls: 'bg-amber-100 text-amber-700' },
  RATE_CHANGED: { label: 'Rate changed', cls: 'bg-blue-100 text-blue-700' },
  BOTH_CHANGED: { label: 'Both changed', cls: 'bg-orange-100 text-orange-700' },
  NEW_ITEM:     { label: 'New item',     cls: 'bg-green-100 text-green-700' },
  DELETED:      { label: 'Deleted',      cls: 'bg-red-100 text-red-700' },
};

const PAGE_SIZE = 50;

const BOQRegister = () => {
  const navigate = useNavigate();
  const { selectedProject } = useProjectSession();
  const projectId = selectedProject?.project_code;

  const [versions, setVersions] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [compareV0, setCompareV0] = useState(false);
  const [search, setSearch] = useState('');
  const [billFilter, setBillFilter] = useState('');
  const [itemTypeFilter, setItemTypeFilter] = useState('All');
  const [page, setPage] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalItem, setModalItem] = useState(null);

  useEffect(() => {
    if (!projectId) return;
    listBoqVersions(projectId).then(setVersions).catch(() => {});
  }, [projectId]);

  const fetchRegister = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const params = { project_id: projectId, compare_v0: compareV0, limit: 500, skip: 0 };
      if (selectedVersion !== null) params.version_no = selectedVersion;
      const result = await getBoqRegister(params);
      setData(result);
      setPage(0);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to load BOQ register'));
    } finally {
      setLoading(false);
    }
  }, [projectId, selectedVersion, compareV0]);

  useEffect(() => { fetchRegister(); }, [fetchRegister]);

  const billOptions = useMemo(() => {
    if (!data?.items) return [];
    const seen = new Set();
    return data.items.reduce((acc, item) => {
      if (item.bill_no && !seen.has(item.bill_no)) {
        seen.add(item.bill_no);
        const label = `Bill ${item.bill_no}` +
          (item.bill_description ? ` — ${item.bill_description.slice(0, 35)}` : '');
        acc.push({ value: item.bill_no, label });
      }
      return acc;
    }, []);
  }, [data]);

  const filteredItems = useMemo(() => {
    if (!data?.items) return [];
    const q = search.toLowerCase();
    return data.items.filter((item) => {
      if (q && !item.description?.toLowerCase().includes(q) && !item.item_code?.toLowerCase().includes(q)) return false;
      if (billFilter && item.bill_no !== billFilter) return false;
      if (itemTypeFilter === 'BOQ_ITEM' && item.item_type !== 'BOQ_ITEM') return false;
      if (itemTypeFilter === 'NON_BOQ_ITEM' && item.item_type !== 'NON_BOQ_ITEM') return false;
      return true;
    });
  }, [data, search, billFilter, itemTypeFilter]);

  const totalPages = Math.ceil(filteredItems.length / PAGE_SIZE);
  const pageItems = filteredItems.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const pendingCount = useMemo(
    () => data?.items?.filter((i) => i.approval_status === 'PENDING').length ?? 0,
    [data],
  );

  const variationPct = Number(data?.cumulative_variation_pct ?? 0);
  const variationColor =
    variationPct == null ? 'text-gray-400'
    : variationPct === 0 ? 'text-green-600'
    : Math.abs(variationPct) < 5 ? 'text-amber-600'
    : 'text-red-600';

  const isV0 = data?.version_no === 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            BOQ Register — {selectedProject?.project_code ?? '—'}
          </h1>
          {selectedProject?.name && (
            <p className="text-sm text-gray-500">{selectedProject.name}</p>
          )}
        </div>
        <button
          onClick={() => { setModalItem(null); setModalOpen(true); }}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
        >
          + Raise change
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-3 shadow-sm">
        <select
          value={selectedVersion ?? ''}
          onChange={(e) => {
            const v = e.target.value;
            setSelectedVersion(v === '' ? null : parseInt(v, 10));
            setCompareV0(false);
          }}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:border-blue-400"
        >
          <option value="">Latest version</option>
          {versions.map((v) => (
            <option key={v.version_no} value={v.version_no}>
              v{v.version_no} — {v.state}{v.label ? ` (${v.label})` : ''}
            </option>
          ))}
        </select>

        {!isV0 && (
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={compareV0}
              onChange={(e) => setCompareV0(e.target.checked)}
              className="rounded border-gray-300 text-blue-600"
            />
            Compare vs v0
          </label>
        )}

        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          placeholder="Search item code or description…"
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:border-blue-400 w-60"
        />

        <select
          value={billFilter}
          onChange={(e) => { setBillFilter(e.target.value); setPage(0); }}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:border-blue-400 max-w-xs"
        >
          <option value="">All bills</option>
          {billOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <select
          value={itemTypeFilter}
          onChange={(e) => { setItemTypeFilter(e.target.value); setPage(0); }}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:border-blue-400"
        >
          <option value="All">All items</option>
          <option value="BOQ_ITEM">BOQ items</option>
          <option value="NON_BOQ_ITEM">Non-BOQ items</option>
        </select>
      </div>

      {/* Summary cards */}
      {data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Contract value (v0)</p>
            <p className="mt-2 text-xl font-bold text-gray-900">{formatCr(data.contract_value_v0)}</p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Working BOQ value</p>
            <p className="mt-2 text-xl font-bold text-gray-900">{formatCr(data.working_value)}</p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Cumulative variation</p>
            <p className={`mt-2 text-xl font-bold ${variationColor}`}>
              {variationPct == null
                ? '—'
                : (variationPct >= 0 ? '+' : '') + variationPct.toFixed(2) + '%'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/boq/approvals')}
            className="rounded-xl bg-white p-4 shadow-sm border border-amber-100 text-left hover:shadow-md transition"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">Pending approvals</p>
            <p className="mt-2 text-xl font-bold text-amber-900">{pendingCount}</p>
            <p className="mt-2 text-xs font-medium text-amber-400">View details →</p>
          </button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10">
            <LoadingSpinner message="Loading BOQ register…" />
          </div>
        ) : !data || filteredItems.length === 0 ? (
          <p className="py-16 text-center text-sm text-gray-500">
            {data ? 'No items match your filters.' : 'No BOQ data loaded.'}
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500 w-24">BOQ No</th>
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Description</th>
                    <th className="px-3 py-2 text-center text-xs font-medium uppercase tracking-wide text-gray-500 w-16">Unit</th>
                    <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-gray-500 w-28">Tender qty</th>
                    <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-gray-500 w-28">Revised qty</th>
                    <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-gray-500 w-32">Rate (₹)</th>
                    {compareV0 && (
                      <>
                        <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-gray-500 w-24">Δ Qty</th>
                        <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-gray-500 w-28">Δ Amount</th>
                      </>
                    )}
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500 w-32">Status</th>
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500 w-28">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {pageItems.map((item) => {
                    const isDeleted = item.change_flag === 'DELETED';
                    const flagCfg = item.change_flag ? CHANGE_FLAG[item.change_flag] : null;
                    return (
                      <tr
                        key={item.id}
                        className={isDeleted ? 'bg-red-50 opacity-60' : 'hover:bg-gray-50 transition-colors'}
                      >
                        <td className={`px-3 py-3 font-mono font-bold text-gray-800 ${isDeleted ? 'line-through' : ''}`}>
                          {item.item_code}
                        </td>
                        <td className={`px-3 py-3 text-gray-700 ${isDeleted ? 'line-through text-gray-400' : ''}`}>
                          {item.description}
                        </td>
                        <td className="px-3 py-3 text-center text-xs text-gray-500">{item.unit || '—'}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-gray-700">{formatQty(item.expected_scope)}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-gray-700">{formatQty(item.revised_scope)}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-gray-700">{formatRate(item.adjusted_rate)}</td>
                        {compareV0 && (
                          <>
                            <td className={`px-3 py-3 text-right tabular-nums font-medium ${
                              item.delta_qty == null ? 'text-gray-400'
                              : item.delta_qty > 0 ? 'text-green-600'
                              : item.delta_qty < 0 ? 'text-red-600'
                              : 'text-gray-500'
                            }`}>
                              {item.delta_qty == null
                                ? '—'
                                : (item.delta_qty > 0 ? '+' : '') + formatQty(item.delta_qty)}
                            </td>
                            <td className={`px-3 py-3 text-right tabular-nums font-medium ${
                              item.delta_amount == null ? 'text-gray-400'
                              : item.delta_amount > 0 ? 'text-green-600'
                              : item.delta_amount < 0 ? 'text-red-600'
                              : 'text-gray-500'
                            }`}>
                              {item.delta_amount == null
                                ? '—'
                                : (item.delta_amount > 0 ? '+' : '') + formatCr(item.delta_amount)}
                            </td>
                          </>
                        )}
                        <td className="px-3 py-3">
                          {flagCfg ? (
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${flagCfg.cls}`}>
                              {flagCfg.label}
                            </span>
                          ) : item.approval_status === 'PENDING' ? (
                            <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700">
                              Change pending
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-3">
                          {!isDeleted && (
                            <button
                              onClick={() => { setModalItem(item); setModalOpen(true); }}
                              disabled={item.approval_status === 'PENDING'}
                              className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600
                                         hover:bg-gray-50 hover:border-gray-300 transition
                                         disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              Raise change
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
                <span className="text-xs text-gray-500">
                  {filteredItems.length} items · page {page + 1} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={page === 0}
                    onClick={() => setPage((p) => p - 1)}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600
                               hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    ← Prev
                  </button>
                  <button
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage((p) => p + 1)}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600
                               hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <ChangeRequestModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => { setModalOpen(false); fetchRegister(); }}
        item={modalItem}
        projectId={projectId}
      />
    </div>
  );
};

export default BOQRegister;
