import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { useWizardStore } from '../../store/wizardStore';
import { getUserById, getUserProjectAccess, getApiErrorMessage } from '../../services/apiService';
import ConfirmModal from '../../components/ConfirmModal';
import LoadingSpinner from '../../components/LoadingSpinner';
import WizardProgress from './wizard/WizardProgress';
import Step1BasicInfo from './wizard/Step1BasicInfo';
import Step2AccessConfig from './wizard/Step2AccessConfig';
import Step3Review from './wizard/Step3Review';

const STEP_META = [
  { number: 1, label: 'Identity' },
  { number: 2, label: 'Site & Access' },
  { number: 3, label: 'Review' },
];

const variants = {
  enter:  (dir) => ({ x: dir > 0 ?  40 : -40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:   (dir) => ({ x: dir > 0 ? -40 :  40, opacity: 0 }),
};

// Reconstruct store access fields from saved UserProjectAccess rows.
function parseProjectAccess(rows, userType) {
  if (['SUPER_ADMIN', 'SUPER ADMIN'].includes(userType)) return {};

  if (['ADMIN', 'HO_USER'].includes(userType)) {
    const first = rows.find((r) => r.is_active);
    if (!first) return {};
    const perms = first.permissions_json || {};
    return {
      access_global_module_ids: Object.keys(perms),
      access_global_rights: perms,
    };
  }

  // SITE_ADMIN / USER
  const activeRows = rows.filter((r) => r.is_active);
  const siteIds = activeRows.map((r) => r.project_id);
  const siteConfigs = {};
  for (const row of activeRows) {
    const perms = row.permissions_json || {};
    siteConfigs[row.project_id] = { module_ids: Object.keys(perms), rights: perms };
  }
  return { access_site_ids: siteIds, access_site_configs: siteConfigs };
}

export default function CreateUser() {
  const navigate           = useNavigate();
  const { id: editUserId } = useParams();
  const isEditMode         = Boolean(editUserId);

  const store       = useWizardStore();
  const { data }    = store;

  const [discardOpen, setDiscardOpen] = useState(false);
  const [direction,   setDirection]   = useState(1);
  const [editLoading, setEditLoading] = useState(isEditMode);
  const [editUserInfo, setEditUserInfo] = useState('');

  const userType = data.user_type || 'USER';
  const step     = data.step || 1;

  const allSteps     = STEP_META.map((s) => ({ ...s, skipped: false }));
  const visibleSteps = isEditMode ? allSteps.filter((s) => [2, 3].includes(s.number)) : allSteps;

  // ── Edit mode: load project access and pre-populate store ───────────────────
  useEffect(() => {
    if (!isEditMode) return;

    const load = async () => {
      setEditLoading(true);
      try {
        const [user, accessRows] = await Promise.all([
          getUserById(editUserId),
          getUserProjectAccess(editUserId),
        ]);
        store.reset();
        store.updateStep1({ user_type: user.user_type || 'USER' });
        store.updateAccess(parseProjectAccess(accessRows, user.user_type || 'USER'));
        store.setStep(2);
        setEditUserInfo(user.full_name || user.username || 'User');
      } catch {
        toast.error('Failed to load user access');
        navigate('/users');
      } finally {
        setEditLoading(false);
      }
    };
    load();
  }, [editUserId, isEditMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Navigation ──────────────────────────────────────────────────────────────
  function nextStep() { setDirection(1);  store.setStep(Math.min(step + 1, 3)); }
  function prevStep() { setDirection(-1); store.setStep(Math.max(step - 1, 1)); }

  function handleBack() {
    if (isEditMode) { step === 2 ? navigate('/users') : prevStep(); return; }
    if (step === 1) {
      (data.full_name || data.username) ? setDiscardOpen(true) : navigate('/users');
    } else {
      prevStep();
    }
  }

  function handleNext() {
    if (step === 2) {
      const isSuper  = ['SUPER_ADMIN', 'SUPER ADMIN'].includes(userType);
      const isGlobal = ['ADMIN', 'HO_USER'].includes(userType);

      if (!isSuper) {
        if (isGlobal && (data.access_global_module_ids || []).length === 0) {
          toast.error('Select at least one module');
          return;
        }
        if (!isGlobal) {
          if ((data.access_site_ids || []).length === 0) {
            toast.error('Select at least one site');
            return;
          }
          const allHaveModules = (data.access_site_ids || []).every(
            (sid) => (data.access_site_configs?.[sid]?.module_ids || []).length > 0,
          );
          if (!allHaveModules) {
            toast.error('Each selected site needs at least one module');
            return;
          }
        }
      }
    }
    nextStep();
  }

  const StepComponent = [Step1BasicInfo, Step2AccessConfig, Step3Review][step - 1];

  if (editLoading) return <LoadingSpinner fullPage={false} message="Loading user access…" />;

  return (
    <div className="space-y-4">
      {/* Header */}
      {isEditMode ? (
        <div>
          <button type="button" onClick={() => navigate('/users')}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-3 transition">
            <ArrowLeft className="h-4 w-4" /> Back to Users
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Edit Access</h1>
          {editUserInfo && <p className="text-base font-medium text-gray-700 mt-0.5">{editUserInfo}</p>}
          <p className="text-sm text-gray-500 mt-0.5">Update project access and permissions</p>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <button type="button" onClick={handleBack}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Create new user</h1>
        </div>
      )}

      <div className="rounded-xl bg-white p-6 shadow-card">
        <WizardProgress currentStep={step} steps={visibleSteps} />

        <div className="mt-6 overflow-hidden">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div key={step} custom={direction} variants={variants}
              initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.2, ease: 'easeInOut' }}
            >
              {step === 1 && !isEditMode ? (
                <Step1BasicInfo onNext={nextStep} />
              ) : (
                <>
                  <StepComponent />
                  {/* Navigation footer — Back + Next for steps 1-2; Back only for step 3 (Review has its own submit) */}
                  {step < 3 && (
                    <div className="mt-6 flex justify-end gap-3">
                      <button type="button" onClick={handleBack}
                        className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200">
                        ← Back
                      </button>
                      <button type="button" onClick={handleNext}
                        className="rounded-lg bg-primary-600 px-6 py-2 text-sm font-medium text-white hover:bg-primary-700">
                        Next →
                      </button>
                    </div>
                  )}
                  {step === 3 && (
                    <div className="mt-4">
                      <button type="button" onClick={handleBack}
                        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
                        ← Back
                      </button>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <ConfirmModal
        isOpen={discardOpen}
        title="Discard unsaved user?"
        message="All changes will be lost. This cannot be undone."
        onConfirm={() => { store.reset(); navigate('/users'); }}
        onCancel={() => setDiscardOpen(false)}
        confirmLabel="Discard"
        confirmClassName="bg-red-600 hover:bg-red-700"
      />
    </div>
  );
}
