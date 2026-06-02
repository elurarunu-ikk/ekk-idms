import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Search, User } from 'lucide-react';
import { useWizardStore } from '../../../store/wizardStore';
import { CAN_CREATE, ROLE_LABELS, USER_TYPES } from '../../../constants/userConstants';
import { getApiErrorMessage, getRoleSuggestion, listUsersV2, lookupHR } from '../../../services/apiService';
import toast from 'react-hot-toast';

const schema = (kind) => z.object({
  full_name:        z.string().min(2, 'Full name required'),
  username:         z.string().min(3).max(30).regex(/^[a-z0-9_]+$/, 'Lowercase letters, numbers, underscores only'),
  user_type:        z.string().min(1, 'Select a role'),
  password:         z.string().min(8, 'Minimum 8 characters'),
  confirm_password: z.string(),
  email:            z.string().min(1, 'Email is required').email('Invalid email'),
  phone:            z.string().optional(),
  emp_id:           z.string().optional(),
  organisation:     kind === 'external' ? z.string().min(1, 'Organisation required') : z.string().optional(),
  expires_at:       kind === 'external' ? z.string().min(1, 'Expiry date required') : z.string().optional(),
}).refine((d) => d.password === d.confirm_password, {
  message: 'Passwords do not match', path: ['confirm_password'],
});

function passwordStrength(pw = '') {
  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { level: 1, label: 'Weak',   color: 'bg-red-400' };
  if (score <= 2) return { level: 2, label: 'Fair',   color: 'bg-orange-400' };
  if (score <= 3) return { level: 3, label: 'Good',   color: 'bg-yellow-400' };
  return               { level: 4, label: 'Strong',  color: 'bg-green-500' };
}

