"use client";

import { useEffect } from "react";

export const REFRESH_MS = 2 * 60 * 1000;

export function useAutoRefresh(callback: () => void | Promise<void>, deps: any[] = []) {
  useEffect(() => {
    let alive = true;

    const run = async () => {
      try {
        await callback();
      } catch {
        // swallow — individual components handle their own error UI
      }
    };

    run();
    const id = setInterval(() => {
      if (!alive) return;
      run();
    }, REFRESH_MS);

    return () => {
      alive = false;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
