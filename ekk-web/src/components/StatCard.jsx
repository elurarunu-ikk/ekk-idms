const colorClasses = {
  gray: 'bg-gray-50 text-gray-800 border-gray-200',
  yellow: 'bg-amber-50 text-amber-800 border-amber-200',
  green: 'bg-green-50 text-green-800 border-green-200',
  red: 'bg-red-50 text-red-800 border-red-200',
};

const StatCard = ({ title, value, color = 'gray', onClick }) => {
  const clickable = Boolean(onClick);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      className={`w-full rounded-xl border p-6 text-left shadow-sm transition ${
        colorClasses[color] || colorClasses.gray
      } ${clickable ? 'hover:shadow-md' : 'cursor-default'}`}
    >
      <p className="text-sm font-medium uppercase tracking-wide">{title}</p>
      <p className="mt-3 text-3xl font-bold">{value}</p>
    </button>
  );
};

export default StatCard;