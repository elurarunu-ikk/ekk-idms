import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { useWizardStore } from '../../store/wizardStore';
import { SKIP_STEPS } from '../../constants/userConstants';
import {
  getUserPermissions, updateUserModules, saveFormRights, getApiErrorMessage, getUserById,
} from '../../services/apiService';
import ConfirmModal from '../../components/ConfirmModal';
import LoadingSpinner from '../../components/LoadingSpinner';
import WizardProgress from './wizard/WizardProgress';
import Step1BasicInfo from './wizard/Step1BasicInfo';
import Step2CompanySite from './wizard/Step2CompanySite';
import Step3Modules from './wizard/Step3Modules';
import Step4FormRights from './wizard/Step4FormRights';
import Step5Review from './wizard/Step5Review';

const STEP_META = [
  { number: 1, label: 'Identity' },
  { number: 2, label: 'Company & Sites' },
  { number: 3, label: 'Modules' },
  { number: 4, label: 'Form Rights' },
  { number: 5, label: 'Review' },
];

const variants = {
  enter:  (dir) => ({ x: dir > 0 ?  40 : -40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:   (dir) => ({ x: dir > 0 ? -40 :  40, opacity: 0 }),
};

export default function CreateUser() {
  const navigate        = useNavigate();
  const { id: editUserId } = useParams();
  const isEditMode      = Boolean(editUserId);

  const store           = useWizardStore();
  const { data }        = store;

  const [discardOpen, setDiscardOpen] = useState(false);
  const [direction,   setDirection]   = useState(1);
  const [saving,      setSaving]      = useState(false);
  const [editLoading, setEditLoading] = useState(isEditMode);
  const [editUserInfo, setEditUserInfo] = useState('');

  // ── Edit mode: load permissions and pre-populate store ──────────────────────
  useEffect(() => {
    if (!isEditMode) return;

    const load = async () => {
      setEditLoading(true);
      try {
        const [perms, user] = await Promise.all([
          getUserPermissions(editUserId),
          getUserById(editUserId),
        ]);
        store.reset();
        store.updateStep1({ user_type: perms.user_type || 'USER' });
        store.updateStep3(perms.module_ids || []);
        store.updateStep4(perms.form_rights || [], []);
        store.setStep(3);
        setEditUserInfo(user.full_name || user.username || 'User');
      } catch (err) {
        toast.error('Failed to load user permissions');
        navigate('/users');
      } finally {
        setEditLoading(false);
      }
    };
    load();
  }, [editUserId, isEditMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Step / skip logic ───────────────────────────────────────────────────────
  const userType  = data.user_type || 'USER';
  const skipSteps = isEditMode ? [1, 2, 5] : (SKIP_STEPS[userType] || []);
  const step      = data.step || 1;

  const allSteps     = STEP_META.map((s) => ({ ...s, skipped: skipSteps.includes(s.number) }));
  const visibleSteps = isEditMode
    ? allSteps.filter((s) => [3, 4].includes(s.number))
    : allSteps;

  function nextStep() {
    let next = step + 1;
    while (next < 5 && skipSteps.includes(next)) next++;
    setDirection(1);
    store.setStep(Math.min(next, 5));
  }

  function prevStep() {
    let prev = step - 1;
    while (prev > 1 && skipSteps.includes(prev)) prev--;
    setDirection(-1);
    store.setStep(Math.max(prev, 1));
  }

  function handleBack() {
    if (isEditMode) {
      if (step === 3) {
        navigate('/users');
      } else {
        prevStep();
      }
      return;
    }
    if (step === 1) {
      if (data.full_name || data.username) {
        setDiscardOpen(true);
      } else {
        navigate('/users');
      }
    } else {
      prevStep();
    }
  }

  // ── Edit mode save ───────────────────────────────────────────────────────────
  async function handleEditSave() {
    setSaving(true);
    try {
      await updateUserModules(editUserId, data.module_ids || []);
      await saveFormRights(editUserId, (data.form_rights || []).map((r) => ({
        form_id:     r.form_id,
        can_create:  r.can_create  || false,
        can_read:    r.can_read !== false,
        can_update:  r.can_update  || false,
        can_delete:  r.can_delete  || false,
        can_approve: r.can_approve || false,
      })), data.user_type || 'USER');
      toast.success('Access updated successfully');
      store.reset();
      navigate('/users');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to update access'));
    } finally {
      setSaving(false);
    }
  }

  // ── Next / submit ────────────────────────────────────────────────────────────
  function handleNext() {
    if (isEditMode && step === 4) {
      handleEditSave();
      return;
    }
    if (step === 2) {
      if (!data.is_all_sites && data.site_ids?.length === 0 && !['SUPER_ADMIN', 'SUPER ADMIN'].includes(userType)) {
        return;
      }
    }
    if (step === 3 && !['SUPER_ADMIN', 'SUPER ADMIN', 'SITE_ADMIN'].includes(userType) && data.module_ids?.length === 0) {
      return;
    }
    if (step === 4) {
      const hasErrors = (data.anomaly_findings || []).some((f) => f.severity === 'error');
      if (hasErrors) return;
    }
    nextStep();
  }

  const nextLabel = isEditMode && step === 4
    ? (saving ? 'Saving…' : 'Save Access')
    : 'Next →';

  const StepComponent = [Step1BasicInfo, Step2CompanySite, Step3Modules, Step4FormRights, Step5Review][step - 1];

  // ── Render ───────────────────────────────────────────────────────────────────
  if (editLoading) {
    return <LoadingSpinner fullPage={false} message="Loading user permissions…" />;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      {isEditMode ? (
        <div>
          <button
            type="button"
            onClick={() => navigate('/users')}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-3 transition"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Users
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Edit Access</h1>
          {editUserInfo && (
            <p className="text-base font-medium text-gray-700 mt-0.5">{editUserInfo}</p>
          )}
          <p className="text-sm text-gray-500 mt-0.5">
            Manage module access and form rights for this user
          </p>
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
            <motion.div key={step}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2, ease: 'easeInOut' }}
            >
              {step === 1 && !isEditMode ? (
                <Step1BasicInfo onNext={nextStep} />
              ) : (
                <>
                  <StepComponent />
                  {(step < 5 || (isEditMode && step === 4)) && (
                    <div className="mt-6 flex justify-end gap-3">
                      <button type="button" onClick={handleBack}
                        className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200">
                        ← Back
                      </button>
                      <button
                        type="button"
                        onClick={handleNext}
                        disabled={saving}
                        className="rounded-lg bg-primary-600 px-6 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {nextLabel}
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
