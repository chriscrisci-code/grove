export const NIGHT_STORAGE_KEY = "grove-theme";
export const NIGHT_EVENT = "grove-theme";

export function readNightTheme() {
  try {
    return localStorage.getItem(NIGHT_STORAGE_KEY) === "night";
  } catch {
    return false;
  }
}

export function applyNightTheme(night: boolean) {
  const theme = night ? "night" : "day";
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(NIGHT_STORAGE_KEY, theme);
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new Event(NIGHT_EVENT));
}
