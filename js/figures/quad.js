/**
 * quad.js — Figure 15 (later developments): the canonical form of a
 * quadrilateral as a push-forward, and when coordinates become polynomial.
 *
 * Left:  the unit square, the domain of the bilinear patch B(u, v), with the
 *        preimages of x (one always lies in the square; the second one is
 *        outside it, or complex).
 * Right: the quadrilateral with the image of the square's grid, the point x
 *        and the adjoint line.
 * Read-out: the two terms of the push-forward sum and the canonical function
 * they add up to; bilinear blending functions versus Wachspress coordinates.
 * "Make it a parallelogram" shows the degenerate case: the map becomes
 * affine, the adjoint constant, and both sets of coordinates coincide and
 * are polynomial (Wachspress 1975; Winter & Baumbach 2026 in general).
 * Math: js/math/pushforward.js.
 */

import { Stage, seriesColor } from "../ui/stage.js";
import { el, fmt, sub } from "../ui/widgets.js";
import { edgeLines, lineIntersection, isConvexCCW, clampIntoConvex, centroid } from "../math/polygon.js";
import { polygonCanonical } from "../math/canonical.js";
import { wachspress } from "../math/barycentric.js";
import { inverseBilinear, bilinear, bilinearWeights } from "../math/pushforward.js";
import { attachPolygonHandles } from "./common.js";

const VIEW = { xmin: -4.0, xmax: 4.0, ymin: -2.9, ymax: 2.9 };
const DRAG_BOX = { xmin: -2.0, xmax: 2.0, ymin: -1.7, ymax: 1.9 }; // vertices stay in here
const SQUARE_VIEW = { xmin: -0.75, xmax: 1.75, ymin: -0.75, ymax: 1.75 };
// a clearly non-parallel quadrilateral, so that the adjoint line is in view
const START = [[-1.2, -0.7], [1.2, -0.9], [0.5, 0.8], [-0.4, 0.5]];
const GRID = 8;
const isReal = (z) => Math.abs(z[1]) < 1e-9;

