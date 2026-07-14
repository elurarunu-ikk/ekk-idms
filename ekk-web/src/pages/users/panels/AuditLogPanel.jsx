import { useState, useEffect } from 'react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { getUserAuditLog, getApiErrorMessage } from '../../../services/apiService';
import toast from 'react-hot-toast';
import LoadingSpinner from '../../../components/LoadingSpinner';

const toUTC = (val) => {
  if (!val) return null;
  if (typeof val === 'string') {
    let iso = val.replace(' ', 'T');
    if (!iso.endsWith('Z') && !iso.includes('+') &&
        !iso.includes('-', 10)) {
      iso = iso + 'Z';
    }
    return iso;
  }
  return val;
};

const CHANGE_TYPE_STYLES = {
  created:            'bg-green-100 text-green-700',
  role_changed:       'bg-violet-100 text-violet-700',
  permission_granted: 'bg-blue-100 text-blue-700',
  permission_revoked: 'bg-red-100 text-red-700',
  deactivated:        'bg-gray-100 text-gray-600',
  activated:          'bg-green-100 text-green-700',
  password_reset:     'bg-amber-100 text-amber-700',
  cloned:             'bg-teal-100 text-teal-700',
  impersonated:       'bg-yellow-100 text-yellow-800',
  updated:            'bg-slate-100 text-slate-600',
};

const CHANGE_TYPE_LABELS = {
  created:            'Created',
  role_changed:       'Role changed',
  permission_granted: 'Permission granted',
  permission_revoked: 'Permission revoked',
  deactivated:        'Deactivated',
  activated:          'Activated',
  password_reset:     'Password reset',
  cloned:             'Cloned',
  impersonated:       'Impersonated',
  updated:            'Updated',
};

const DOT_COLOR = (changeType) => {
  if (changeType === 'created' || changeType === 'activated') return 'bg-green-500';
  if (changeType === 'deactivated' || changeType === 'permission_revoked') return 'bg-red-400';
  if (changeType === 'role_changed') return 'bg-violet-500';
  if (changeType === 'password_reset') return 'bg-amber-500';
  return 'bg-blue-400';
};

const getDiffKeys = (oldVal, newVal) => {
  const allKeys = new Set([
    ...Object.keys(oldVal || {}),
    ...Object.keys(newVal || {}),
  ]);
  return [...allKeys].filter(
    key => JSON.stringify((oldVal || {})[key]) !== JSON.stringify((newVal || {})[key])
  );
};

const fmtValue = (val) => {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  return String(val);
};

const AuditLogPanel = ({ userId }) => {
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [expanded, setExpanded] = useState({});

  const loadEntries = async (currentSkip = 0, append = false) => {
    try {
      append ? setLoadingMore(true) : setLoading(true);
      const data = await getUserAuditLog(userId, { skip: currentSkip, limit: 20 });
      setTotal(data.total || 0);
      setEntries(prev =>
        append ? [...prev, ...(data.entries || [])] : (data.entries || [])
      );
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to load audit log'));
    } finally {
      append ? setLoadingMore(false) : setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) loadEntries(0, false);
  }, [userId]);

  const toggleExpand = (id) =>
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  if (loading) return <LoadingSpinner message="Loading audit log..." />;

  return (
    <div className="space-y-2">
      {entries.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-400">
          No changes recorded yet.
        </div>
      ) : (
        entries.map(entry => (
          <div key={entry.id} className="rounded-lg border border-gray-100 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${DOT_COLOR(entry.change_type)}`} />
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${CHANGE_TYPE_STYLES[entry.change_type] || 'bg-gray-100 text-gray-600'}`}>
                  {CHANGE_TYPE_LABELS[entry.change_type] || entry.change_type}
                </span>
                <span className="text-xs text-gray-400">·</span>
                <span className="text-xs text-gray-400">
                  {formatDistanceToNow(parseISO(toUTC(entry.changed_at)), { addSuffix: true })}
                </span>
              </div>
              {(entry.old_value || entry.new_value) && (
                <button
                  onClick={() => toggleExpand(entry.id)}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 flex-shrink-0"
                >
                  {expanded[entry.id]
                    ? <><ChevronUp className="w-3 h-3" /> Hide</>
                    : <><ChevronDown className="w-3 h-3" /> Show changes</>}
                </button>
              )}
            </div>

            <div className="mt-1 ml-4 flex items-center gap-2">
              <span className="text-xs text-gray-500">
                By: <span className="font-medium text-gray-700">{entry.changed_by_name}</span>
              </span>
              {entry.impersonating_as_name && (
                <span className="rounded bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                  via impersonation
                </span>
              )}
            </div>

            {expanded[entry.id] && (
              <div className="mt-3 ml-4">
                {(() => {
                  const diffKeys = getDiffKeys(entry.old_value, entry.new_value);
                  if (diffKeys.length === 0) {
                    return (
                      <p className="text-xs text-gray-400 italic">No field-level diff available.</p>
                    );
                  }
                  return (
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr>
                          <th className="text-left py-1 pr-3 text-gray-400 font-medium w-1/4">Field</th>
                          <th className="text-left py-1 pr-3 text-gray-400 font-medium">Before</th>
                          <th className="text-left py-1 text-gray-400 font-medium">After</th>
                        </tr>
                      </thead>
                      <tbody>
                        {diffKeys.map(key => (
                          <tr key={key} className="border-t border-gray-100">
                            <td className="py-1 pr-3 text-gray-500 font-mono">{key}</td>
                            <td className="py-1 pr-3">
                              <span className="rounded bg-red-50 px-1.5 py-0.5 text-red-700 font-mono">
                                {fmtValue((entry.old_value || {})[key])}
                              </span>
                            </td>
                            <td className="py-1">
                              <span className="rounded bg-green-50 px-1.5 py-0.5 text-green-700 font-mono">
                                {fmtValue((entry.new_value || {})[key])}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  );
                })()}
              </div>
            )}
          </div>
        ))
      )}

      {entries.length < total && (
        <button
          onClick={() => {
            const newSkip = skip + 20;
            setSkip(newSkip);
            loadEntries(newSkip, true);
          }}
          disabled={loadingMore}
          className="mt-2 w-full rounded-lg border border-gray-200 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          {loadingMore
            ? 'Loading...'
            : `Load more (${total - entries.length} remaining)`}
        </button>
      )}
    </div>
  );
};

export default AuditLogPanel;
