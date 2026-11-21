/**
 * baryrational.js — Figure 12i (added remark): other weights in the same formula.
 *
 * The barycentric formula
 *     r(x) = Σ w_j f_j / (x − t_j)  /  Σ w_j / (x − t_j)
 * interpolates for any non-zero weights (math/interp.js). The weights decide
 * everything else: the degree of the polynomials that are reproduced (the
 * number of vanishing moments Σ w_j t_j^k), the denominator polynomial
 * D(x) = ℓ(x) Σ w_j / (x − t_j) whose zeros are the poles of r, and the size of
 * the coordinates λ_j, measured by the Lebesgue function Σ |λ_j|.
 *
 * Top:    the function, its interpolant and the data.
 * Bottom: the coordinates λ_j(x) and the Lebesgue function.
 */

import { Stage, seriesColor } from "../ui/stage.js";
import { el, fmt, choiceGroup, slider } from "../ui/widgets.js";
import {
  equispaced, polynomialWeights, berrutWeights, floaterHormannWeights,
  baryCoordinates, baryEval, denominator, lebesgue, precisionDegree,
} from "../math/interp.js";

const N = 560;                                    // samples per curve
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const f = (x) => 1 / (1 + 25 * x * x);            // Runge's example
const KINDS = [
  { value: "poly", label: "Polynomial" },
  { value: "berrut", label: "Berrut" },
  { value: "fh1", label: "Floater–Hormann, d = 1" },
  { value: "fh3", label: "Floater–Hormann, d = 3" },
];

export function initBaryRational(root) {
  const state = { n: 10, kind: "poly" };
  const top = el("div"), bottom = el("div");
  const readout = el("div", { class: "readout", "aria-live": "polite" });
  let t, w, values;

  function rebuild() {
    t = equispaced(state.n);
    w = state.kind === "poly" ? polynomialWeights(t)
      : state.kind === "berrut" ? berrutWeights(t)
      : floaterHormannWeights(t, Math.min(state.n, state.kind === "fh1" ? 1 : 3));
    values = t.map(f);
  }
  rebuild();

  const xticks = [-1, -0.5, 0, 0.5, 1].map((u) => [u, String(u)]);
  const pad = { l: 34, r: 12, t: 12, b: 26 };

  const upper = new Stage(top, {
    view: { xmin: -1.04, xmax: 1.04, ymin: -0.6, ymax: 1.6 },
    equal: false, aspect: 0.36, maxHeight: 250, pad,
    label: "Runge's function and its barycentric interpolant at equally spaced nodes",
    draw(s) {
      s.axes({ xticks, yticks: [-0.5, 0, 0.5, 1, 1.5].map((u) => [u, String(u)]) });
      s.clipped(() => {
        const fp = [], rp = [];
        for (let k = 0; k <= N; k++) {
          const x = -1 + (2 * k) / N;
          fp.push([x, f(x)]);
          rp.push([x, clamp(baryEval(t, w, values, x), -50, 50)]);
        }
        s.poly(fp, { stroke: s.color("ink"), width: 2, open: true });
        s.poly(rp, { stroke: seriesColor(0), width: 2, open: true });
        t.forEach((tj, j) => s.dot([tj, values[j]], { r: 3.5, fill: s.color("ink"), stroke: s.color("surface"), width: 1 }));
      });
    },
  });

  const lower = new Stage(bottom, {
    view: { xmin: -1.04, xmax: 1.04, ymin: -1.5, ymax: 4.5 },
    equal: false, aspect: 0.36, maxHeight: 250, pad,
    label: "The coordinate functions of the interpolant and their Lebesgue function",
    draw(s) {
      const v = s.view;
      s.axes({ xticks, yticks: [-1, 0, 1, 2, 3, 4].map((u) => [u, String(u)]) });
      s.clipped(() => {
        s.line([v.xmin, 0], [v.xmax, 0], { stroke: s.color("axis"), width: 1 });
        s.line([v.xmin, 1], [v.xmax, 1], { stroke: s.color("axis"), width: 1, dash: [4, 4] });
        const curves = t.map(() => []), leb = [];
        for (let k = 0; k <= N; k++) {
          const x = -1 + (2 * k) / N, lam = baryCoordinates(t, w, x);
          lam.forEach((l, j) => curves[j].push([x, clamp(l, -60, 60)]));
          leb.push([x, clamp(lam.reduce((a, l) => a + Math.abs(l), 0), -60, 60)]);
        }
        curves.forEach((pts, j) => s.poly(pts, { stroke: seriesColor(j), width: 1.25, open: true }));
        s.poly(leb, { stroke: s.color("ink"), width: 2.25, open: true });
      });
      t.forEach((tj, j) => s.dot([tj, 0], { r: 3, fill: seriesColor(j) }));
    },
  });

  function update() {
    const n = state.n, d = precisionDegree(t, w);
    // real zeros of the denominator in [−1, 1]: sign changes on a fine grid
    let zeros = 0, last = Math.sign(denominator(t, w, -1)), worst = 0, lebMax = 0;
    for (let k = 1; k <= 4000; k++) {
      const x = -1 + k / 2000, sgn = Math.sign(denominator(t, w, x));
      if (sgn !== 0 && last !== 0 && sgn !== last) zeros++;
      if (sgn !== 0) last = sgn;
      worst = Math.max(worst, Math.abs(f(x) - baryEval(t, w, values, x)));
      lebMax = Math.max(lebMax, lebesgue(t, w, x));
    }
    readout.innerHTML =
      `<table><thead><tr><th>${n + 1} equally spaced nodes</th><th>value</th></tr></thead><tbody>` +
      `<tr><td>polynomials reproduced: degree up to</td><td><b>${d}</b></td></tr>` +
      `<tr><td>degree of the denominator D (number of poles of the interpolant, real or complex)</td><td><b>${n - d}</b></td></tr>` +
      `<tr><td>poles inside [−1, 1]</td><td><b>${zeros}</b></td></tr>` +
      `<tr><td>largest value of Σ |λ<sub>j</sub>| (Lebesgue constant)</td><td><b>${fmt(lebMax, 2)}</b></td></tr>` +
      `<tr><td>largest error on [−1, 1]</td><td><b>${fmt(worst)}</b></td></tr></tbody></table>`;
    upper.redraw();
    lower.redraw();
  }

  const kind = choiceGroup("Weights", KINDS, state.kind, (v) => { state.kind = v; rebuild(); update(); });
  const count = slider("Number of nodes", { min: 3, max: 21, step: 1, value: state.n + 1 }, (v) => String(v),
    (v) => { state.n = v - 1; rebuild(); update(); });

  root.append(el("div", { class: "controls" }, kind.node, count.node),
    el("div", { class: "plot-title" }, "The function 1 / (1 + 25 x²) and its interpolant"), top,
    el("div", { class: "legend" },
      el("span", { class: "key" }, el("i", { style: "background:var(--ink)" }), "f"),
      el("span", { class: "key" }, el("i", { style: "background:var(--series-1)" }), "interpolant")),
    el("div", { class: "plot-title" }, "The coordinates λⱼ(x) and the sum of their absolute values"), bottom,
    el("div", { class: "legend" },
      el("span", { class: "key" }, el("i", { style: "background:var(--series-1)" }), "the coordinates λⱼ"),
      el("span", { class: "key" }, el("i", { style: "background:var(--ink); height:5px" }), "Σ |λⱼ| (equals 1 where no coordinate is negative)")),
    readout);
  update();
}
