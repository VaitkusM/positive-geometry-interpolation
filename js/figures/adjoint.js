/**
 * adjoint.js — Figure 6: the adjoint curve of a convex polygon.
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

/**
 * Marching squares: line segments approximating { f = 0 } inside `view`.
 * Returns an array of [[x0, y0], [x1, y1]] world-space segments.
 */
function zeroSet(f, view, nx) {
  const dx = (view.xmax - view.xmin) / nx;
  const ny = Math.round((view.ymax - view.ymin) / dx), dy = (view.ymax - view.ymin) / ny;
  const val = [];
  for (let j = 0; j <= ny; j++) {
    const row = new Float64Array(nx + 1);
    for (let i = 0; i <= nx; i++) row[i] = f(view.xmin + i * dx, view.ymin + j * dy);
    val.push(row);
  }
  const segs = [];
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const x0 = view.xmin + i * dx, y0 = view.ymin + j * dy;
      // corner values, counter-clockwise from the lower-left corner
      const v = [val[j][i], val[j][i + 1], val[j + 1][i + 1], val[j + 1][i]];
      const c = [[x0, y0], [x0 + dx, y0], [x0 + dx, y0 + dy], [x0, y0 + dy]];
      const cross = [];
      for (let e = 0; e < 4; e++) {
        const a = v[e], b = v[(e + 1) % 4];
        if ((a < 0) !== (b < 0)) {
          const t = a / (a - b), p = c[e], q = c[(e + 1) % 4];
          cross.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
        }
      }
      if (cross.length === 2) segs.push([cross[0], cross[1]]);
      else if (cross.length === 4) {
        // saddle cell: use the centre value to decide how to pair the crossings
        const centre = f(x0 + dx / 2, y0 + dy / 2);
        if ((centre < 0) === (v[0] < 0)) segs.push([cross[0], cross[1]], [cross[2], cross[3]]);
        else segs.push([cross[3], cross[0]], [cross[1], cross[2]]);
      }
    }
  }
  return segs;
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
      const c = s.ctx;
      c.beginPath();
      for (const [a, b] of zeroSet(makeAdjoint(pts), VIEW, GRID)) {
        const p = s.toScreen(a), q = s.toScreen(b);
        c.moveTo(p[0], p[1]);
        c.lineTo(q[0], q[1]);
      }
      c.lineWidth = 2.5;
      c.strokeStyle = seriesColor(1);
      c.stroke();
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
