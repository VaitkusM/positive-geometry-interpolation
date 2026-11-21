/**
 * fibre.js — Figure 12f (added remark): the polytope in each fibre.
 *
 * The spline of Figure 12c is a Duistermaat–Heckman density: the torus T³ acts
 * on Cⁿ with the vectors a_k as weights, and the value of the spline at a
 * point v of the cone is the volume of the reduced space over v. That space is
 * a toric variety whose moment polytope is the fibre
 *     Π(v) = { t ≥ 0 : Σ t_k a_k = v }        (math/toric.js).
 * For five vectors Π(v) is a polygon with at most five sides, one for each
 * coordinate t_k that can vanish; a side disappears when v crosses a diagonal
 * of the dual polygon (a wall), which is why the spline changes its formula
 * there.
 *
 * Left:  the dual polygon, shaded by the spline, with a draggable point.
 * Right: the fibre polytope over that point; its sides carry the colours of
 *        the corners of the dual polygon.
 */

import { Stage, seriesColor, withAlpha } from "../ui/stage.js";
import { sequentialRGB } from "../ui/ramp.js";
import { el, fmt, sub, choiceGroup } from "../ui/widgets.js";
import { centroid, pointInConvex, clampIntoConvex } from "../math/polygon.js";
import { polarDual } from "../math/barycentric.js";
import { facetVectors, coneSpline } from "../math/splines.js";
import { fibrePolytope } from "../math/toric.js";
import { defaultPolygon } from "./common.js";

const STEP = 3;
const X = [0.2, -0.1];           // the evaluation point is fixed in this figure

