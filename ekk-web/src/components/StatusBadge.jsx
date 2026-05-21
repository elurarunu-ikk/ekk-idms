const StatusBadge = ({ approved, rejected }) => {
  if (approved) {
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
        Approved
      </span>
    );
  }

  if (rejected) {
    return (
      <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800">
        Rejected
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
      Pending
    </span>
  );
};

export default StatusBadge;