/**
 * theme.js — light and dark colour scheme.
 *
 * By default the page follows the colour scheme of the operating system. The
 * button in the navigation bar overrides that: the choice is stored in
 * localStorage and written to <html data-theme="light|dark">, which
 * css/style.css uses to pick the colour tokens. (A short inline script in
 * index.html applies a stored choice before the first paint.)
 *
 * Canvas figures do not restyle themselves, so code that draws with theme
 * colours registers a callback with onThemeChange (see ui/stage.js).
 */

const KEY = "theme";
const listeners = new Set();
const hasDom = typeof window !== "undefined" && typeof document !== "undefined";
const systemDark = hasDom && window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

/** The explicit choice, "light" or "dark", or null when following the system. */
function chosenTheme() {
  const t = hasDom ? document.documentElement.dataset.theme : null;
  return t === "light" || t === "dark" ? t : null;
}

/** True when the page is currently shown with the dark colour scheme. */
export function isDark() {
  const t = chosenTheme();
  return t ? t === "dark" : !!(systemDark && systemDark.matches);
}

/** Call fn whenever the colours of the page change. */
export function onThemeChange(fn) { listeners.add(fn); }

function notify() { listeners.forEach((fn) => fn()); }

/** Choose a theme explicitly and remember the choice. */
export function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem(KEY, theme); } catch { /* storage may be blocked; the choice then lasts for this visit */ }
  notify();
}

/** Turn a <button> into the light / dark switch. */
export function initThemeToggle(button) {
  if (!button) return;
  const label = () => {
    const next = isDark() ? "light" : "dark";
    button.textContent = next === "light" ? "Light mode" : "Dark mode";
    button.setAttribute("aria-label", `Switch to ${next} mode`);
  };
  button.addEventListener("click", () => setTheme(isDark() ? "light" : "dark"));
  onThemeChange(label);
  label();
  button.hidden = false;
}

// follow the operating system while no explicit choice has been made
if (systemDark) systemDark.addEventListener("change", () => { if (!chosenTheme()) notify(); });
