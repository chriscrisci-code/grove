"use client";

import { useLayoutEffect } from "react";

function syncVisualViewport() {
  const root = document.documentElement;
  const vv = window.visualViewport;
  if (!vv) {
    root.style.setProperty("--vv-top", "0px");
    root.style.setProperty("--vv-left", "0px");
    root.style.setProperty("--vv-width", "100%");
    root.style.setProperty("--vv-height", "100dvh");
    return;
  }
  root.style.setProperty("--vv-top", `${Math.round(vv.offsetTop)}px`);
  root.style.setProperty("--vv-left", `${Math.round(vv.offsetLeft)}px`);
  root.style.setProperty("--vv-width", `${Math.round(vv.width)}px`);
  root.style.setProperty("--vv-height", `${Math.round(vv.height)}px`);
}

export function VisualViewportRoot() {
  useLayoutEffect(() => {
    syncVisualViewport();
    const vv = window.visualViewport;
    window.addEventListener("resize", syncVisualViewport);
    vv?.addEventListener("resize", syncVisualViewport);
    vv?.addEventListener("scroll", syncVisualViewport);
    return () => {
      window.removeEventListener("resize", syncVisualViewport);
      vv?.removeEventListener("resize", syncVisualViewport);
      vv?.removeEventListener("scroll", syncVisualViewport);
    };
  }, []);
  return null;
}
