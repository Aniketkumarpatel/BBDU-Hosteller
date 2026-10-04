export default function FilterSelect({
  label,
  value,
  onChange,
  options = [],
  placeholder = 'All',
  className = '',
}) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {label && <label className="text-xs font-medium text-slate-600 whitespace-nowrap">{label}:</label>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-slate-300 bg-white py-1.5 pr-8 pl-2.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-200"
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => {
          const val = typeof opt === 'object' ? opt.value : opt;
          const lbl = typeof opt === 'object' ? opt.label : opt;
          return (
            <option key={val} value={val}>
              {lbl}
            </option>
          );
        })}
      </select>
    </div>
  );
}
