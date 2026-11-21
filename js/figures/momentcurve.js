/**
 * momentcurve.js — Figure 12h (added remark): Lagrange's basis as triangle
 * coordinates on a parabola.
 *
 * Put three nodes t_0 < t_1 < t_2 on a line and lift them to the parabola
 * y = x² (the moment curve of degree 2). The barycentric coordinates of the
 * point (x, x²) with respect to the triangle of the three lifted nodes are the
 * quadratic Lagrange basis polynomials at x (math/interp.js): they sum to one
 * and reproduce x and x². The parabola never enters the triangle, so one of the
 * coordinates is always negative between the nodes, and two outside them.
 *
 * Left:  the parabola, the triangle and the point (x, x²), all draggable.
 * Right: the three basis polynomials as functions of x.
 */

import { Stage, seriesColor } from "../ui/stage.js";
import { el, fmt, sub } from "../ui/widgets.js";
import { triangleCanonical } from "../math/canonical.js";
import {
  polynomialWeights, baryCoordinates, nodePolynomial, simplexCoordinates, momentCurve,
} from "../math/interp.js";

const X_RANGE = [-1.45, 1.45];
const GAP = 0.25;                       // smallest distance between two nodes
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function initMomentCurve(root) {
  const state = { t: [-1, 0.1, 1.05], x: 0.6 };
  const left = el("div"), right = el("div");
  const readout = el("div", { class: "readout", "aria-live": "polite" });
  const lift = (x) => [x, x * x];

  const curve = new Stage(left, {
    view: { xmin: X_RANGE[0], xmax: X_RANGE[1], ymin: -0.35, ymax: 2.2 },
    equal: false, aspect: 0.86, maxHeight: 420,
    label: "A parabola with a triangle whose corners lie on it, and a movable point on the parabola",
    draw(s) {
      const { t, x } = state, P = t.map(lift), v = s.view;
      s.line([v.xmin, 0], [v.xmax, 0], { stroke: s.color("axis"), width: 1 });
      // the three edge lines, continued; edge k lies opposite corner k and wears its colour
      s.clipped(() => {
        for (let k = 0; k < 3; k++) {
          const a = P[(k + 1) % 3], b = P[(k + 2) % 3], m = (b[1] - a[1]) / (b[0] - a[0]);
          s.line([v.xmin, a[1] + m * (v.xmin - a[0])], [v.xmax, a[1] + m * (v.xmax - a[0])],
            { stroke: seriesColor(k), width: 1, dash: [5, 4] });
        }
        s.poly(P, { fill: s.color("fill-soft"), stroke: s.color("ink"), width: 2 });
        const pts = [];
        for (let k = 0; k <= 200; k++) pts.push(lift(v.xmin + ((v.xmax - v.xmin) * k) / 200));
        s.poly(pts, { stroke: s.color("ink-2"), width: 1.75, open: true });
      });
      // the nodes on the line, and their lifts
      t.forEach((tk, k) => {
        s.line([tk, 0], P[k], { stroke: s.color("axis"), width: 1, dash: [2, 3] });
        s.dot([tk, 0], { r: 3.5, fill: seriesColor(k) });
        s.text([tk, 0], sub("t", k), { dy: 14, size: 13 });
        s.knob(P[k], seriesColor(k), 6);
      });
      s.line([x, 0], lift(x), { stroke: s.color("axis"), width: 1, dash: [2, 3] });
      s.dot([x, 0], { r: 3.5, fill: s.color("ink") });
      s.text([x, 0], "x", { dy: 14, size: 13 });
      s.knob(lift(x), s.color("ink"), 6);
      s.text(lift(x), "(x, x²)", { dx: 34, dy: 6, size: 12 });
    },
  });
  curve.handles = () => [
    ...state.t.map((_, k) => ({
      pos: () => lift(state.t[k]),
      drag: (q) => {
        const lo = k === 0 ? X_RANGE[0] + 0.1 : state.t[k - 1] + GAP;
        const hi = k === 2 ? X_RANGE[1] - 0.1 : state.t[k + 1] - GAP;
        state.t[k] = clamp(q[0], lo, hi);
        update();
      },
    })),
    { pos: () => lift(state.x), drag: (q) => { state.x = clamp(q[0], X_RANGE[0] + 0.05, X_RANGE[1] - 0.05); update(); } },
  ];

  const basis = new Stage(right, {
    view: { xmin: X_RANGE[0], xmax: X_RANGE[1], ymin: -0.75, ymax: 1.75 },
    equal: false, aspect: 0.86, maxHeight: 420, pad: { l: 34, r: 10, t: 12, b: 24 },
    label: "The three quadratic Lagrange basis polynomials for the chosen nodes",
    draw(s) {
      const { t, x } = state, c = polynomialWeights(t), v = s.view;
      s.axes({ xticks: [-1, 0, 1].map((u) => [u, String(u)]), yticks: [-0.5, 0, 0.5, 1, 1.5].map((u) => [u, String(u)]) });
      s.clipped(() => {
        s.line([v.xmin, 0], [v.xmax, 0], { stroke: s.color("axis"), width: 1 });
        s.line([v.xmin, 1], [v.xmax, 1], { stroke: s.color("axis"), width: 1, dash: [4, 4] });
        s.line([x, v.ymin], [x, v.ymax], { stroke: s.color("ink-2"), width: 1 });
        for (let j = 0; j < 3; j++) {
          const pts = [];
          for (let k = 0; k <= 240; k++) {
            const u = v.xmin + ((v.xmax - v.xmin) * k) / 240;
            pts.push([u, baryCoordinates(t, c, u)[j]]);
          }
          s.poly(pts, { stroke: seriesColor(j), width: 2, open: true });
        }
        const lam = baryCoordinates(t, c, x);
        lam.forEach((l, j) => s.dot([x, l], { r: 4.5, fill: seriesColor(j), stroke: s.color("surface"), width: 1.5 }));
      });
      t.forEach((tk, k) => s.dot([tk, 0], { r: 3.5, fill: seriesColor(k) }));
      s.knob([x, v.ymin], s.color("ink"), 5);
    },
  });
  basis.handles = () => [{
    pos: () => [state.x, basis.view.ymin],
    drag: (q) => { state.x = clamp(q[0], X_RANGE[0] + 0.05, X_RANGE[1] - 0.05); update(); },
  }];

  function update() {
    const { t, x } = state, c = polynomialWeights(t);
    const beta = simplexCoordinates(t.map((tk) => momentCurve(2, tk)), momentCurve(2, x));
    const lam = baryCoordinates(t, c, x), ell = nodePolynomial(t, x);
    const V = Math.abs((t[1] - t[0]) * (t[2] - t[0]) * (t[2] - t[1]));
    const P = t.map(lift), C = triangleCanonical(P[0], P[1], P[2], lift(x));
    const negative = lam.filter((l) => l < -1e-12).length;
    readout.innerHTML =
      `<table><thead><tr><th>node</th><th>coordinate of (x, x²) in the triangle</th>` +
      `<th>pole term c<sub>j</sub> / (x − t<sub>j</sub>)</th><th>Lagrange basis ℓ<sub>j</sub>(x)</th></tr></thead><tbody>` +
      lam.map((l, j) => `<tr><td>t<sub>${j}</sub> = ${fmt(t[j], 2)}</td><td><b>${fmt(beta[j])}</b></td>` +
        `<td>${fmt(c[j] / (x - t[j]))}</td><td><b>${fmt(l)}</b></td></tr>`).join("") +
      `<tr><td>sum</td><td><b>${fmt(beta.reduce((a, b) => a + b, 0))}</b></td>` +
      `<td>1 / ℓ(x) = ${fmt(1 / ell)}</td><td><b>${fmt(lam.reduce((a, b) => a + b, 0))}</b></td></tr></tbody></table>` +
      `<p>${negative === 0 ? "The point is a corner of the triangle." :
        `The point lies outside the triangle: <b>${negative}</b> of the three coordinates ${negative === 1 ? "is" : "are"} negative.`}</p>` +
      `<p>Canonical function of the triangle at (x, x²): <b>${fmt(C)}</b>; ` +
      `&nbsp; −V / ℓ(x)² = <b>${fmt(-V / (ell * ell))}</b>, with V = ${fmt(V)} twice the area of the triangle.</p>`;
    curve.redraw();
    basis.redraw();
  }

  root.append(
    el("div", { class: "fig-pair" },
      el("div", {}, el("div", { class: "plot-title" }, "The nodes lifted to the parabola y = x²"), left),
      el("div", {}, el("div", { class: "plot-title" }, "Lagrange’s basis polynomials"), right)),
    el("p", { class: "hint" }, "Drag the three corners along the parabola, or the point (x, x²)."),
    readout);
  update();
}
