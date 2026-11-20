/**
 * polycon.js — Figure 10 (later developments): adjoint curves of polycons and
 * the counterexample to Wachspress' conjecture.
 *
 * A polycon is a region bounded by arcs of lines and conics. By Kohn et al.
 * (2025) its canonical form is  adjoint / (product of the boundary equations).
 * Wachspress conjectured that the adjoint never enters a regular polycon;
 * Brüser (2026) found three ellipses for which it does.
 *
 * Presets:
 *   pizza     the pizza slice: the adjoint line stays outside; optional
 *             shading by λ_O, the weight the paper's recipe gives the corner
 *   bruser    Brüser's polycon: the adjoint cubic has an oval inside
 *   zoom      the same, magnified around the oval
 * The region is painted pixel by pixel (it is given by inequalities); the
 * curves are traced with marching squares.
 */

import { Stage, seriesColor, withAlpha } from "../ui/stage.js";
import { sequentialRGB } from "../ui/ramp.js";
import { zeroSet, strokeSegments } from "../ui/contour.js";
import { el, fmt, choiceGroup } from "../ui/widgets.js";
import { BRUSER, PIZZA } from "../math/canonical.js";

const BRUSER_NOTE =
  "Brüser’s polycon is bounded by arcs of three ellipses. Its adjoint is a cubic through the three " +
  "real residual points — and it has a small oval inside the polycon (highlighted). On that oval the " +
  "canonical function vanishes and inside it changes sign, so Wachspress’ rational functions have poles " +
  "in the interior of the element.";

const PRESETS = {
  pizza: {
    label: "Pizza slice",
    view: { xmin: -1.75, xmax: 1.75, ymin: -1.15, ymax: 1.3 },
    curves: [PIZZA.circle, PIZZA.line1, PIZZA.line2],
    shape: PIZZA,
    shade: PIZZA.lambdaO, // sequential shading of the interior
    note: "The adjoint is the line through the two residual points, where the side lines meet the " +
      "circle again. It stays outside the slice, so the canonical function is positive inside. " +
      "Shading: the weight of the corner O where the two lines meet, " +
      "λ = Ω(wedge at O) / Ω(slice) = (1 − x² − y²)/(1 + 2y). It is 1 at the corner and 0 on the arc.",
  },
  bruser: {
    label: "Counterexample (three ellipses)",
    view: { xmin: -9.5, xmax: 15.5, ymin: -11.5, ymax: 6.5 },
    curves: [(x, y) => BRUSER.c1(x, y), (x, y) => BRUSER.c2(x, y), (x, y) => BRUSER.c3(x, y)],
    shape: BRUSER,
    note: BRUSER_NOTE,
  },
  zoom: {
    label: "Counterexample, zoomed in",
    view: { xmin: 0.4, xmax: 4.9, ymin: 0.9, ymax: 4.1 },
    curves: [(x, y) => BRUSER.c1(x, y), (x, y) => BRUSER.c2(x, y), (x, y) => BRUSER.c3(x, y)],
    shape: BRUSER,
    note: BRUSER_NOTE,
  },
};

const STEP = 2; // region raster: one sample per STEP css pixels

export function initPolycon(root) {
  const state = { preset: "pizza", hover: null };
  const box = el("div");
  const note = el("p", { class: "readout" });
  const probe = el("p", { class: "readout", "aria-live": "polite" });
  const buffer = document.createElement("canvas");

  /** Paint the polycon: soft fill (or λ_O shading); adjoint-negative part highlighted. */
  function paintRegion(s, P) {
    const w = Math.ceil(s.width / STEP), h = Math.ceil(s.height / STEP);
    buffer.width = w;
    buffer.height = h;
    const bctx = buffer.getContext("2d");
    const img = bctx.createImageData(w, h);
    const soft = hexRGB(s.color("fill-soft")), hot = hexRGB(seriesColor(7));
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const [x, y] = s.toWorld([(px + 0.5) * STEP, (py + 0.5) * STEP]);
        if (!P.shape.inside(x, y)) continue;
        const rgb = P.shape.adjoint(x, y) < 0 ? hot : P.shade ? sequentialRGB(P.shade(x, y)) : soft;
        const o = 4 * (py * w + px);
        img.data[o] = rgb[0]; img.data[o + 1] = rgb[1]; img.data[o + 2] = rgb[2]; img.data[o + 3] = 255;
      }
    }
    bctx.putImageData(img, 0, 0);
    s.ctx.imageSmoothingEnabled = false;
    s.ctx.drawImage(buffer, 0, 0, w * STEP, h * STEP);
  }

  const stage = new Stage(box, {
    view: PRESETS.pizza.view, aspect: 0.7, maxHeight: 520,
    label: "A polycon, its boundary curves, residual points and adjoint curve",
    draw(s) {
      const P = PRESETS[state.preset];
      s.setView(P.view);
      // marching squares need the rectangle that is actually visible on the canvas
      const a = s.toWorld([0, s.height]), b = s.toWorld([s.width, 0]);
      const vis = { xmin: a[0], xmax: b[0], ymin: a[1], ymax: b[1] };
      paintRegion(s, P);
      for (const f of P.curves) strokeSegments(s, zeroSet(f, vis, 260), s.color("axis"), 1.25);
      strokeSegments(s, zeroSet(P.shape.adjoint, vis, 260), seriesColor(1), 2.5);
      for (const r of P.shape.residual) {
        s.dot(r, { r: 6.5, fill: s.color("surface") });
        s.dot(r, { r: 4.5, fill: seriesColor(1) });
      }
      P.shape.vertices.forEach((v) => s.knob(v, s.color("ink"), 5));
    },
  });
  stage.onHover = (w) => { state.hover = w; updateProbe(); };

  function updateProbe() {
    const P = PRESETS[state.preset], w = state.hover;
    if (!w || !P.shape.inside(w[0], w[1])) {
      probe.textContent = "Hover over the region to probe it.";
      return;
    }
    const neg = P.shape.adjoint(w[0], w[1]) < 0;
    probe.innerHTML = `At (${fmt(w[0], 2)}, ${fmt(w[1], 2)}): ` +
      (P.shade ? `λ<sub>O</sub> = <b>${fmt(P.shade(w[0], w[1]))}</b>, ` : "") +
      `the adjoint is <b>${neg ? "negative — inside the oval" : "positive"}</b>.`;
  }

  function update() {
    note.textContent = PRESETS[state.preset].note;
    updateProbe();
    stage.redraw();
  }

  const choice = choiceGroup("Polycon",
    Object.entries(PRESETS).map(([value, p]) => ({ value, label: p.label })),
    state.preset, (v) => { state.preset = v; update(); });

  root.append(el("div", { class: "controls" }, choice.node),
    el("div", { class: "legend" },
      el("span", { class: "key" }, el("i", { style: "background:var(--axis)" }), "boundary curves, continued"),
      el("span", { class: "key" }, el("i", { style: "background:var(--series-2)" }),
        "adjoint curve and residual points"),
      el("span", { class: "key" }, el("i", { style: "background:var(--series-8);height:10px;width:10px" }),
        "adjoint negative inside the polycon")),
    box, note, probe);
  update();
}

/** "#rrggbb" → [r, g, b]. */
function hexRGB(hex) {
  const v = parseInt(hex.replace("#", ""), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