export function initFibre(root) {
  const state = { n: 5, w: null };
  const left = el("div"), right = el("div");
  const readout = el("div", { class: "readout", "aria-live": "polite" });
  const buffer = document.createElement("canvas");

  /** Everything that depends only on the number of sides. */
  let data;
  function rebuild() {
    const pts = defaultPolygon(state.n), d = polarDual(pts, X), vectors = facetVectors(pts);
    const R = 1.2 * Math.max(...d.map((p) => Math.hypot(p[0], p[1])));
    const lift = (w) => [1 - (X[0] * w[0] + X[1] * w[1]), w[0], w[1]];
    // size of the fibre over the middle of the dual polygon fixes the scale of the right-hand picture
    const mid = fibrePolytope(vectors, lift(centroid(d)));
    const extent = mid.dim === 1 ? mid.volume : Math.max(...mid.points.map((p) => Math.hypot(p[0] - mid.points[0][0], p[1] - mid.points[0][1])));
    data = { d, vectors, R, lift, extent };
    state.w = centroid(d);
  }
  rebuild();

  const dual = new Stage(left, {
    view: { xmin: -1, xmax: 1, ymin: -1, ymax: 1 }, aspect: 0.86, maxHeight: 420,
    label: "The dual polygon shaded by the spline, with a draggable point",
    draw(s) {
      const { d, vectors, R, lift } = data, n = d.length;
      s.setView({ xmin: -R, xmax: R, ymin: -R, ymax: R });
      const w = Math.ceil(s.width / STEP), h = Math.ceil(s.height / STEP);
      const values = new Float64Array(w * h).fill(-1);
      let max = 0;
      for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
        const q = s.toWorld([(px + 0.5) * STEP, (py + 0.5) * STEP]);
        if (!pointInConvex(d, q)) continue;
        const v = coneSpline(vectors, lift(q));
        values[py * w + px] = v;
        if (v > max) max = v;
      }
      buffer.width = w; buffer.height = h;
      const bctx = buffer.getContext("2d"), img = bctx.createImageData(w, h);
      for (let k = 0; k < w * h; k++) {
        if (values[k] < 0) continue;
        const rgb = sequentialRGB(0.06 + 0.94 * (values[k] / max));
        img.data[4 * k] = rgb[0]; img.data[4 * k + 1] = rgb[1]; img.data[4 * k + 2] = rgb[2]; img.data[4 * k + 3] = 255;
      }
      bctx.putImageData(img, 0, 0);
      s.ctx.imageSmoothingEnabled = false;
      s.ctx.drawImage(buffer, 0, 0, w * STEP, h * STEP);
      // the walls: diagonals of the dual polygon
      for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
        if (i === 0 && j === n - 1) continue;
        s.line(d[i], d[j], { stroke: s.color("surface"), width: 1 });
      }
      s.poly(d, { stroke: s.color("ink"), width: 1.75 });
      d.forEach((p, k) => {
        const l = Math.hypot(p[0], p[1]);
        s.dot(p, { r: 6.5, fill: s.color("surface") });
        s.dot(p, { r: 5, fill: seriesColor(k) });
        s.text(p, sub("d", k), { dx: (17 * p[0]) / l, dy: (-17 * p[1]) / l, size: 12 });
      });
      s.knob(state.w, s.color("ink"), 6);
      s.text(state.w, "v", { dx: 12, dy: -12, size: 14 });
    },
  });
  dual.handles = () => [{
    pos: () => state.w,
    drag: (q) => { state.w = clampIntoConvex(data.d, q, 0.012 * data.R); update(); },
  }];

  const fibre = new Stage(right, {
    view: { xmin: -1, xmax: 1, ymin: -1, ymax: 1 }, aspect: 0.86, maxHeight: 420,
    label: "The fibre polytope over the chosen point",
    draw(s) {
      const F = fibrePolytope(data.vectors, data.lift(state.w)), E = 0.85 * data.extent;
      s.setView({ xmin: -E, xmax: E, ymin: -E, ymax: E });
      if (F.dim === 1) {
        if (!F.points.length) return;
        const half = F.volume / 2, a = [-half, 0], b = [half, 0];
        s.line(a, b, { stroke: s.color("ink"), width: 4 });
        [[a, F.facets[0]], [b, F.facets[1]]].forEach(([p, k], side) => {
          s.dot(p, { r: 7, fill: seriesColor(k), stroke: s.color("surface"), width: 2 });
          s.text(p, `${sub("t", k)} = 0`, { dy: -18, dx: side ? 10 : -10, size: 13 });
        });
        return;
      }
      const m = F.points.length;
      if (!m) return;
      const c = centroid(F.points), P = F.points.map((p) => [p[0] - c[0], p[1] - c[1]]);
      s.poly(P, { fill: withAlpha(s.color("ink-2"), 0.16) });
      P.forEach((p, k) => {
        const q = P[(k + 1) % m], i = F.facets[k];
        s.line(p, q, { stroke: seriesColor(i), width: 4 });
        // label the side by the coordinate that vanishes on it, just outside the polygon
        const mid = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], l = Math.hypot(mid[0], mid[1]) || 1;
        if (Math.hypot(q[0] - p[0], q[1] - p[1]) > 0.12 * E) {
          s.text(mid, `${sub("t", i)} = 0`, { dx: (26 * mid[0]) / l, dy: (-20 * mid[1]) / l, size: 12 });
        }
      });
      P.forEach((p) => s.dot(p, { r: 3.5, fill: s.color("ink") }));
    },
  });

  function update() {
    const F = fibrePolytope(data.vectors, data.lift(state.w));
    const spline = coneSpline(data.vectors, data.lift(state.w));
    const present = [...new Set(F.facets)].sort((a, b) => a - b);
    const what = F.dim === 1 ? "a segment" : `a polygon with <b>${F.points.length}</b> sides`;
    const size = F.dim === 1 ? "length" : "area";
    readout.innerHTML =
      `<p>The fibre over v is ${what}; the coordinates that vanish on its ${F.dim === 1 ? "ends" : "sides"}: ` +
      present.map((i) => `t<sub>${i}</sub>`).join(", ") + `.</p>` +
      `<p>${size} of the fibre ÷ √det(A Aᵀ) = ${fmt(F.volume)} ÷ ${fmt(F.gram)} = <b>${fmt(F.spline)}</b>` +
      `<br>value of the spline at v = <b>${fmt(spline)}</b></p>` +
      `<p>A side of colour k is present exactly when v lies in the polygon spanned by the other corners. ` +
      `It shrinks to a point as v reaches a diagonal through the two neighbours of d<sub>k</sub>.</p>`;
    dual.redraw();
    fibre.redraw();
  }

  const sides = choiceGroup("Number of sides of the polygon",
    [4, 5].map((v) => ({ value: v, label: String(v) })), 5,
    (v) => { state.n = v; rebuild(); update(); });

  root.append(el("div", { class: "controls" }, sides.node),
    el("div", { class: "fig-pair" },
      el("div", {}, el("div", { class: "plot-title" }, "Dual polygon with the spline; choose a point v"), left),
      el("div", {}, el("div", { class: "plot-title" }, "The fibre over v: moment polytope of the reduced space"), right)),
    el("div", { class: "legend" },
      el("span", { class: "key" }, el("i", { class: "ramp" }), "spline from 0 to its largest value")),
    el("p", { class: "hint" }, "Drag the point v inside the dual polygon, across its diagonals."),
    readout);
  update();
}
