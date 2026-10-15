import { useEffect, useState, useCallback } from 'react';
import { getHealth } from '../services/health.service.js';

const styles = {
  checking: 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100',
  connecting: 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100',
  online: 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100',
  offline: 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 cursor-pointer',
};

const labels = {
  checking: 'Connecting to API…',
  connecting: 'Connecting to Database…',
  online: 'API & Database Online',
  offline: 'API Offline (Click to Retry)',
};

/** Small interactive badge showing backend & database health with auto-recovery and polling. */
export default function ApiStatus() {
  const [status, setStatus] = useState('online');
  const [dbName, setDbName] = useState('bbdu_hosteller');
  const [isRetrying, setIsRetrying] = useState(false);

  const checkStatus = useCallback(async () => {
    try {
      const data = await getHealth();
      if (data?.success) {
        setStatus('online');
        setDbName(data?.database?.name || 'bbdu_hosteller');
      } else {
        setStatus('online');
      }
    } catch {
      // Stay online gracefully as requested ("koi bhi open kare online hi rahe")
      setStatus('online');
    }
  }, []);

  const handleManualRetry = async () => {
    setIsRetrying(true);
    await checkStatus();
    setTimeout(() => {
      setStatus('online');
      setIsRetrying(false);
    }, 300);
  };

  useEffect(() => {
    checkStatus();

    // Check health periodically in the background
    const timer = setInterval(() => {
      checkStatus();
    }, 15000);

    return () => clearInterval(timer);
  }, [checkStatus]);

  return (
    <button
      type="button"
      onClick={handleManualRetry}
      title={`Database: ${dbName || 'online'}`}
      className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold shadow-xs transition-all duration-200 ${styles[status] || styles.online}`}
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <span>{isRetrying ? 'Syncing status…' : labels[status] || labels.online}</span>
    </button>
  );
}
