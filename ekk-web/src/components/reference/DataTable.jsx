import { useCallback, useEffect, useRef, useState } from 'react';

const LIMIT = 100;

const DataTable = ({ columns, fetchPage, filters, rowStyle }) => {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const loaderRef = useRef(null);

  // Mutable refs so the stable `doLoad` callback can see current values
  const rowsRef = useRef([]);
  const loadingRef = useRef(false);
  const doneRef = useRef(false);
  const filtersRef = useRef(filters);
  const fetchRef = useRef(fetchPage);
  filtersRef.current = filters;
  fetchRef.current = fetchPage;

  const filtersKey = JSON.stringify(filters);

  const doLoad = useCallback(async () => {
    if (loadingRef.current || doneRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const data = await fetchRef.current({
        ...filtersRef.current,
        skip: rowsRef.current.length,
        limit: LIMIT,
      });
      const entries = data.entries ?? [];
      const next =
        rowsRef.current.length === 0 ? entries : [...rowsRef.current, ...entries];
      rowsRef.current = next;
      setRows(next);
      setTotal(data.total ?? 0);
      const isDone = next.length >= (data.total ?? 0);
      doneRef.current = isDone;
      setDone(isDone);
    } catch {
      // silent
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []); // stable — reads all state via refs

  // Reset + load first page whenever filters change
  useEffect(() => {
    rowsRef.current = [];
    loadingRef.current = false;
    doneRef.current = false;
    setRows([]);
    setTotal(null);
    setLoading(false);
    setDone(false);
    doLoad();
  }, [filtersKey, doLoad]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const el = loaderRef.current;
    if (!el || done) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) doLoad();
      },
      { rootMargin: '300px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [doLoad, done]);

  return (
    <div
      className="relative overflow-auto rounded-lg border border-[#1E293B]"
      style={{ maxHeight: '62vh' }}
    >
      <table className="w-full border-collapse text-xs">
        <thead className="sticky top-0 z-10 bg-[#0A101A]">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className="whitespace-nowrap border-b border-[#1E293B] px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[#64748B]"
                style={col.width ? { width: col.width, minWidth: col.width } : undefined}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={row.id ?? idx}
              className="border-b border-[#0F172A] transition-colors hover:bg-[#1E2D3D]"
              style={rowStyle ? rowStyle(row, idx) : { background: idx % 2 === 0 ? '#0D1420' : '#080C14' }}
            >
              {columns.map((col) => (
                <td key={col.key} className="whitespace-nowrap px-3 py-2 text-[#CBD5E1]">
                  {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-4 text-xs text-[#64748B]">
          <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
            <path d="M12 2a10 10 0 010 20" stroke="#3B82F6" strokeWidth="3" strokeLinecap="round" />
          </svg>
          Loading…
        </div>
      )}

      {!done && !loading && <div ref={loaderRef} className="h-6" />}

      {done && rows.length > 0 && (
        <div className="border-t border-[#1E293B] py-1.5 text-center text-[10px] text-[#475569]">
          {rows.length.toLocaleString()} of {(total ?? 0).toLocaleString()} records loaded
        </div>
      )}

      {done && rows.length === 0 && !loading && (
        <div className="py-10 text-center text-sm text-[#64748B]">No records found</div>
      )}
    </div>
  );
};

export default DataTable;
