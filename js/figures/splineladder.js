/**
 * splineladder.js — Figure 12d (added remark): differentiating a spline removes
 * a vector.
 *
 * For the multivariate spline T of the vectors a_0 … a_{n−1} (math/splines.js)
 *     D_{a_k} T_X = T_{X ∖ a_k},
 * so every derivative along one of the vectors gives the spline of the others:
 * the degree drops by one and the support shrinks to the cone of the remaining
 * vectors. With three vectors left, the spline is the indicator function of a
 * triangular cone divided by |det|. The adjoint operator is a sum of such
 * complete ladders, one for every triangle of a triangulation.
 *
 * Left:  the polygon; edges whose vector has been removed are dashed.
 * Right: the dual polygon, shaded by the spline of the remaining vectors.
 *        Clicking a corner d_k removes or restores the vector a_k.
 */

import { Stage, seriesColor } from "../ui/stage.js";
import { sequentialRGB } from "../ui/ramp.js";
import { el, fmt, sub, choiceGroup } from "../ui/widgets.js";
import { centroid, edgeLines, lineDist, pointInConvex } from "../math/polygon.js";
import { polarDual } from "../math/barycentric.js";
import { facetVectors, coneSpline, integrateFan, det3 } from "../math/splines.js";
import { defaultPolygon, attachPolygonHandles } from "./common.js";

const VIEW = { xmin: -1.75, xmax: 1.75, ymin: -1.5, ymax: 1.5 };
const STEP = 3;
const FACTORIAL = [1, 1, 2, 6, 24, 120, 720];

