/**
 * adjoint.js — Figure 7: the adjoint curve of a convex polygon.
 *
 * The canonical function of a polygon is  C = adj(x) / Π h_i(x). The
 * numerator adj is a polynomial of degree n − 3 that vanishes at every
 * intersection point of two NON-adjacent edge lines ("external vertices");
 * these n(n−3)/2 conditions determine it up to scale (Wachspress, Warren).
 *
 * The figure draws the edge-line arrangement, the external vertices and the
 * zero set of adj, traced with marching squares.
 */

import { Stage, seriesColor } from "../ui/stage.js";
import { el, choiceGroup } from "../ui/widgets.js";
import { edgeLines, lineDist, lineIntersection, det2, mod } from "../math/polygon.js";
import { defaultPolygon, attachPolygonHandles } from "./common.js";
import { zeroSet, strokeSegments } from "../ui/contour.js";

const VIEW = { xmin: -4.6, xmax: 4.6, ymin: -3.3, ymax: 3.3 };
const DRAG_BOX = { xmin: -1.7, xmax: 1.7, ymin: -1.7, ymax: 1.7 }; // vertices stay in here
const GRID = 240; // marching-squares cells across the view
const CURVE_NAMES = { 1: "a line", 2: "a conic", 3: "a cubic curve", 4: "a quartic curve" };

/** adj(x) with pre-computed edge lines (same formula as canonical.js, but fast). */
function makeAdjoint(pts) {
  const lines = edgeLines(pts), n = lines.length;
  const dets = lines.map((l, i) => det2(lines[mod(i - 1, n)].n, l.n));
  const h = new Float64Array(n);
  return (x, y) => {
    for (let i = 0; i < n; i++) h[i] = lines[i].n[0] * (x - lines[i].p[0]) + lines[i].n[1] * (y - lines[i].p[1]);
    let s = 0;
    for (let i = 0; i < n; i++) {
      const j = i === 0 ? n - 1 : i - 1;
      let prod = dets[i];
      for (let k = 0; k < n; k++) if (k !== i && k !== j) prod *= h[k];
      s += prod;
    }
    return s;
  };
}

export function initAdjoint(root) {
  const state = { pts: defaultPolygon(5) };
  const box = el("div");
  const readout = el("p", { class: "readout", "aria-live": "polite" });

  const stage = new Stage(box, {
    view: VIEW, aspect: 0.72, maxHeight: 520,
    label: "Edge lines of a polygon, their external intersection points and the adjoint curve through them",
    draw(s) {
      const { pts } = state;
      const lines = edgeLines(pts), n = pts.length;
      lines.forEach((l) => s.fullLine(l, { stroke: s.color("axis"), width: 1 }));
      s.poly(pts, { fill: s.color("fill-soft"), stroke: s.color("ink"), width: 2 });
      // the adjoint curve
      strokeSegments(s, zeroSet(makeAdjoint(pts), VIEW, GRID), seriesColor(1), 2.5);
      // external vertices: intersections of non-adjacent edge lines
      for (let i = 0; i < n; i++) {
        for (let j = i + 2; j < n; j++) {
          if (i === 0 && j === n - 1) continue;
          const q = lineIntersection(lines[i], lines[j]);
          if (q) { s.dot(q, { r: 6.5, fill: s.color("surface") }); s.dot(q, { r: 4.5, fill: seriesColor(1) }); }
        }
      }
      pts.forEach((p) => s.knob(p, s.color("ink"), 6));
    },
  });

  function update() {
    const n = state.pts.length, deg = n - 3, lines = edgeLines(state.pts);
    let visible = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 2; j < n; j++) {
        if (i === 0 && j === n - 1) continue;
        const q = lineIntersection(lines[i], lines[j]);
        if (q && q[0] > VIEW.xmin && q[0] < VIEW.xmax && q[1] > VIEW.ymin && q[1] < VIEW.ymax) visible++;
      }
    }
    const total = (n * (n - 3)) / 2;
    readout.innerHTML =
      `n = ${n} edges: the adjoint has degree n − 3 = <b>${deg}</b> (${CURVE_NAMES[deg]}) and passes through ` +
      `all n(n−3)/2 = <b>${total}</b> external intersection points` +
      (visible < total ? ` (${visible} of them are inside this picture).` : ".");
    stage.redraw();
  }

  attachPolygonHandles(stage, state, { bounds: DRAG_BOX, onChange: update });
  const sides = choiceGroup("Number of vertices",
    [4, 5, 6, 7].map((v) => ({ value: v, label: String(v) })), 5,
    (v) => { state.pts = defaultPolygon(v); update(); });

  root.append(el("div", { class: "controls" }, sides.node),
    el("div", { class: "legend" },
      el("span", { class: "key" }, el("i", { style: "background:var(--series-2)" }),
        "adjoint curve adj(x) = 0 and the external intersection points")),
    box, el("p", { class: "hint" }, "Drag the vertices of the polygon."), readout);
  update();
}
