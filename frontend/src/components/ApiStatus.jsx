import { useEffect, useState } from 'react';
import { getHealth } from '../services/health.service.js';

const styles = {
  checking: 'bg-slate-100 text-slate-600',
  online: 'bg-emerald-100 text-emerald-700',
  offline: 'bg-red-100 text-red-700',
};

const labels = {
  checking: 'Checking API…',
  online: 'API online',
  offline: 'API offline',
};

/** Small badge showing whether the backend /api/health endpoint is reachable. */
export default function ApiStatus() {
  const [status, setStatus] = useState('checking');

  useEffect(() => {
    let active = true;
    getHealth()
      .then((data) => active && setStatus(data?.success ? 'online' : 'offline'))
      .catch(() => active && setStatus('offline'));
    return () => {
      active = false;
    };
  }, []);

  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${styles[status]}`}>
      <span className="h-2 w-2 rounded-full bg-current" />
      {labels[status]}
    </span>
  );
}
