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
  // Legacy fields — kept so Step1's role-suggestion pre-fill (updateStep3) still compiles
  company_id: '',
  site_ids: [],
  is_all_sites: false,
  module_ids: [],
  form_rights: [],
  anomaly_findings: [],
  role_suggestion: null,
  hr_prefill_used: false,
  // New access config written by Step2AccessConfig and consumed by Step3Review
  access_global_module_ids: [],  // ADMIN / HO_USER
  access_global_rights: {},      // HO_USER: { [moduleId]: { view, add, edit, delete, approve } }
  access_site_ids: [],           // SITE_ADMIN / USER
  access_site_configs: {},       // { [siteId]: { module_ids: [], rights: {} } }
};

export const useWizardStore = create((set) => ({
  data: { ...emptyWizard },
  setStep: (step) => set((s) => ({ data: { ...s.data, step } })),
  updateStep1: (fields) => set((s) => ({ data: { ...s.data, ...fields } })),
  updateStep2: (fields) => set((s) => ({ data: { ...s.data, ...fields } })),
  updateStep3: (module_ids) => set((s) => ({ data: { ...s.data, module_ids } })),
  updateStep4: (form_rights, anomaly_findings) =>
    set((s) => ({ data: { ...s.data, form_rights, anomaly_findings } })),
  updateAccess: (fields) => set((s) => ({ data: { ...s.data, ...fields } })),
  setRoleSuggestion: (role_suggestion) =>
    set((s) => ({ data: { ...s.data, role_suggestion } })),
  reset: () => set({ data: { ...emptyWizard } }),
}));
