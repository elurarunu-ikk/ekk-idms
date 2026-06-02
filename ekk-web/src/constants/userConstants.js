export const USER_TYPES = ['SUPER_ADMIN', 'ADMIN', 'HO_USER', 'SITE_ADMIN', 'USER'];

export const USER_KIND = { INTERNAL: 'internal', EXTERNAL: 'external' };

export const ROLE_LABELS = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  HO_USER: 'HO User',
  SITE_ADMIN: 'Site Admin',
  USER: 'User',
  'SUPER ADMIN': 'Super Admin',
};

export const ROLE_STYLES = {
  SUPER_ADMIN:  'bg-yellow-50 text-yellow-800 border border-yellow-200',
  'SUPER ADMIN':'bg-yellow-50 text-yellow-800 border border-yellow-200',
  ADMIN:        'bg-blue-50 text-blue-800 border border-blue-200',
  HO_USER:      'bg-violet-50 text-violet-800 border border-violet-200',
  SITE_ADMIN:   'bg-teal-50 text-teal-800 border border-teal-200',
  USER:         'bg-gray-100 text-gray-700 border border-gray-200',
};

export const ROLE_DOT = {
  SUPER_ADMIN:  'bg-yellow-500',
  'SUPER ADMIN':'bg-yellow-500',
  ADMIN:        'bg-blue-500',
  HO_USER:      'bg-violet-500',
  SITE_ADMIN:   'bg-teal-500',
  USER:         'bg-gray-400',
};

export const ROLE_AVATAR_BG = {
  SUPER_ADMIN:  'bg-yellow-100 text-yellow-800',
  'SUPER ADMIN':'bg-yellow-100 text-yellow-800',
  ADMIN:        'bg-blue-100 text-blue-800',
  HO_USER:      'bg-violet-100 text-violet-800',
  SITE_ADMIN:   'bg-teal-100 text-teal-800',
  USER:         'bg-gray-100 text-gray-700',
};

export const CAN_CREATE = {
  SUPER_ADMIN:  ['SUPER_ADMIN', 'ADMIN', 'HO_USER', 'SITE_ADMIN', 'USER'],
  'SUPER ADMIN':['SUPER_ADMIN', 'ADMIN', 'HO_USER', 'SITE_ADMIN', 'USER'],
  ADMIN:        ['HO_USER', 'SITE_ADMIN', 'USER'],
  SITE_ADMIN:   ['USER'],
  HO_USER:      [],
  USER:         [],
};

export const SKIP_STEPS = {
  SUPER_ADMIN:  [2, 3, 4],
  'SUPER ADMIN':[2, 3, 4],
  SITE_ADMIN:   [4],
  ADMIN:        [],
  HO_USER:      [],
  USER:         [],
};

export const ANOMALY_SEVERITY = { ERROR: 'error', WARNING: 'warning' };

export const AUDIT_BADGE = {
  created:            'bg-green-100 text-green-700',
  role_changed:       'bg-violet-100 text-violet-700',
  permission_granted: 'bg-blue-100 text-blue-700',
  permission_revoked: 'bg-red-100 text-red-700',
  deactivated:        'bg-gray-100 text-gray-600',
  activated:          'bg-green-100 text-green-700',
  password_reset:     'bg-amber-100 text-amber-700',
  cloned:             'bg-teal-100 text-teal-700',
  updated:            'bg-slate-100 text-slate-700',
  impersonated:       'bg-orange-100 text-orange-700',
};
