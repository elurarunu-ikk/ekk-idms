const COLOR_CONFIG = {
  gray: {
    border: 'border-gray-100',
    title: 'text-gray-500',
    value: 'text-gray-900',
    icon: 'bg-gray-100 text-gray-500',
    hint: 'text-gray-400',
  },
  yellow: {
    border: 'border-amber-100',
    title: 'text-amber-600',
    value: 'text-amber-900',
    icon: 'bg-amber-50 text-amber-500',
    hint: 'text-amber-400',
  },
  green: {
    border: 'border-green-100',
    title: 'text-green-600',
    value: 'text-green-900',
    icon: 'bg-green-50 text-green-500',
    hint: 'text-green-400',
  },
  red: {
    border: 'border-red-100',
    title: 'text-red-600',
    value: 'text-red-900',
    icon: 'bg-red-50 text-red-500',
    hint: 'text-red-400',
  },
};

const ICON_PATHS = {
  gray: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  yellow: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0',
  green: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0',
  red: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0',
};

const StatCard = ({ title, value, color = 'gray', onClick }) => {
  const clickable = Boolean(onClick);
  const cfg = COLOR_CONFIG[color] || COLOR_CONFIG.gray;
  const iconPath = ICON_PATHS[color] || ICON_PATHS.gray;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      className={`w-full rounded-xl border bg-white p-5 text-left shadow-card transition ${cfg.border} ${
        clickable ? 'hover:shadow-card-hover hover:-translate-y-0.5' : 'cursor-default'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-xs font-semibold uppercase tracking-wider ${cfg.title}`}>{title}</p>
          <p className={`mt-2 text-3xl font-bold tabular-nums ${cfg.value}`}>{value}</p>
        </div>
        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${cfg.icon}`}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
            aria-hidden="true"
          >
            <path d={iconPath} />
          </svg>
        </div>
      </div>
      {clickable && (
        <p className={`mt-3 text-xs font-medium ${cfg.hint}`}>View details →</p>
      )}
    </button>
  );
};

export default StatCard;
