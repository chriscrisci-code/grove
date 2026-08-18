"use client";

import { useCallback, useLayoutEffect, useState } from "react";
import {
  NIGHT_EVENT,
  applyNightTheme,
  readNightTheme,
} from "@/features/workspace/night-theme";

export function NightToggle() {
  const [night, setNight] = useState(false);

  useLayoutEffect(() => {
    setNight(readNightTheme());
    function sync() {
      setNight(readNightTheme());
    }
    window.addEventListener(NIGHT_EVENT, sync);
    return () => window.removeEventListener(NIGHT_EVENT, sync);
  }, []);

  const setTheme = useCallback((next: boolean) => {
    applyNightTheme(next);
    setNight(next);
  }, []);

  return (
    <div className="theme-switch" role="group" aria-label="Color theme">
      <button
        type="button"
        aria-pressed={!night}
        onClick={() => setTheme(false)}
      >
        Day
      </button>
      <button
        type="button"
        aria-pressed={night}
        onClick={() => setTheme(true)}
      >
        Night
      </button>
    </div>
  );
}
