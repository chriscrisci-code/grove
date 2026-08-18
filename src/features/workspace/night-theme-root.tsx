"use client";

import { useLayoutEffect } from "react";
import { applyNightTheme, readNightTheme } from "@/features/workspace/night-theme";

export function NightThemeRoot() {
  useLayoutEffect(() => {
    applyNightTheme(readNightTheme());
  }, []);
  return null;
}
