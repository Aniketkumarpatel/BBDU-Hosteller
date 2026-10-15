import { useEffect, useRef } from 'react';

/** How often a visible screen asks the server again. 20 seconds is quick enough to feel live. */
export const LIVE_REFRESH_MS = 20000;

/**
 * Keeps a screen in step with what other people do (DEC-036). A problem is changed by three
 * different people (student, Warden, technician), so a screen that loads once goes stale and shows
 * "still waiting" for a problem that was fixed minutes ago.
 *
 * The refresh runs every 20 seconds while the screen is visible, and at once when the person comes
 * back to the tab, focuses the window or the phone gets its connection back. It never overlaps
 * itself, and it is paused while the tab is hidden so a phone in a pocket makes no requests.
 *
 * `refresh` should be a quiet load: it must keep the old data on screen when it fails.
 *
 * @param {() => Promise<unknown> | unknown} refresh
 * @param {number} [intervalMs]
 */
export default function useAutoRefresh(refresh, intervalMs = LIVE_REFRESH_MS) {
  const latest = useRef(refresh);
  const busy = useRef(false);

  useEffect(() => {
    latest.current = refresh;
  });

  useEffect(() => {
    const run = async () => {
      if (busy.current || document.visibilityState !== 'visible') return;
      busy.current = true;
      try {
        await latest.current();
      } catch {
        // a failed background refresh must never break the screen
      } finally {
        busy.current = false;
      }
    };

    const timer = setInterval(run, intervalMs);
    document.addEventListener('visibilitychange', run);
    window.addEventListener('focus', run);
    window.addEventListener('online', run);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', run);
      window.removeEventListener('focus', run);
      window.removeEventListener('online', run);
    };
  }, [intervalMs]);
}
