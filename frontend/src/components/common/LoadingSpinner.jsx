export default function LoadingSpinner({ size = 'md', text = 'Loading...' }) {
  const sizeClasses = {
    sm: 'h-4 w-4 border-2',
    md: 'h-6 w-6 border-2',
    lg: 'h-10 w-10 border-3',
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 text-slate-500">
      <div
        className={`${sizeClasses[size] || sizeClasses.md} animate-spin rounded-full border-indigo-600 border-t-transparent`}
      />
      {text && <p className="mt-3 text-xs font-medium text-slate-500">{text}</p>}
    </div>
  );
}
