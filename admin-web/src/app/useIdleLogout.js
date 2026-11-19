import { useEffect, useRef } from 'react';

/** Admin sessions end after this long without any mouse, key, touch or scroll activity. */
export const IDLE_LIMIT_MS = 30 * 60 * 1000;

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'];
const CHECK_EVERY_MS = 15 * 1000;

/**
 * Calls `onIdle` once when the admin has done nothing for `limitMs`. A tab that was asleep (laptop
 * closed) is checked again the moment it becomes visible, so a stale screen is not left open.
 * Background requests (menu badges) are not activity.
 *
 * @param {{limitMs?: number, onIdle: () => void, enabled?: boolean}} options
 */
export function useIdleLogout({ limitMs = IDLE_LIMIT_MS, onIdle, enabled = true }) {
  const onIdleRef = useRef(onIdle);
  useEffect(() => {
    onIdleRef.current = onIdle;
  });

  useEffect(() => {
    if (!enabled) return undefined;
    let last = Date.now();
    let fired = false;
    const touch = () => {
      last = Date.now();
    };
    const check = () => {
      if (!fired && Date.now() - last >= limitMs) {
        fired = true;
        onIdleRef.current();
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    for (const name of ACTIVITY_EVENTS) window.addEventListener(name, touch, { passive: true });
    document.addEventListener('visibilitychange', onVisible);
    const timer = setInterval(check, CHECK_EVERY_MS);
    return () => {
      for (const name of ACTIVITY_EVENTS) window.removeEventListener(name, touch);
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(timer);
    };
  }, [limitMs, enabled]);
}
