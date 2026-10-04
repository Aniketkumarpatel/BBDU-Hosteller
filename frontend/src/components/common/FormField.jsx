export default function FormField({
  label,
  name,
  error,
  required = false,
  helperText,
  children,
  className = '',
}) {
  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label
          htmlFor={name}
          className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
        >
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}
      {children}
      {helperText && !error && (
        <p className="text-[11px] text-slate-500">{helperText}</p>
      )}
      {error && <p className="text-[11px] font-medium text-rose-600">{error}</p>}
    </div>
  );
}
