"use client";

import { useEffect, useRef } from "react";

export const REFRESH_MS = 60 * 1000;

// Minimum gap to avoid double refresh when tab becomes visible + interval overlaps
const MIN_GAP_MS = 8 * 1000;

export function useAutoRefresh(callback: () => void | Promise<void>, deps: any[] = []) {
  const lastRunRef = useRef<number>(0);
  const runningRef = useRef<boolean>(false);

  useEffect(() => {
    let alive = true;

    const run = async (force = false) => {
      if (!alive) return;

      const now = Date.now();
      if (!force && now - lastRunRef.current < MIN_GAP_MS) return;
      if (runningRef.current) return;

      runningRef.current = true;
      lastRunRef.current = now;

      try {
        await callback();
      } catch {
        // swallow — individual components handle their own error UI
      } finally {
        runningRef.current = false;
      }
    };

    // initial load
    run(true);

    const id = setInterval(() => {
      run(false);
    }, REFRESH_MS);

    const onVis = () => {
      if (document.visibilityState === "visible") {
        // When user returns to tab, refresh immediately in background (silent)
        run(false);
      }
    };

    document.addEventListener("visibilitychange", onVis);

    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
