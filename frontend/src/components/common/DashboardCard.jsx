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
    indigo: 'bg-indigo-50/80 text-indigo-600 border-indigo-100/80',
    blue: 'bg-blue-50/80 text-blue-600 border-blue-100/80',
    emerald: 'bg-emerald-50/80 text-emerald-600 border-emerald-100/80',
    amber: 'bg-amber-50/80 text-amber-600 border-amber-100/80',
    rose: 'bg-rose-50/80 text-rose-600 border-rose-100/80',
    purple: 'bg-purple-50/80 text-purple-600 border-purple-100/80',
    teal: 'bg-teal-50/80 text-teal-600 border-teal-100/80',
    cyan: 'bg-cyan-50/80 text-cyan-600 border-cyan-100/80',
    slate: 'bg-slate-50/80 text-slate-600 border-slate-200/80',
  };

  const topBorderMap = {
    indigo: 'border-t-indigo-500',
    blue: 'border-t-blue-500',
    emerald: 'border-t-emerald-500',
    amber: 'border-t-amber-500',
    rose: 'border-t-rose-500',
    purple: 'border-t-purple-500',
    teal: 'border-t-teal-500',
    cyan: 'border-t-cyan-500',
    slate: 'border-t-slate-400',
  };

  return (
    <div
      onClick={onClick}
      className={`group relative overflow-hidden rounded-xl border border-slate-200/90 border-t-2 ${
        topBorderMap[color] || topBorderMap.indigo
      } bg-white p-5 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
        onClick ? 'cursor-pointer hover:border-slate-300' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{title}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold tracking-tight text-slate-900">
              {loading ? (
                <span className="inline-block h-6 w-12 animate-pulse rounded-md bg-slate-200" />
              ) : (
                value ?? 0
              )}
            </span>
            {badge && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                {badge}
              </span>
            )}
          </div>
          {subtitle && <p className="text-xs text-slate-500 font-normal leading-tight">{subtitle}</p>}
        </div>

        {icon && (
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-transform duration-200 group-hover:scale-105 ${
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
