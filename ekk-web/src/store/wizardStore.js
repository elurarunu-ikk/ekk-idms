import { create } from 'zustand';

const emptyWizard = {
  step: 1,
  user_kind: 'internal',
  user_type: '',
  username: '',
  full_name: '',
  emp_id: '',
  organisation: '',
  department: '',
  designation: '',
  email: '',
  phone: '',
  password: '',
  confirm_password: '',
  expires_at: null,
  company_id: '',
  site_ids: [],
  is_all_sites: false,
  module_ids: [],
  form_rights: [],
  anomaly_findings: [],
  role_suggestion: null,
  hr_prefill_used: false,
};

export const useWizardStore = create((set) => ({
  data: { ...emptyWizard },
  setStep: (step) => set((s) => ({ data: { ...s.data, step } })),
  updateStep1: (fields) => set((s) => ({ data: { ...s.data, ...fields } })),
  updateStep2: (fields) => set((s) => ({ data: { ...s.data, ...fields } })),
  updateStep3: (module_ids) => set((s) => ({ data: { ...s.data, module_ids } })),
  updateStep4: (form_rights, anomaly_findings) =>
    set((s) => ({ data: { ...s.data, form_rights, anomaly_findings } })),
  setRoleSuggestion: (role_suggestion) =>
    set((s) => ({ data: { ...s.data, role_suggestion } })),
  reset: () => set({ data: { ...emptyWizard } }),
}));
