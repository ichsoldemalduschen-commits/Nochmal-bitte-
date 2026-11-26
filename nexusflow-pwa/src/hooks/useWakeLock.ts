import { useEffect, useRef, useState } from 'react';

interface WakeLockSentinelLike {
  released?: boolean;
  release: () => Promise<void>;
  addEventListener?: (type: 'release', listener: () => void) => void;
  removeEventListener?: (type: 'release', listener: () => void) => void;
}

interface NavigatorWithWakeLock {
  wakeLock?: {
    request: (type: 'screen') => Promise<WakeLockSentinelLike>;
  };
}

export interface UseWakeLockResult {
  isSupported: boolean;
  isActive: boolean;
}

/**
 * Isolierter, absturzsicherer Screen-Wake-Lock-Hook für den Werkstatt-Einsatz.
 * Fordert bei active=true & sichtbarem Tab den Screen-Lock an, gibt ihn bei
 * active=false oder Unmount frei und fängt fehlende APIs/Berechtigungsfehler still ab.
 */
export function useWakeLock(active: boolean): UseWakeLockResult {
  const isSupported =
    typeof navigator !== 'undefined' &&
    typeof (navigator as unknown as NavigatorWithWakeLock).wakeLock?.request === 'function';

  const [isActive, setIsActive] = useState(false);
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    if (!isSupported) {
      setIsActive(false);
      return;
    }

    let cancelled = false;
    let currentReleaseHandler: (() => void) | null = null;
    let currentSentinel: WakeLockSentinelLike | null = null;

    const releaseCurrent = async () => {
      const sentinel = sentinelRef.current;
      sentinelRef.current = null;
      if (sentinel && currentReleaseHandler && sentinel.removeEventListener) {
        try {
          sentinel.removeEventListener('release', currentReleaseHandler);
        } catch {
          // ignore
        }
      }
      currentReleaseHandler = null;
      currentSentinel = null;
      if (sentinel && !sentinel.released) {
        try {
          await sentinel.release();
        } catch {
          // ignore
        }
      }
      if (!cancelled) {
        setIsActive(false);
      }
    };

    const requestLock = async () => {
      if (cancelled || !activeRef.current) return;
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }
      const nav = navigator as unknown as NavigatorWithWakeLock;
      if (!nav.wakeLock?.request) return;

      if (sentinelRef.current && !sentinelRef.current.released) {
        setIsActive(true);
        return;
      }

      try {
        const sentinel = await nav.wakeLock.request('screen');
        if (cancelled || !activeRef.current) {
          try {
            await sentinel.release();
          } catch {
            // ignore
          }
          return;
        }
        currentSentinel = sentinel;
        sentinelRef.current = sentinel;
        const onRelease = () => {
          if (sentinelRef.current === sentinel) {
            sentinelRef.current = null;
          }
          if (!cancelled) {
            setIsActive(false);
          }
        };
        currentReleaseHandler = onRelease;
        if (sentinel.addEventListener) {
          try {
            sentinel.addEventListener('release', onRelease);
          } catch {
            // ignore
          }
        }
        setIsActive(true);
      } catch {
        // Graceful No-Op bei verweigerter Berechtigung, Energiesparmodus oder Headless-Umgebung
        if (!cancelled) {
          setIsActive(false);
        }
      }
    };

    if (active) {
      void requestLock();
    } else {
      void releaseCurrent();
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && activeRef.current) {
        void requestLock();
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      cancelled = true;
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      if (currentSentinel && currentReleaseHandler && currentSentinel.removeEventListener) {
        try {
          currentSentinel.removeEventListener('release', currentReleaseHandler);
        } catch {
          // ignore
        }
      }
      void releaseCurrent();
    };
  }, [active, isSupported]);

  return { isSupported, isActive };
}
