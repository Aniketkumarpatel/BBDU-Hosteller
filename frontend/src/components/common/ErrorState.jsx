export default function ErrorState({
  message = 'An unexpected error occurred.',
  onRetry,
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50/50 p-8 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h3 className="mt-3 text-sm font-semibold text-red-900">Failed to load content</h3>
      <p className="mt-1 text-xs text-red-700 max-w-sm">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-red-700"
        >
          Try Again
        </button>
      )}
    </div>
  );
}