export default function Step1BasicInfo({ onNext }) {
  const store = useWizardStore();
  const { data } = store;
  const [kind, setKind] = useState(data.user_kind || 'internal');
  const [showPw, setShowPw] = useState(false);
  const [hrQuery, setHrQuery] = useState('');
  const [hrResults, setHrResults] = useState([]);
  const [hrPrefilled, setHrPrefilled] = useState(data.hr_prefill_used);
  const [usernameStatus, setUsernameStatus] = useState(null); // 'available' | 'taken' | null
  const [suggestion, setSuggestion] = useState(data.role_suggestion);
  const hrTimer = useRef(null);
  const unTimer = useRef(null);
  const sugTimer = useRef(null);

  const myType = localStorage.getItem('user_type') || 'SUPER_ADMIN';
  const allowedTypes = CAN_CREATE[myType] || USER_TYPES;

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(schema(kind)),
    defaultValues: {
      full_name: data.full_name, username: data.username,
      user_type: data.user_type, password: data.password,
      confirm_password: data.confirm_password, email: data.email,
      phone: data.phone, emp_id: data.emp_id,
      organisation: data.organisation, expires_at: data.expires_at || '',
    },
  });

  const pw = watch('password', '');
  const username = watch('username', '');
  const designation = watch('designation', data.designation || '');

  // HR lookup debounce
  useEffect(() => {
    if (!hrQuery || kind !== 'internal') { setHrResults([]); return; }
    clearTimeout(hrTimer.current);
    hrTimer.current = setTimeout(async () => {
      try {
        const res = await lookupHR(hrQuery);
        setHrResults(res.results || []);
      } catch { setHrResults([]); }
    }, 400);
  }, [hrQuery, kind]);

  // Username availability debounce
  useEffect(() => {
    if (!username || username.length < 3) { setUsernameStatus(null); return; }
    clearTimeout(unTimer.current);
    unTimer.current = setTimeout(async () => {
      try {
        const res = await listUsersV2({ q: username, limit: 1 });
        const exact = (res.items || []).some((u) => u.username === username);
        setUsernameStatus(exact ? 'taken' : 'available');
      } catch { setUsernameStatus(null); }
    }, 300);
  }, [username]);

  // Role suggestion on designation blur
  async function handleDesignationBlur(e) {
    const desg = e.target.value;
    if (!desg) return;
    clearTimeout(sugTimer.current);
    sugTimer.current = setTimeout(async () => {
      try {
        const res = await getRoleSuggestion(desg, watch('department') || '');
        if (res?.user_type) { setSuggestion(res); store.setRoleSuggestion(res); }
      } catch {}
    }, 500);
  }

  function applyHR(emp) {
    setValue('full_name',    emp.full_name);
    setValue('emp_id',       emp.emp_id);
    setValue('email',        emp.email || '');
    setValue('phone',        emp.phone || '');
    store.updateStep1({ department: emp.department || '', designation: emp.designation || '' });
    setHrPrefilled(true);
    setHrResults([]);
    setHrQuery('');
  }

  function applySuggestion() {
    setValue('user_type', suggestion.user_type);
    store.updateStep3(suggestion.module_ids || []);
    setSuggestion(null);
  }

  function onSubmit(values) {
    store.updateStep1({ ...values, user_kind: kind, hr_prefill_used: hrPrefilled });
    onNext();
  }

  const strength = passwordStrength(pw);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Kind toggle */}
      <div>
        <p className="mb-2 text-sm font-medium text-gray-700">User kind</p>
        <div className="flex gap-3">
          {['internal', 'external'].map((k) => (
            <button key={k} type="button"
              onClick={() => setKind(k)}
              className={`flex-1 rounded-lg py-2.5 text-sm font-semibold capitalize transition
                ${kind === k
                  ? k === 'internal' ? 'bg-primary-600 text-white' : 'bg-amber-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      {/* Internal: HR lookup */}
      {kind === 'internal' && (
        <div className="relative">
          <label className="mb-1 block text-sm font-medium text-gray-700">Search HR (Emp ID or Name)</label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input value={hrQuery} onChange={(e) => setHrQuery(e.target.value)}
              placeholder="Search employee..."
              className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" />
          </div>
          {hrResults.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
              {hrResults.slice(0, 5).map((emp) => (
                <button key={emp.emp_id} type="button" onClick={() => applyHR(emp)}
                  className="flex w-full items-start gap-3 px-3 py-2 text-left hover:bg-gray-50">
                  <User className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{emp.full_name}</p>
                    <p className="text-xs text-gray-500">{emp.emp_id} · {emp.department} — {emp.designation}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          {hrPrefilled && (
            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
              ✓ Pre-filled from HR
            </span>
          )}
        </div>
      )}

      {/* External: organisation + expiry */}
      {kind === 'external' && (
        <>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Organisation *</label>
            <input {...register('organisation')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" />
            {errors.organisation && <p className="mt-1 text-xs text-red-600">{errors.organisation.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Access expiry *</label>
            <input type="date" {...register('expires_at')} min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none" />
            {errors.expires_at && <p className="mt-1 text-xs text-red-600">{errors.expires_at.message}</p>}
            <p className="mt-1 text-xs text-amber-600">⚠ Access auto-revokes on this date</p>
          </div>
        </>
      )}

      {/* Common fields */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Full name *</label>
          <input {...register('full_name')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" />
          {errors.full_name && <p className="mt-1 text-xs text-red-600">{errors.full_name.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Username *</label>
          <input {...register('username')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" />
          {usernameStatus === 'available' && <p className="mt-1 text-xs text-green-600">✓ Available</p>}
          {usernameStatus === 'taken'     && <p className="mt-1 text-xs text-red-600">✗ Already taken</p>}
          {errors.username && <p className="mt-1 text-xs text-red-600">{errors.username.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Role *</label>
          <select {...register('user_type')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none">
            <option value="">— Select role —</option>
            {allowedTypes.map((t) => (
              <option key={t} value={t}>{ROLE_LABELS[t] || t}</option>
            ))}
          </select>
          {errors.user_type && <p className="mt-1 text-xs text-red-600">{errors.user_type.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Designation</label>
          <input defaultValue={data.designation} {...register('designation')}
            onBlur={handleDesignationBlur}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Email *</label>
          <input type="email" {...register('email')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Phone <span className="text-gray-400">(optional)</span></label>
          <input {...register('phone')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none" />
        </div>
      </div>

      {/* Role suggestion */}
      {suggestion && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
          <p className="text-sm font-medium text-blue-800">
            💡 Suggested: {ROLE_LABELS[suggestion.user_type]} · {Math.round((suggestion.confidence || 0) * 100)}% match
          </p>
          <p className="mt-0.5 text-xs text-blue-600">{suggestion.reason}</p>
          <button type="button" onClick={applySuggestion}
            className="mt-2 rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700">
            Apply suggestion
          </button>
        </div>
      )}

      {/* Password */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Password *</label>
          <div className="relative">
            <input type={showPw ? 'text' : 'password'} {...register('password')}
              className="w-full rounded-lg border border-gray-300 py-2 pl-3 pr-9 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" />
            <button type="button" onClick={() => setShowPw((v) => !v)}
              className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600">
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {pw && (
            <div className="mt-1.5">
              <div className="flex gap-1">
                {[1,2,3,4].map((n) => (
                  <div key={n} className={`h-1 flex-1 rounded-full transition-all ${n <= strength.level ? strength.color : 'bg-gray-200'}`} />
                ))}
              </div>
              <p className="mt-0.5 text-xs text-gray-500">{strength.label}</p>
            </div>
          )}
          {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Confirm password *</label>
          <input type={showPw ? 'text' : 'password'} {...register('confirm_password')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" />
          {errors.confirm_password && <p className="mt-1 text-xs text-red-600">{errors.confirm_password.message}</p>}
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button type="submit" className="rounded-lg bg-primary-600 px-6 py-2 text-sm font-medium text-white hover:bg-primary-700">
          Next →
        </button>
      </div>
    </form>
  );
}
