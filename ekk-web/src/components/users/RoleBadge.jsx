import { ROLE_DOT, ROLE_LABELS, ROLE_STYLES } from '../../constants/userConstants';

const sizes = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-xs px-2.5 py-1',
};

export default function RoleBadge({ userType, size = 'md' }) {
  const style = ROLE_STYLES[userType] || ROLE_STYLES.USER;
  const dot   = ROLE_DOT[userType]   || ROLE_DOT.USER;
  const label = ROLE_LABELS[userType] || userType;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium ${sizes[size]} ${style}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}
