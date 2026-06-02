import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { useWizardStore } from '../../store/wizardStore';
import { SKIP_STEPS } from '../../constants/userConstants';
import ConfirmModal from '../../components/ConfirmModal';
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
  enter: (dir) => ({ x: dir > 0 ? 40 : -40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:  (dir) => ({ x: dir > 0 ? -40 : 40, opacity: 0 }),
};

export default function CreateUser() {
  const navigate   = useNavigate();
  const store      = useWizardStore();
  const { data }   = store;
  const [discardOpen, setDiscardOpen] = useState(false);
  const [direction, setDirection]     = useState(1);

  const userType  = data.user_type || 'USER';
  const skipSteps = SKIP_STEPS[userType] || [];
  const step      = data.step || 1;

  const steps = STEP_META.map((s) => ({ ...s, skipped: skipSteps.includes(s.number) }));

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

  const StepComponent = [Step1BasicInfo, Step2CompanySite, Step3Modules, Step4FormRights, Step5Review][step - 1];

  // Validate before advancing (steps 2-4 have inline next buttons or simple checks)
  function handleNext() {
    if (step === 2) {
      if (!data.is_all_sites && data.site_ids?.length === 0 && !['SUPER_ADMIN','SUPER ADMIN'].includes(userType)) {
        return; // Could show toast here
      }
    }
    if (step === 3 && !['SUPER_ADMIN','SUPER ADMIN','SITE_ADMIN'].includes(userType) && data.module_ids?.length === 0) {
      return;
    }
    if (step === 4) {
      const hasErrors = (data.anomaly_findings || []).some((f) => f.severity === 'error');
      if (hasErrors) return;
    }
    nextStep();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button type="button" onClick={handleBack}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Create new user</h1>
      </div>

      <div className="rounded-xl bg-white p-6 shadow-card">
        <WizardProgress currentStep={step} steps={steps} />

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
              {step === 1 ? (
                <Step1BasicInfo onNext={nextStep} />
              ) : (
                <>
                  <StepComponent />
                  {step < 5 && (
                    <div className="mt-6 flex justify-end gap-3">
                      <button type="button" onClick={prevStep}
                        className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200">
                        ← Back
                      </button>
                      <button type="button" onClick={handleNext}
                        className="rounded-lg bg-primary-600 px-6 py-2 text-sm font-medium text-white hover:bg-primary-700">
                        Next →
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