export function initQuad(root) {
  const state = { pts: START.map((p) => [...p]), x: [0.1, -0.1] };
  const left = el("div", { class: "fig-side" }), right = el("div", { class: "fig-main" });
  const readout = el("div", { class: "readout", "aria-live": "polite" });

  const square = new Stage(left, {
    view: SQUARE_VIEW, aspect: 1, maxHeight: 360,
    label: "The unit square in the parameters u and v, with the preimages of x",
    draw(s) {
      const sq = [[0, 0], [1, 0], [1, 1], [0, 1]];
      s.poly(sq, { fill: s.color("fill-soft") });
      for (let k = 1; k < GRID; k++) {
        s.line([k / GRID, 0], [k / GRID, 1], { stroke: s.color("axis"), width: 1 });
        s.line([0, k / GRID], [1, k / GRID], { stroke: s.color("axis"), width: 1 });
      }
      s.poly(sq, { stroke: s.color("ink"), width: 2 });
      s.text([0.5, 0], "u", { dy: 14, size: 13 });
      s.text([0, 0.5], "v", { dx: -12, size: 13 });
      sq.forEach((p, i) => s.text(p, sub("p", i),
        { dx: p[0] ? 14 : -14, dy: p[1] ? -12 : 12, size: 12, color: s.color("ink-2") }));
      inverseBilinear(state.pts, state.x).forEach((r) => {
        if (!isReal(r.u)) return;
        const p = [r.u[0], r.v[0]];
        const inSquare = p[0] > 0 && p[0] < 1 && p[1] > 0 && p[1] < 1;
        s.knob(p, inSquare ? s.color("ink") : seriesColor(1), 5);
      });
    },
  });

  const quad = new Stage(right, {
    view: VIEW, aspect: 0.74, maxHeight: 420,
    label: "Quadrilateral with the image of the square's grid, the point x and the adjoint line",
    draw(s) {
      const { pts, x } = state, lines = edgeLines(pts);
      s.poly(pts, { fill: s.color("fill-soft") });
      for (let k = 1; k < GRID; k++) {
        const t = k / GRID; // the bilinear map sends grid lines to straight segments
        s.line(bilinear(pts, t, 0), bilinear(pts, t, 1), { stroke: s.color("axis"), width: 1 });
        s.line(bilinear(pts, 0, t), bilinear(pts, 1, t), { stroke: s.color("axis"), width: 1 });
      }
      // adjoint: the line through the two intersection points of opposite sides
      const a = lineIntersection(lines[0], lines[2]), b = lineIntersection(lines[1], lines[3]);
      const far = (p) => !p || Math.hypot(p[0], p[1]) > 1e4;
      if (!far(a) && !far(b)) {
        const d = [b[0] - a[0], b[1] - a[1]], l = Math.hypot(d[0], d[1]);
        s.fullLine({ n: [-d[1] / l, d[0] / l], p: a }, { stroke: seriesColor(1), width: 2.5 });
        for (const q of [a, b]) { s.dot(q, { r: 6.5, fill: s.color("surface") }); s.dot(q, { r: 4.5, fill: seriesColor(1) }); }
      }
      s.poly(pts, { stroke: s.color("ink"), width: 2 });
      const c = centroid(pts);
      pts.forEach((p, k) => {
        s.knob(p, s.color("ink"), 6);
        const dd = [p[0] - c[0], p[1] - c[1]], l = Math.hypot(...dd);
        s.text(p, sub("p", k), { dx: (18 * dd[0]) / l, dy: (-18 * dd[1]) / l, size: 14 });
      });
      s.knob(x, s.color("ink"), 6);
      s.text(x, "x", { dx: 12, dy: -12, size: 14 });
    },
  });

  function update() {
    const { pts, x } = state;
    const roots = inverseBilinear(pts, x);
    const C = polygonCanonical(pts, x);
    const sum = roots.reduce((acc, r) => acc + r.term[0], 0);
    const inSq = roots.find((r) => isReal(r.u) && r.u[0] > 0 && r.u[0] < 1 && r.v[0] > 0 && r.v[0] < 1);
    let html;
    if (roots.length === 1) {
      html = `<p>The quadrilateral is a parallelogram, so the map is affine and x has a single preimage ` +
        `(u, v) = (${fmt(roots[0].u[0])}, ${fmt(roots[0].v[0])}), contributing <b>${fmt(roots[0].term[0])}</b>.`;
    } else if (roots.every((r) => isReal(r.u))) {
      const other = roots.find((r) => r !== inSq);
      html = `<p>Two real preimages: (u, v) = (${fmt(inSq.u[0])}, ${fmt(inSq.v[0])}) inside the square, contributing ` +
        `<b>${fmt(inSq.term[0])}</b>, and (${fmt(other.u[0], 2)}, ${fmt(other.v[0], 2)}) outside it, contributing ` +
        `<b>${fmt(other.term[0])}</b>.`;
    } else {
      html = `<p>The two preimages are complex conjugates, (u, v) = (${fmt(roots[0].u[0], 2)} ± ${fmt(Math.abs(roots[0].u[1]), 2)} i, …); ` +
        `their contributions ${fmt(roots[0].term[0])} ± ${fmt(Math.abs(roots[0].term[1]))} i add up to a real number.`;
    }
    html += `<br>Sum over the preimages = <b>${fmt(sum)}</b>; &nbsp; canonical function of the quadrilateral ` +
      `(wedge formula of Section 5) = <b>${fmt(C)}</b>.</p>`;
    const lam = wachspress(pts, x), bil = bilinearWeights(inSq.u[0], inSq.v[0]);
    const same = roots.length === 1; // parallelogram: the bilinear map is affine
    html += `<table><thead><tr><th></th>${lam.map((_, i) => `<th>p<sub>${i}</sub></th>`).join("")}</tr></thead><tbody>` +
      `<tr><td>bilinear blending functions at (u, v)</td>${bil.map((w) => `<td>${fmt(w)}</td>`).join("")}</tr>` +
      `<tr><td>Wachspress coordinates of x</td>${lam.map((w) => `<td>${fmt(w)}</td>`).join("")}</tr></tbody></table>` +
      `<p>${same
        ? "Parallelogram: the two rows agree, the adjoint is constant and the coordinates are polynomial."
        : "Both rows are barycentric coordinates of x, but they differ: the Wachspress coordinates are rational with the adjoint line as their pole, the bilinear ones involve a square root."}</p>`;
    readout.innerHTML = html;
    square.redraw();
    quad.redraw();
  }

  attachPolygonHandles(quad, state, { bounds: DRAG_BOX, onChange: update, margin: 0.05 });

  const makeParallelogram = el("button", { type: "button", class: "choice", onclick: () => {
    // keep p0, p1, p3 and move p2 to the fourth corner of the parallelogram
    const [p0, p1, , p3] = state.pts;
    const trial = [p0, p1, [p1[0] + p3[0] - p0[0], p1[1] + p3[1] - p0[1]], p3];
    if (isConvexCCW(trial, 0.06, 0.25)) {
      state.pts = trial;
      state.x = clampIntoConvex(trial, state.x, 0.05);
      update();
    }
  } }, "Make it a parallelogram");
  const reset = el("button", { type: "button", class: "choice", onclick: () => {
    state.pts = START.map((p) => [...p]);
    state.x = [0.1, -0.1];
    update();
  } }, "Reset");

  root.append(el("div", { class: "controls" }, el("div", { class: "choices" }, makeParallelogram, reset)),
    el("div", { class: "legend" },
      el("span", { class: "key" }, el("i", { style: "background:var(--series-2)" }),
        "adjoint line, and a second real preimage outside the square")),
    el("div", { class: "fig-split reverse" }, left, right),
    el("p", { class: "hint" }, "Drag the vertices of the quadrilateral or the point x."), readout);
  update();
}
