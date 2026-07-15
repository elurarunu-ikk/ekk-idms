import { useState, useEffect } from 'react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import { getMobileUsers, getAppVersionInfo, getApiErrorMessage } from '../../../services/apiService';
import LoadingSpinner from '../../../components/LoadingSpinner';

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

// Compares dotted version strings (e.g. "0.3.3") as [major, minor, patch].
const versionParts = (v) => (v || '').split('.').map((n) => parseInt(n, 10) || 0);

const versionsBehind = (deviceVersion, latestVersion) => {
  const [dMaj, dMin, dPatch] = versionParts(deviceVersion);
  const [lMaj, lMin, lPatch] = versionParts(latestVersion);
  const dNum = dMaj * 10000 + dMin * 100 + dPatch;
  const lNum = lMaj * 10000 + lMin * 100 + lPatch;
  return Math.max(0, lNum - dNum);
};

const VersionBadge = ({ appVersion, latestVersion }) => {
  if (!appVersion || appVersion === 'unknown') {
    return (
      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
        Unknown
      </span>
    );
  }

  if (!latestVersion) {
    return (
      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
        {appVersion}
      </span>
    );
  }

  const behind = versionsBehind(appVersion, latestVersion);
  const style =
    behind === 0 ? 'bg-green-100 text-green-700'
    : behind === 1 ? 'bg-amber-100 text-amber-700'
    : 'bg-red-100 text-red-700';

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>
      {appVersion}
    </span>
  );
};

const MobileUsersTab = () => {
  const [rows, setRows] = useState([]);
  const [latestVersion, setLatestVersion] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [mobileUsers, versionInfo] = await Promise.all([
          getMobileUsers(),
          getAppVersionInfo().catch(() => null),
        ]);
        setRows(mobileUsers || []);
        setLatestVersion(versionInfo?.minimum_version || null);
      } catch (err) {
        toast.error(getApiErrorMessage(err, 'Failed to load mobile users'));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <LoadingSpinner message="Loading mobile users..." />;

  if (rows.length === 0) {
    return (
      <div className="py-16 text-center">
        <div className="text-4xl mb-3">📱</div>
        <p className="text-gray-500 text-sm">No registered mobile devices yet.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
            <th className="px-4 py-3">Full Name</th>
            <th className="px-4 py-3">Username</th>
            <th className="px-4 py-3">Role</th>
            <th className="px-4 py-3">Device</th>
            <th className="px-4 py-3">App Version</th>
            <th className="px-4 py-3">Last Seen</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((row) => (
            <tr key={row.user_id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 font-medium text-gray-900">{row.full_name}</td>
              <td className="px-4 py-3 text-gray-500">@{row.username}</td>
              <td className="px-4 py-3 text-gray-600">{row.user_type}</td>
              <td className="px-4 py-3 text-gray-600">{row.device_label || '—'}</td>
              <td className="px-4 py-3">
                <VersionBadge appVersion={row.app_version} latestVersion={latestVersion} />
              </td>
              <td className="px-4 py-3 text-xs text-gray-500">
                {row.last_seen_at
                  ? formatDistanceToNow(parseISO(toUTC(row.last_seen_at)), { addSuffix: true })
                  : 'Never'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default MobileUsersTab;
