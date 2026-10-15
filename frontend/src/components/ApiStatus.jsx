import { useEffect, useState, useCallback } from 'react';
import { getHealth } from '../services/health.service.js';

const styles = {
  checking: 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100',
  online: 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100',
  offline: 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 cursor-pointer',
};

const labels = {
  checking: 'Checking API…',
  online: 'API & Database Online',
  offline: 'API Offline (Click to Retry)',
};

/** Small interactive badge showing backend & database health with auto-recovery and polling. */
export default function ApiStatus() {
  const [status, setStatus] = useState('checking');
  const [dbName, setDbName] = useState(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const checkStatus = useCallback(async () => {
    try {
      const data = await getHealth();
      if (data?.success) {
        setStatus('online');
        setDbName(data?.database?.name || 'connected');
      } else {
        setStatus('offline');
      }
    } catch {
      setStatus('offline');
    }
  }, []);

  const handleManualRetry = async () => {
    setIsRetrying(true);
    setStatus('checking');
    await checkStatus();
    setTimeout(() => setIsRetrying(false), 400);
  };

  useEffect(() => {
    checkStatus();

    // Smart polling: check every 10s if online, every 4s if offline/reconnecting
    const intervalTime = status === 'online' ? 12000 : 4000;
    const timer = setInterval(() => {
      checkStatus();
    }, intervalTime);

    return () => clearInterval(timer);
  }, [checkStatus, status]);

  return (
    <button
      type="button"
      onClick={handleManualRetry}
      title={status === 'offline' ? 'Click to retry connection' : `Database: ${dbName || 'online'}`}
      className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold shadow-xs transition-all duration-200 ${styles[status]}`}
    >
      <span className="relative flex h-2 w-2">
        {status === 'online' && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        )}
        {status === 'checking' && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
        )}
        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${
            status === 'online'
              ? 'bg-emerald-500'
              : status === 'checking'
                ? 'bg-amber-500'
                : 'bg-rose-500'
          }`}
        />
      </span>
      <span>{isRetrying ? 'Retrying…' : labels[status]}</span>
      {status === 'offline' && (
        <svg className="h-3 w-3 text-rose-600 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      )}
    </button>
  );
}
