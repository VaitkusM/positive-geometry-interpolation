/**
 * splinedual.js — Figure 12c (later developments): a spline on the dual polygon.
 *
 * The dual polygon P*_x carries two natural densities (math/splines.js):
 *
 *   uniform        2 · Area(P*_x)                    = C_P(x) = adj_P(x) / Π h_i(x)
 *   spline τ_x     (n − 1)! · ∫ τ_x(w) dw            = 1 / Π h_i(x)
 *
 * where τ_x is the multivariate spline T_X of the edge normals, restricted to
 * the dual polygon: a piecewise polynomial of degree n − 3 whose pieces are
 * cut out by the diagonals of the dual polygon. The ratio of the two numbers
 * is the adjoint polynomial; as a differential operator, the adjoint turns
 * the spline into the uniform density.
 *
 * Left: the polygon and the point x. Right: the dual polygon shaded by the
 * chosen density. The read-out compares numerical integrals with the closed
 * formulas.
 */

import { Stage } from "../ui/stage.js";
import { sequentialRGB } from "../ui/ramp.js";
import { el, fmt, sub, choiceGroup } from "../ui/widgets.js";
import { centroid, edgeLines, lineDist, pointInConvex } from "../math/polygon.js";
import { polygonCanonical, polygonAdjoint } from "../math/canonical.js";
import { polarDual } from "../math/barycentric.js";
import { facetVectors, coneSpline, integrateFan } from "../math/splines.js";
import { defaultPolygon, attachPolygonHandles } from "./common.js";

const VIEW = { xmin: -1.75, xmax: 1.75, ymin: -1.5, ymax: 1.5 };
const STEP = 3;                                  // heat map: one sample per STEP css pixels
const FACTORIAL = [1, 1, 2, 6, 24, 120, 720];

