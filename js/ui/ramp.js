/**
 * ramp.js — the sequential colour ramp used for magnitudes (heat maps and the
 * height colouring of the 3D surface).
 *
 * One hue (blue), light → dark. On the dark theme the ramp is reversed so that
 * small values still recede towards the page background.
 */

import { isDark } from "./stage.js";

const STEPS = ["#cde2fb", "#b7d3f6", "#9ec5f4", "#86b6ef", "#6da7ec", "#5598e7",
  "#3987e5", "#2a78d6", "#256abf", "#1c5cab", "#184f95", "#104281", "#0d366b"]
  .map((h) => {
    const v = parseInt(h.slice(1), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  });

/** Colour for t ∈ [0, 1] as [r, g, b] (0–255), optionally scaled by `shade`. */
export function sequentialRGB(t, shade = 1) {
  t = Math.max(0, Math.min(1, t));
  if (isDark()) t = 1 - t;
  const f = t * (STEPS.length - 1);
  const i = Math.min(STEPS.length - 2, Math.floor(f)), u = f - i;
  return [0, 1, 2].map((k) => Math.round(shade * (STEPS[i][k] + u * (STEPS[i + 1][k] - STEPS[i][k]))));
}

/** Same as sequentialRGB, as a CSS colour string. */
export const sequential = (t, shade = 1) => `rgb(${sequentialRGB(t, shade).join(",")})`;
