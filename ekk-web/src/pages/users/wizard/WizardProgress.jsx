import { Check } from 'lucide-react';

export default function WizardProgress({ currentStep, steps }) {
  return (
    <>
      {/* Desktop */}
      <div className="hidden items-center md:flex">
        {steps.map((step, i) => {
          const isCompleted = step.number < currentStep && !step.skipped;
          const isCurrent   = step.number === currentStep;
          const isSkipped   = step.skipped;

          return (
            <div key={step.number} className="flex flex-1 items-center">
              <div className="flex flex-col items-center">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold
                  ${isCompleted ? 'bg-green-500 text-white'
                  : isCurrent   ? 'bg-primary-600 text-white'
                  : isSkipped   ? 'border-2 border-dashed border-gray-300 bg-gray-100 text-gray-400'
                  : 'border-2 border-gray-200 bg-white text-gray-400'}`}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : isSkipped ? <Check className="h-3 w-3" /> : step.number}
                </div>
                <span className={`mt-1 text-xs font-medium ${isCurrent ? 'text-primary-600' : isSkipped ? 'text-gray-400' : 'text-gray-500'}`}>
                  {step.label}
                  {isSkipped && <span className="ml-1 text-gray-400">(auto)</span>}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className={`mx-2 mb-5 h-0.5 flex-1 ${step.number < currentStep ? 'bg-primary-500' : 'bg-gray-200'}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile */}
      <div className="md:hidden">
        <p className="text-sm font-medium text-gray-600">
          Step {currentStep} of {steps.length} —{' '}
          <span className="text-primary-600 font-semibold">
            {steps.find((s) => s.number === currentStep)?.label}
          </span>
        </p>
        <div className="mt-1 flex gap-1">
          {steps.map((s) => (
            <div key={s.number} className={`h-1 flex-1 rounded-full ${s.number <= currentStep ? 'bg-primary-500' : 'bg-gray-200'}`} />
          ))}
        </div>
      </div>
    </>
  );
}
