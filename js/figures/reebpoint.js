/**
 * reebpoint.js — Figure 12g (added remark): volume minimisation.
 *
 * Read the polygon P as a toric diagram: the cone over P is the fan of an
 * affine toric threefold. By Martelli, Sparks and Yau the volume of its link,
 * for the Reeb vector 3·(1, x), is (π³/27)·C_P(x) (math/toric.js). The function
 * C_P is strictly convex on P and infinite on its boundary; its unique minimum
 * is the Reeb vector of the Sasaki–Einstein metric. In the language of this
 * page the minimiser is the Santaló point of P: the point for which the dual
 * polygon P*_x has the smallest area, equivalently the point about which the
 * dual polygon has its centroid at the origin. Twice the Wachspress
 * coordinates of that point are the R-charges of Butti and Zaffaroni.
 *
 * Left:  the polygon shaded by C_P, the point x and the minimiser.
 * Right: the dual polygon about x and its centroid.
 */

import { Stage, seriesColor, withAlpha } from "../ui/stage.js";
import { sequentialRGB } from "../ui/ramp.js";
import { el, fmt, sub, choiceGroup, makeBars } from "../ui/widgets.js";
import { centroid, pointInConvex, clampIntoConvex } from "../math/polygon.js";
import { polygonCanonical } from "../math/canonical.js";
import { polarDual, wachspress } from "../math/barycentric.js";
import { canonicalMinimum, TORIC_DIAGRAMS } from "../math/toric.js";
import { attachPolygonHandles } from "./common.js";

const VIEW = { xmin: -1.75, xmax: 1.75, ymin: -1.5, ymax: 1.5 };
const STEP = 3;
const PRESETS = ["c3z3", "conifold", "dp1", "dp2", "dp3"];

/** A toric diagram, moved so that it sits in the middle of the view. */
function preset(key) {
  const pts = TORIC_DIAGRAMS[key].pts;
  const lo = [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1]))];
  const hi = [Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))];
  return pts.map((p) => [p[0] - (lo[0] + hi[0]) / 2, p[1] - (lo[1] + hi[1]) / 2]);
}

