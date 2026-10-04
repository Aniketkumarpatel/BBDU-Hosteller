export default function DashboardCard({
  title,
  value,
  subtitle,
  icon,
  color = 'indigo',
  loading = false,
  badge,
  onClick,
}) {
  const colorMap = {
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
    slate: 'bg-slate-50 text-slate-600 border-slate-100',
  };

  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition hover:shadow-sm ${
        onClick ? 'cursor-pointer hover:border-slate-300' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500">{title}</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-slate-900">
              {loading ? (
                <span className="inline-block h-6 w-12 animate-pulse rounded-md bg-slate-200" />
              ) : (
                value ?? 0
              )}
            </span>
            {badge && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                {badge}
              </span>
            )}
          </div>
          {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
        </div>

        {icon && (
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${
              colorMap[color] || colorMap.indigo
            }`}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
