import { ROLE_AVATAR_BG } from '../../constants/userConstants';

const sizes = {
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-11 h-11 text-base',
};

function getInitials(fullName) {
  if (!fullName) return '?';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function UserAvatar({ fullName, userType, size = 'md' }) {
  const bg = ROLE_AVATAR_BG[userType] || ROLE_AVATAR_BG.USER;
  return (
    <div className={`flex items-center justify-center rounded-full font-semibold ${sizes[size]} ${bg}`}>
      {getInitials(fullName)}
    </div>
  );
}
