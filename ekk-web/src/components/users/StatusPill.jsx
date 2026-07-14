import { addDays, isAfter, parseISO } from 'date-fns';

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

export default function StatusPill({ user }) {
  if (!user) return null;
  const now = new Date();

  if (user.expires_at && user.user_kind === 'external') {
    const expiry = parseISO(toUTC(user.expires_at));
    if (!isAfter(expiry, now)) {
      return <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">Expired</span>;
    }
    if (!isAfter(expiry, addDays(now, 7))) {
      return <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-700">Expiring soon</span>;
    }
  }

  if (!user.is_active) {
    return <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">Inactive</span>;
  }
  if (user.must_change_pwd) {
    return <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">Pending login</span>;
  }
  return <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">Active</span>;
}
