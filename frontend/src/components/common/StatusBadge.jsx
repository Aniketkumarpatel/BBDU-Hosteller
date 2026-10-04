export default function StatusBadge({ status, label }) {
  const isActive = status === true || status === 'active' || status === 'ACTIVE';

  if (status !== undefined && (typeof status === 'boolean' || status === 'active' || status === 'inactive')) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
          isActive
            ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20'
            : 'bg-slate-100 text-slate-600 ring-1 ring-slate-500/20'
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-emerald-600' : 'bg-slate-400'}`} />
        {label || (isActive ? 'Active' : 'Inactive')}
      </span>
    );
  }

  // Role or generic badge
  const roleColors = {
    SUPER_ADMIN: 'bg-rose-50 text-rose-700 ring-rose-600/20',
    AUTHORITY: 'bg-purple-50 text-purple-700 ring-purple-600/20',
    WARDEN: 'bg-blue-50 text-blue-700 ring-blue-600/20',
    HOSTEL_STAFF: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    STUDENT: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  };

  const colorClass = roleColors[status] || 'bg-slate-100 text-slate-700 ring-slate-500/20';

  return (
    <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ${colorClass}`}>
      {label || status}
    </span>
  );
}