export function initSplineLadder(root) {
  const state = { pts: defaultPolygon(5), x: [0.2, -0.1], removed: new Set() };
  const left = el("div"), right = el("div");
  const readout = el("div", { class: "readout", "aria-live": "polite" });
  const buffer = document.createElement("canvas");
  const kept = () => state.pts.map((_, i) => i).filter((i) => !state.removed.has(i));

  const primal = new Stage(left, {
    view: VIEW, aspect: 0.86, maxHeight: 420,
    label: "Convex polygon; edges whose normal vector has been removed are dashed",
    draw(s) {
      const { pts, x } = state, n = pts.length, c = centroid(pts);
      s.poly(pts, { fill: s.color("fill-soft") });
      pts.forEach((p, i) => {
        const q = pts[(i + 1) % n], off = state.removed.has(i);
        s.line(p, q, off ? { stroke: s.color("ink-2"), width: 1.5, dash: [5, 4] } : { stroke: seriesColor(i), width: 3 });
        // name the edge by its vector a_i, just outside the polygon
        const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], d = [m[0] - c[0], m[1] - c[1]], l = Math.hypot(...d);
        s.text(m, sub("a", i), { dx: (14 * d[0]) / l, dy: (-14 * d[1]) / l, size: 12, color: s.color(off ? "ink-2" : "ink") });
      });
      pts.forEach((p) => s.knob(p, s.color("ink"), 5));
      s.knob(x, s.color("ink"), 6);
      s.text(x, "x", { dx: 12, dy: -12, size: 14 });
    },
  });

  const dual = new Stage(right, {
    view: { xmin: -1, xmax: 1, ymin: -1, ymax: 1 }, aspect: 0.86, maxHeight: 420,
    label: "Dual polygon shaded by the spline of the remaining vectors; click a corner to remove or restore its vector",
    draw(s) {
      const { pts, x } = state, n = pts.length;
      const d = polarDual(pts, x), all = facetVectors(pts), keep = kept();
      const X = keep.map((i) => all[i]), hull = keep.map((i) => d[i]);
      const R = 1.2 * Math.max(...d.map((p) => Math.hypot(p[0], p[1])));
      s.setView({ xmin: -R, xmax: R, ymin: -R, ymax: R });
      const w = Math.ceil(s.width / STEP), h = Math.ceil(s.height / STEP);
      const values = new Float64Array(w * h).fill(-1);
      let max = 0;
      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          const q = s.toWorld([(px + 0.5) * STEP, (py + 0.5) * STEP]);
          if (!pointInConvex(hull, q)) continue;
          const v = coneSpline(X, [1 - (x[0] * q[0] + x[1] * q[1]), q[0], q[1]]);
          values[py * w + px] = v;
          if (v > max) max = v;
        }
      }
      buffer.width = w; buffer.height = h;
      const bctx = buffer.getContext("2d"), img = bctx.createImageData(w, h);
      for (let k = 0; k < w * h; k++) {
        if (values[k] < 0) continue;
        const rgb = sequentialRGB(X.length > 3 ? 0.06 + 0.94 * (values[k] / max) : 0.55);
        img.data[4 * k] = rgb[0]; img.data[4 * k + 1] = rgb[1]; img.data[4 * k + 2] = rgb[2]; img.data[4 * k + 3] = 255;
      }
      bctx.putImageData(img, 0, 0);
      s.ctx.imageSmoothingEnabled = false;
      s.ctx.drawImage(buffer, 0, 0, w * STEP, h * STEP);
      // outline of the full dual polygon (thin) and of the support of the current spline
      s.poly(d, { stroke: s.color("ink-2"), width: 1, dash: [4, 4] });
      s.poly(hull, { stroke: s.color("ink"), width: 1.75 });
      d.forEach((p, k) => {
        const off = state.removed.has(k), l = Math.hypot(p[0], p[1]);
        s.dot(p, { r: 6.5, fill: s.color("surface") });
        s.dot(p, off ? { r: 5, fill: s.color("surface"), stroke: s.color("ink-2"), width: 1.5 } : { r: 5, fill: seriesColor(k) });
        s.text(p, sub("d", k), { dx: (17 * p[0]) / l, dy: (-17 * p[1]) / l, size: 12, color: s.color(off ? "ink-2" : "ink") });
      });
      s.knob([0, 0], s.color("ink"), 4);
      s.text([0, 0], "x", { dx: 10, dy: -10, size: 13 });
    },
  });
  // corners of the dual polygon act as switches
  dual.handles = () => polarDual(state.pts, state.x).map((p, k) => ({
    pos: () => p,
    drag: () => {},
    select: () => {
      if (state.removed.has(k)) state.removed.delete(k);
      else if (kept().length > 3) state.removed.add(k);
      update();
    },
  }));

  function update() {
    const { pts, x } = state;
    const d = polarDual(pts, x), all = facetVectors(pts), keep = kept(), m = keep.length;
    const X = keep.map((i) => all[i]), hull = keep.map((i) => d[i]);
    const h = edgeLines(pts).map((l) => lineDist(l, x));
    // integrate over the support, triangulated from its first corner
    const o = hull[0], shifted = hull.map((p) => [p[0] - o[0], p[1] - o[1]]);
    const mass = FACTORIAL[m - 1] * integrateFan(shifted,
      (q) => coneSpline(X, [1 - (x[0] * (q[0] + o[0]) + x[1] * (q[1] + o[1])), q[0] + o[0], q[1] + o[1]]), 8, 6);
    const prod = keep.reduce((p, i) => p * h[i], 1);
    const gone = [...state.removed].sort((a, b) => a - b);
    const names = (list) => list.map((i) => `a<sub>${i}</sub>`).join(", ");
    readout.innerHTML =
      `<p>${gone.length === 0 ? "Nothing removed: the spline of all " + m + " vectors."
        : `Differentiated along ${names(gone)}: what is shown is the spline of the remaining ${m} vectors ${names(keep)}.`}` +
      `<br>Degree of its polynomial pieces: <b>${m - 3}</b>` +
      (m === 3 ? ` &nbsp;— a constant, 1 / |det| = <b>${fmt(1 / Math.abs(det3(...X)))}</b>, on a triangle and zero outside.` : ``) + `</p>` +
      `<p>Check of the Laplace transform for the remaining vectors: &nbsp; ${m - 1}! × ∫ = <b>${fmt(mass)}</b>, &nbsp; ` +
      `1 / Π h<sub>k</sub>(x) over the remaining edges = <b>${fmt(1 / prod)}</b></p>`;
    primal.redraw();
    dual.redraw();
  }

  attachPolygonHandles(primal, state, { bounds: VIEW, onChange: update });
  const sides = choiceGroup("Number of sides",
    [4, 5, 6].map((v) => ({ value: v, label: String(v) })), 5,
    (v) => { state.pts = defaultPolygon(v); state.x = [0.2, -0.1]; state.removed.clear(); update(); });
  const reset = el("button", { type: "button", class: "choice", onclick: () => { state.removed.clear(); update(); } },
    "Restore all vectors");

  root.append(el("div", { class: "controls" }, sides.node, el("div", { class: "control" }, reset)),
    el("div", { class: "fig-pair" },
      el("div", {}, el("div", { class: "plot-title" }, "Polygon P and the vectors of its edges"), left),
      el("div", {}, el("div", { class: "plot-title" }, "Spline of the remaining vectors on the dual polygon"), right)),
    el("div", { class: "legend" },
      el("span", { class: "key" }, el("i", { class: "ramp" }), "spline from 0 to its largest value")),
    el("p", { class: "hint" },
      "Click a corner of the dual polygon to differentiate along its vector; click again to restore it. Three vectors always remain."),
    readout);
  update();
}
