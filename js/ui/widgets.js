/**
 * widgets.js — tiny DOM helpers shared by the figures (no framework).
 *
 *   el()            create an element with attributes and children
 *   choiceGroup()   a row of mutually exclusive buttons ("segmented control")
 *   slider()        a labelled range input
 *   checkbox()      a labelled checkbox
 *   makeBars()      horizontal bar chart of barycentric coordinates λ_i
 *   fmt()           number formatting for read-outs
 *   sub()           "p" + 3 → "p₃" (Unicode subscripts for canvas labels)
 */

import { seriesColor } from "./stage.js";

/** Create an element: el("div", {class: "x", onclick: fn}, child1, "text", …). */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else if (k === "html") node.innerHTML = v;
    else node.setAttribute(k, v);
  }
  for (const ch of children.flat()) {
    if (ch == null) continue;
    node.appendChild(typeof ch === "string" ? document.createTextNode(ch) : ch);
  }
  return node;
}

/** Fixed-precision number with a real minus sign; "∞"-safe. */
export function fmt(v, digits = 3) {
  if (!Number.isFinite(v)) return "∞";
  const a = Math.abs(v);
  const s = a >= 1e4 || (a > 0 && a < 1e-3) ? v.toExponential(2) : v.toFixed(digits);
  return s.replace("-", "−");
}

const SUBS = "₀₁₂₃₄₅₆₇₈₉";
/** Unicode-subscripted name, e.g. sub("p", 12) → "p₁₂". */
export const sub = (name, i) => name + String(i).split("").map((d) => SUBS[+d]).join("");

/**
 * Segmented control. `options` is an array of {value, label}; `onChange(value)`
 * fires when the user picks a different option. Returns {node, set(value)}.
 */
export function choiceGroup(caption, options, initial, onChange) {
  const buttons = options.map((o) =>
    el("button", { type: "button", class: "choice", "aria-pressed": "false",
      onclick: () => { set(o.value); onChange(o.value); } }, o.label));
  function set(value) {
    options.forEach((o, i) =>
      buttons[i].setAttribute("aria-pressed", String(o.value === value)));
  }
  set(initial);
  const node = el("div", { class: "control" },
    el("span", { class: "control-label" }, caption),
    el("div", { class: "choices", role: "group", "aria-label": caption }, buttons));
  return { node, set };
}

/**
 * Range slider. `format(value)` produces the text shown next to it.
 * Returns {node, input}.
 */
export function slider(caption, { min, max, step, value }, format, onChange) {
  const out = el("output", {}, format(value));
  const input = el("input", { type: "range", min, max, step, value, "aria-label": caption,
    oninput: () => { out.textContent = format(+input.value); onChange(+input.value); } });
  const node = el("label", { class: "control" },
    el("span", { class: "control-label" }, caption), input, out);
  return { node, input };
}

/** Labelled checkbox; returns {node, input}. */
export function checkbox(caption, checked, onChange) {
  const input = el("input", { type: "checkbox", onchange: () => onChange(input.checked) });
  input.checked = checked;
  return { node: el("label", { class: "control check" }, input, caption), input };
}

/**
 * Horizontal bar chart for barycentric coordinates. Bars share the scale
 * [0, 1], are coloured like the corresponding vertex, and carry their value as
 * text, so the colour is never the only cue.
 * Returns update(lambda[, selectedIndex]).
 */
export function makeBars(container, name = "λ") {
  const root = el("div", { class: "bars", role: "table", "aria-label": "Barycentric coordinates" });
  container.appendChild(root);
  let rows = [];
  return function update(lambda, selected = -1) {
    if (rows.length !== lambda.length) {
      root.replaceChildren();
      rows = lambda.map((_, i) => {
        const fill = el("div", { class: "bar-fill" });
        const value = el("span", { class: "bar-value" });
        const row = el("div", { class: "bar-row", role: "row" },
          el("span", { class: "bar-label", html: `${name}<sub>${i}</sub>` }),
          el("div", { class: "bar-track" }, fill), value);
        root.appendChild(row);
        return { row, fill, value };
      });
    }
    lambda.forEach((l, i) => {
      rows[i].fill.style.width = (100 * Math.max(0, Math.min(1, l))).toFixed(2) + "%";
      rows[i].fill.style.background = seriesColor(i);
      rows[i].value.textContent = fmt(l);
      rows[i].row.classList.toggle("selected", i === selected);
    });
  };
}
