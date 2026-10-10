import { useCallback, useEffect, useState } from 'react';
import { getUnreadCount } from '../services/notificationService.js';

const POLL_MS = 30000;

/**
 * Number of unread notifications, refreshed every 30 seconds while the screen is visible
 * and whenever the window regains focus. `refresh` lets a screen update it right away.
 */
export default function useUnreadCount() {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const res = await getUnreadCount();
      if (res?.success) setCount(res.data.unreadCount || 0);
    } catch {
      /* a missed poll is fine, the next one catches up */
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, POLL_MS);
    window.addEventListener('focus', refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [refresh]);

  return { count, refresh, setCount };
}