export function initSplineDual(root) {
  const state = { pts: defaultPolygon(5), x: [0.2, -0.1], density: "spline" };
  const left = el("div"), right = el("div");
  const readout = el("div", { class: "readout", "aria-live": "polite" });
  const buffer = document.createElement("canvas");

  const primal = new Stage(left, {
    view: VIEW, aspect: 0.86, maxHeight: 420,
    label: "Convex polygon with draggable vertices and evaluation point x",
    draw(s) {
      const { pts, x } = state, c = centroid(pts);
      s.poly(pts, { fill: s.color("fill-soft"), stroke: s.color("ink"), width: 2 });
      pts.forEach((p, k) => {
        s.knob(p, s.color("ink"), 6);
        const d = [p[0] - c[0], p[1] - c[1]], l = Math.hypot(...d);
        s.text(p, sub("p", k), { dx: (18 * d[0]) / l, dy: (-18 * d[1]) / l, size: 14 });
      });
      s.knob(x, s.color("ink"), 6);
      s.text(x, "x", { dx: 12, dy: -12, size: 14 });
    },
  });

  const dual = new Stage(right, {
    view: { xmin: -1, xmax: 1, ymin: -1, ymax: 1 }, aspect: 0.86, maxHeight: 420,
    label: "The dual polygon, shaded by the spline density or by the uniform density",
    draw(s) {
      const { pts, x } = state, n = pts.length;
      const d = polarDual(pts, x), X = facetVectors(pts);
      const R = 1.2 * Math.max(...d.map((p) => Math.hypot(p[0], p[1])));
      s.setView({ xmin: -R, xmax: R, ymin: -R, ymax: R });
      // sample the density on a coarse pixel grid, then colour it relative to its maximum
      const w = Math.ceil(s.width / STEP), h = Math.ceil(s.height / STEP);
      const values = new Float64Array(w * h).fill(-1);
      let max = 0;
      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          const q = s.toWorld([(px + 0.5) * STEP, (py + 0.5) * STEP]);
          if (!pointInConvex(d, q)) continue;
          const v = state.density === "spline" ? coneSpline(X, [1 - (x[0] * q[0] + x[1] * q[1]), q[0], q[1]]) : 1;
          values[py * w + px] = v;
          if (v > max) max = v;
        }
      }
      buffer.width = w; buffer.height = h;
      const bctx = buffer.getContext("2d"), img = bctx.createImageData(w, h);
      for (let k = 0; k < w * h; k++) {
        if (values[k] < 0) continue;
        // a flat density is drawn in a middle tone; otherwise light = 0, dark = maximum
        const t = state.density === "spline" && n > 3 ? 0.06 + 0.94 * (values[k] / max) : 0.55;
        const rgb = sequentialRGB(t);
        img.data[4 * k] = rgb[0]; img.data[4 * k + 1] = rgb[1]; img.data[4 * k + 2] = rgb[2]; img.data[4 * k + 3] = 255;
      }
      bctx.putImageData(img, 0, 0);
      s.ctx.imageSmoothingEnabled = false;
      s.ctx.drawImage(buffer, 0, 0, w * STEP, h * STEP);
      // the diagonals of the dual polygon: across them the spline changes its polynomial
      if (state.density === "spline") {
        for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
          if (i === 0 && j === n - 1) continue;
          s.line(d[i], d[j], { stroke: s.color("surface"), width: 1 });
        }
      }
      s.poly(d, { stroke: s.color("ink"), width: 1.75 });
      d.forEach((p, k) => {
        s.dot(p, { r: 3.5, fill: s.color("ink") });
        const l = Math.hypot(p[0], p[1]);
        s.text(p, sub("d", k), { dx: (15 * p[0]) / l, dy: (-15 * p[1]) / l, size: 12, color: s.color("ink-2") });
      });
      s.knob([0, 0], s.color("ink"), 4);
      s.text([0, 0], "x", { dx: 10, dy: -10, size: 13 });
    },
  });

  function update() {
    const { pts, x } = state, n = pts.length;
    const d = polarDual(pts, x), X = facetVectors(pts);
    const prod = edgeLines(pts).reduce((p, l) => p * lineDist(l, x), 1);
    const area2 = 2 * integrateFan(d, () => 1);
    const mass = FACTORIAL[n - 1] * integrateFan(d, (w) => coneSpline(X, [1 - (x[0] * w[0] + x[1] * w[1]), w[0], w[1]]), 8, 4);
    readout.innerHTML =
      `<table><thead><tr><th>Density on the dual polygon</th><th>Integral (numerical)</th><th>Closed formula</th></tr></thead><tbody>` +
      `<tr><td>uniform: 2 × area</td><td><b>${fmt(area2)}</b></td>` +
      `<td>C<sub>P</sub>(x) = adj<sub>P</sub>(x) / Π h<sub>k</sub>(x) = <b>${fmt(polygonCanonical(pts, x))}</b></td></tr>` +
      `<tr><td>spline: ${n - 1}! × ∫ τ</td><td><b>${fmt(mass)}</b></td>` +
      `<td>1 / Π h<sub>k</sub>(x) = <b>${fmt(1 / prod)}</b></td></tr>` +
      `<tr><td>ratio of the two</td><td><b>${fmt(area2 / mass)}</b></td>` +
      `<td>adj<sub>P</sub>(x) = <b>${fmt(polygonAdjoint(pts, x))}</b></td></tr></tbody></table>` +
      `<p>The spline is a piecewise polynomial of degree n − 3 = ${n - 3}` +
      (n > 3 ? `, with ${n * (n - 3) / 2} diagonal${n * (n - 3) / 2 > 1 ? "s" : ""} of the dual polygon as the lines where its formula changes.` : ` (a constant).`) + `</p>`;
    primal.redraw();
    dual.redraw();
  }

  attachPolygonHandles(primal, state, { bounds: VIEW, onChange: update });
  const sides = choiceGroup("Number of sides",
    [3, 4, 5, 6].map((v) => ({ value: v, label: String(v) })), 5,
    (v) => { state.pts = defaultPolygon(v); state.x = [0.2, -0.1]; update(); });
  const kind = choiceGroup("Density shown",
    [{ value: "spline", label: "Spline" }, { value: "uniform", label: "Uniform" }], state.density,
    (v) => { state.density = v; update(); });

  root.append(el("div", { class: "controls" }, sides.node, kind.node),
    el("div", { class: "fig-pair" },
      el("div", {}, el("div", { class: "plot-title" }, "Polygon P"), left),
      el("div", {}, el("div", { class: "plot-title" }, "Dual polygon P*ₓ with a density"), right)),
    el("div", { class: "legend" },
      el("span", { class: "key" }, el("i", { class: "ramp" }), "density from 0 to its largest value")),
    el("p", { class: "hint" }, "Drag the vertices or the point x."),
    readout);
  update();
}
