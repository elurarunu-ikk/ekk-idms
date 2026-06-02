import { AlertTriangle } from 'lucide-react';
import { ROLE_LABELS } from '../../constants/userConstants';
import { endImpersonation } from '../../services/apiService';
import toast from 'react-hot-toast';

export default function ImpersonationBanner({ targetUser, onEnd }) {
  async function handleEnd() {
    try {
      await endImpersonation();
    } catch {
      // ignore — always clear local state
    }
    const original = localStorage.getItem('original_token');
    if (original) localStorage.setItem('token', original);
    localStorage.removeItem('impersonation');
    localStorage.removeItem('original_token');
    toast.success('Impersonation ended');
    onEnd?.();
  }

  return (
    <div className="flex items-center justify-between border-b border-amber-200 bg-amber-50 px-4 py-2">
      <div className="flex items-center gap-2 text-sm text-amber-800">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
        <span>
          You are viewing IDMS as{' '}
          <strong>{targetUser?.full_name}</strong>
          {' '}({ROLE_LABELS[targetUser?.user_type] || targetUser?.user_type}).{' '}
          All actions are logged.
        </span>
      </div>
      <button
        type="button"
        onClick={handleEnd}
        className="rounded-md bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-200"
      >
        End session
      </button>
    </div>
  );
}
