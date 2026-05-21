const LoadingSpinner = ({ fullPage = false, message = 'Loading...' }) => {
  const wrapperClass = fullPage
    ? 'fixed inset-0 z-50 flex items-center justify-center bg-white/70'
    : 'flex items-center justify-center py-10';

  return (
    <div className={wrapperClass}>
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
        <p className="text-sm text-gray-600">{message}</p>
      </div>
    </div>
  );
};

export default LoadingSpinner;