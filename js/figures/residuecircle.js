/**
 * residuecircle.js — Figure 12i (added remark): the residue theorem for a set of nodes.
 *
 * The form  ℓ(x) g(t) dt / (ℓ(t) (x − t))  with g(t) = t^k has a pole at every
 * node t_j, with residue λ_j(x) g(t_j), and one at t = x with residue −g(x)
 * (math/interp.js). The integral over a closed curve, divided by 2πi, is the
 * sum of the residues inside. A circle around all poles gives zero as long as
 * k is at most the number of nodes minus one: this is Σ λ_j g(t_j) = g(x). One
 * degree higher the form has a pole at infinity, and the sum is −ℓ(x).
 *
 * The picture is the complex t-plane with the poles, their residues, and a
 * circle that can be moved and resized.
 */

import { Stage, seriesColor, withAlpha } from "../ui/stage.js";
import { el, fmt, sub, choiceGroup } from "../ui/widgets.js";
import {
  equispaced, polynomialWeights, kernelResidues, kernelCircleIntegral, nodePolynomial,
} from "../math/interp.js";

const VIEW = { xmin: -2.3, xmax: 2.3, ymin: -1.2, ymax: 1.2 };
const N = 4;                                   // degree: five nodes
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function initResidueCircle(root) {
  const nodes = equispaced(N), weights = polynomialWeights(nodes);
  const state = { x: 0.27, degree: 0, centre: [-0.4, 0.3], radius: 0.85 };
  const box = el("div");
  const readout = el("div", { class: "readout", "aria-live": "polite" });

  const poles = () => kernelResidues(nodes, weights, state.x, state.degree);
  const inside = (p) => Math.hypot(p.at - state.centre[0], state.centre[1]) < state.radius;
  /** The handle that sets the radius sits on the circle, up and to the right of the centre. */
  const rim = () => [state.centre[0] + state.radius * Math.SQRT1_2, state.centre[1] + state.radius * Math.SQRT1_2];

  const stage = new Stage(box, {
    view: VIEW, aspect: 0.53, maxHeight: 400,
    label: "The complex plane with the poles of the form at the nodes and at x, and a movable circle",
    draw(s) {
      const { centre, radius } = state, ring = [];
      for (let k = 0; k <= 180; k++) { const th = (2 * Math.PI * k) / 180; ring.push([centre[0] + radius * Math.cos(th), centre[1] + radius * Math.sin(th)]); }
      s.poly(ring, { fill: withAlpha(seriesColor(0), 0.12), stroke: seriesColor(0), width: 2 });
      s.line([VIEW.xmin, 0], [VIEW.xmax, 0], { stroke: s.color("axis"), width: 1 });
      s.text([VIEW.xmax, 0], "real axis", { dx: -34, dy: 12, size: 11, color: s.color("ink-2") });
      poles().forEach((p, i) => {
        const at = [p.at, 0], isX = p.node < 0, enclosed = inside(p);
        if (enclosed) s.dot(at, { r: 12, fill: withAlpha(seriesColor(0), 0.25), stroke: seriesColor(0), width: 1.5 });
        if (isX) s.knob(at, s.color("ink"), 6); else s.dot(at, { r: 5, fill: seriesColor(1), stroke: s.color("surface"), width: 2 });
        // residues above the axis, names below; neighbours are staggered so that the numbers do not collide
        const up = isX ? -44 : (i % 2 ? -22 : -36);
        s.text(at, fmt(p.residue, 2), { dy: up, size: 12, weight: enclosed ? 700 : 500 });
        s.text(at, isX ? "x" : sub("t", p.node), { dy: 18, size: 12, color: s.color("ink-2") });
      });
      s.dot(centre, { r: 4, fill: seriesColor(0), stroke: s.color("surface"), width: 2 });
      s.knob(rim(), seriesColor(0), 5);
    },
  });
  stage.handles = () => [
    { pos: () => [state.x, 0],
      drag: (q) => {
        let x = clamp(q[0], VIEW.xmin + 0.15, VIEW.xmax - 0.15);
        for (const t of nodes) if (Math.abs(x - t) < 0.06) x = t + (x >= t ? 0.06 : -0.06);   // x may not sit on a node
        state.x = x; update();
      } },
    { pos: rim,
      drag: (q) => { state.radius = clamp(Math.hypot(q[0] - state.centre[0], q[1] - state.centre[1]), 0.12, 2.6); update(); } },
    { pos: () => state.centre,
      drag: (q) => { state.centre = [clamp(q[0], VIEW.xmin, VIEW.xmax), clamp(q[1], VIEW.ymin, VIEW.ymax)]; update(); } },
  ];

  function update() {
    const all = poles(), enclosed = all.filter(inside);
    const sumInside = enclosed.reduce((a, p) => a + p.residue, 0), sumAll = all.reduce((a, p) => a + p.residue, 0);
    const gap = Math.min(...all.map((p) => Math.abs(Math.hypot(p.at - state.centre[0], state.centre[1]) - state.radius)));
    const integral = gap < 0.02 ? null : kernelCircleIntegral(nodes, weights, state.x, state.degree, state.centre, state.radius, 3000)[0];
    const g = state.degree === 0 ? "1" : state.degree === 1 ? "t" : `t<sup>${state.degree}</sup>`;
    readout.innerHTML =
      `<table><thead><tr><th>g(t) = ${g}, five nodes, x = ${fmt(state.x, 2)}</th><th>value</th></tr></thead><tbody>` +
      `<tr><td>sum of the residues inside the circle (${enclosed.length} of ${all.length} poles)</td><td><b>${fmt(sumInside)}</b></td></tr>` +
      `<tr><td>integral over the circle ÷ 2πi (numerical)</td><td><b>${integral === null ? "a pole lies on the circle" : fmt(integral)}</b></td></tr>` +
      `<tr><td>sum of all residues in the plane</td><td><b>${fmt(Math.abs(sumAll) < 5e-13 ? 0 : sumAll)}</b></td></tr></tbody></table>` +
      (state.degree <= N
        ? `<p>The degree of g is at most ${N}, so there is no pole at infinity: a circle around all six poles gives zero, ` +
          `which is Σ λ<sub>j</sub>(x) g(t<sub>j</sub>) = g(x).</p>`
        : `<p>The degree of g is ${N + 1}, one too many: the form has a pole at infinity as well, and the residues in the plane ` +
          `add up to −ℓ(x) = <b>${fmt(-nodePolynomial(nodes, state.x))}</b> instead of zero. Polynomials of degree ${N + 1} are not reproduced.</p>`);
    stage.redraw();
  }

  const degree = choiceGroup("g(t)",
    [{ value: 0, label: "1" }, { value: 1, label: "t" }, { value: N, label: `t${"⁰¹²³⁴⁵"[N]}` }, { value: N + 1, label: `t${"⁰¹²³⁴⁵"[N + 1]}` }],
    state.degree, (v) => { state.degree = v; update(); });

  root.append(el("div", { class: "controls" }, degree.node), box,
    el("div", { class: "legend" },
      el("span", { class: "key" }, el("i", { style: "background:var(--series-2); height:8px; width:8px; border-radius:50%" }), "pole at a node; the number above it is its residue λⱼ(x) g(tⱼ)"),
      el("span", { class: "key" }, el("i", { style: "background:var(--ink); height:8px; width:8px; border-radius:50%" }), "pole at x, residue −g(x)"),
      el("span", { class: "key" }, el("i", { style: "background:var(--series-1)" }), "the contour")),
    el("p", { class: "hint" }, "Drag the centre of the circle, the handle on it, or the point x."),
    readout);
  update();
}