export function initReebPoint(root) {
  const state = { pts: preset("dp2"), x: [0.35, -0.3], name: TORIC_DIAGRAMS.dp2.name };
  const left = el("div"), right = el("div"), side = el("div");
  const readout = el("div", { class: "readout", "aria-live": "polite" });
  const updateBars = makeBars(side);
  const buffer = document.createElement("canvas");
  let best = canonicalMinimum(state.pts);

  const primal = new Stage(left, {
    view: VIEW, aspect: 0.86, maxHeight: 420,
    label: "The polygon shaded by its canonical function, with the point x and the minimiser",
    draw(s) {
      const { pts, x } = state, c = centroid(pts);
      // heat map of log(C_P / minimum), clipped at a factor of 12
      const w = Math.ceil(s.width / STEP), h = Math.ceil(s.height / STEP);
      buffer.width = w; buffer.height = h;
      const bctx = buffer.getContext("2d"), img = bctx.createImageData(w, h);
      for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
        const q = s.toWorld([(px + 0.5) * STEP, (py + 0.5) * STEP]);
        if (!pointInConvex(pts, q)) continue;
        const t = Math.min(1, Math.log(polygonCanonical(pts, q) / best.value) / Math.log(12));
        const rgb = sequentialRGB(0.06 + 0.94 * t), o = 4 * (py * w + px);
        img.data[o] = rgb[0]; img.data[o + 1] = rgb[1]; img.data[o + 2] = rgb[2]; img.data[o + 3] = 255;
      }
      bctx.putImageData(img, 0, 0);
      s.ctx.imageSmoothingEnabled = false;
      s.ctx.drawImage(buffer, 0, 0, w * STEP, h * STEP);
      s.poly(pts, { stroke: s.color("ink"), width: 2 });
      pts.forEach((p, k) => {
        s.knob(p, seriesColor(k), 6);
        const d = [p[0] - c[0], p[1] - c[1]], l = Math.hypot(...d);
        s.text(p, sub("p", k), { dx: (18 * d[0]) / l, dy: (-18 * d[1]) / l, size: 14 });
      });
      // the minimiser: a ring, so that x can sit inside it
      s.dot(best.x, { r: 10, fill: withAlpha(s.color("surface"), 0.01), stroke: s.color("surface"), width: 5 });
      s.dot(best.x, { r: 10, fill: withAlpha(s.color("surface"), 0.01), stroke: seriesColor(1), width: 2.5 });
      s.knob(x, s.color("ink"), 6);
      s.text(x, "x", { dx: 13, dy: -13, size: 14 });
    },
  });

  const dual = new Stage(right, {
    view: { xmin: -1, xmax: 1, ymin: -1, ymax: 1 }, aspect: 0.86, maxHeight: 420,
    label: "The dual polygon about x and its centroid",
    draw(s) {
      const d = polarDual(state.pts, state.x), n = d.length;
      const R = 1.25 * Math.max(...d.map((p) => Math.hypot(p[0], p[1])));
      s.setView({ xmin: -R, xmax: R, ymin: -R, ymax: R });
      for (let i = 0; i < n; i++) {
        s.poly([[0, 0], d[(i + n - 1) % n], d[i]], { fill: withAlpha(seriesColor(i), 0.3), stroke: s.color("surface"), width: 1.5 });
      }
      s.poly(d, { stroke: s.color("ink"), width: 1.75 });
      const g = centroid(d);
      s.line([0, 0], g, { stroke: seriesColor(1), width: 2 });
      s.dot(g, { r: 6, fill: seriesColor(1), stroke: s.color("surface"), width: 2 });
      s.text(g, "centroid", { dx: 0, dy: 16, size: 12 });
      s.knob([0, 0], s.color("ink"), 5);
      s.text([0, 0], "x", { dx: 11, dy: -11, size: 14 });
    },
  });

  function update() {
    const { pts, x } = state;
    const C = polygonCanonical(pts, x), lam = wachspress(pts, x), g = centroid(polarDual(pts, x));
    const lamBest = wachspress(pts, best.x);
    updateBars(lam);
    readout.innerHTML =
      `<table><thead><tr><th></th><th>C<sub>P</sub> = 2 × area of the dual</th><th>volume of the link ÷ π³ &nbsp;(= C<sub>P</sub> / 27)</th></tr></thead><tbody>` +
      `<tr><td>at x</td><td><b>${fmt(C)}</b></td><td><b>${fmt(C / 27, 4)}</b></td></tr>` +
      `<tr><td>at the minimiser (ring)</td><td><b>${fmt(best.value)}</b></td><td><b>${fmt(best.value / 27, 4)}</b></td></tr></tbody></table>` +
      `<p>Distance of the centroid of the dual polygon from x: <b>${Math.hypot(g[0], g[1]) < 1e-6 ? "0.000" : fmt(Math.hypot(g[0], g[1]))}</b> ` +
      `(zero exactly when x is the minimiser).</p>` +
      `<p>Twice the Wachspress coordinates of the minimiser (the R-charges of the corners): ` +
      lamBest.map((l, i) => `2λ<sub>${i}</sub> = <b>${fmt(2 * l)}</b>`).join(", &nbsp;") + `</p>`;
    primal.redraw();
    dual.redraw();
  }
  function changed() { best = canonicalMinimum(state.pts); update(); }

  attachPolygonHandles(primal, state, { bounds: VIEW, onChange: changed });
  const shapes = choiceGroup("Toric diagram",
    PRESETS.map((k) => ({ value: k, label: TORIC_DIAGRAMS[k].name })), "dp2",
    (k) => {
      state.pts = preset(k);
      state.x = clampIntoConvex(state.pts, [0.35, -0.3], 0.08);
      changed();
    });
  const jump = el("button", { type: "button", class: "choice",
    onclick: () => { state.x = best.x.slice(); update(); } }, "Move x to the minimiser");

  root.append(el("div", { class: "controls" }, shapes.node, el("div", { class: "control" }, jump)),
    el("div", { class: "fig-pair" },
      el("div", {}, el("div", { class: "plot-title" }, "The polygon, shaded by its canonical function"), left),
      el("div", {}, el("div", { class: "plot-title" }, "Dual polygon about x, with its centroid"), right)),
    el("div", { class: "legend" },
      el("span", { class: "key" }, el("i", { class: "ramp" }), "canonical function, from its minimum upwards (logarithmic)"),
      el("span", { class: "key" }, el("i", { style: "background:var(--series-2); height:5px" }), "the minimiser, and the offset of the centroid")),
    el("p", { class: "hint" }, "Drag the point x or the corners of the polygon. The bars show the Wachspress coordinates of x."),
    side, readout);
  update();
}
