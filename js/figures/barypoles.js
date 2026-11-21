/**
 * barypoles.js — Figure 12k (added remark): where the poles of the interpolant are.
 *
 * For weights w_j the barycentric interpolant is a rational function whose
 * poles are the zeros of the denominator D(x) = Σ w_j Π_{k≠j} (x − t_k), the
 * one-variable counterpart of the adjoint (math/interp.js). The figure shows
 * them in the complex plane for four choices of weights:
 *
 *   polynomial        D is constant: no poles at all;
 *   Berrut (±1)       D has degree n − 1 (even number of nodes); no pole is real;
 *   Floater–Hormann   fewer poles, none of them real;
 *   all equal         D = ℓ′: one pole in every gap between two nodes.
 *
 * The nodes can be dragged along the real axis.
 */

import { Stage, seriesColor } from "../ui/stage.js";
import { el, sub, choiceGroup } from "../ui/widgets.js";
import {
  polynomialWeights, berrutWeights, floaterHormannWeights, precisionDegree, interpolantPoles,
} from "../math/interp.js";

const VIEW = { xmin: -1.7, xmax: 1.7, ymin: -1.0, ymax: 1.0 };
const GAP = 0.16;                               // smallest distance between two nodes
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const KINDS = [
  { value: "poly", label: "Polynomial" },
  { value: "berrut", label: "Berrut (±1)" },
  { value: "fh", label: "Floater–Hormann, d = 2" },
  { value: "equal", label: "All equal" },
];
const NOTES = {
  poly: "The denominator is constant: the interpolant is a polynomial and has no poles.",
  berrut: "With alternating signs the pole terms add up to the canonical function of every second interval, which has no real zero. The poles of the interpolant come in conjugate pairs off the real axis, wherever the nodes are.",
  fh: "A blend of local quadratic interpolants: fewer poles than for Berrut’s weights, and again none on the real axis.",
  equal: "With weights of one sign the denominator is the derivative ℓ′ of the node polynomial. It vanishes once in every gap between two nodes (the points where the forces of equal charges at the nodes balance), so the interpolant has a pole in every gap.",
};

export function initBaryPoles(root) {
  const state = { t: [-1, -0.62, -0.2, 0.15, 0.6, 1], kind: "berrut" };
  const box = el("div");
  const readout = el("div", { class: "readout", "aria-live": "polite" });
  const weights = () => (state.kind === "poly" ? polynomialWeights(state.t)
    : state.kind === "berrut" ? berrutWeights(state.t)
    : state.kind === "fh" ? floaterHormannWeights(state.t, 2) : state.t.map(() => 1));

  const stage = new Stage(box, {
    view: VIEW, aspect: 0.6, maxHeight: 420,
    label: "The complex plane with the interpolation nodes on the real axis and the poles of the interpolant",
    draw(s) {
      const { t } = state, w = weights(), poles = interpolantPoles(t, w);
      s.line([VIEW.xmin, 0], [VIEW.xmax, 0], { stroke: s.color("axis"), width: 1 });
      s.line([t[0], 0], [t[t.length - 1], 0], { stroke: s.color("ink"), width: 3 });
      s.text([VIEW.xmax, 0], "real axis", { dx: -34, dy: 12, size: 11, color: s.color("ink-2") });
      // poles: crosses
      for (const z of poles) {
        if (z[0] < VIEW.xmin || z[0] > VIEW.xmax || Math.abs(z[1]) > VIEW.ymax) continue;
        const p = s.toScreen(z), c = s.ctx, r = 6;
        c.beginPath();
        c.moveTo(p[0] - r, p[1] - r); c.lineTo(p[0] + r, p[1] + r);
        c.moveTo(p[0] - r, p[1] + r); c.lineTo(p[0] + r, p[1] - r);
        c.lineWidth = 5; c.strokeStyle = s.color("surface"); c.setLineDash([]); c.stroke();
        c.lineWidth = 2.5; c.strokeStyle = seriesColor(1); c.stroke();
      }
      t.forEach((tj, j) => {
        s.knob([tj, 0], s.color("ink"), 6);
        s.text([tj, 0], sub("t", j), { dy: 18, size: 12, color: s.color("ink-2") });
        // sign of the weight
        s.text([tj, 0], w[j] > 0 ? "+" : "−", { dy: -18, size: 15, weight: 700, color: w[j] > 0 ? seriesColor(0) : seriesColor(1) });
      });
    },
  });
  stage.handles = () => state.t.map((_, j) => ({
    pos: () => [state.t[j], 0],
    drag: (q) => {
      const lo = j === 0 ? VIEW.xmin + 0.2 : state.t[j - 1] + GAP;
      const hi = j === state.t.length - 1 ? VIEW.xmax - 0.2 : state.t[j + 1] - GAP;
      state.t[j] = clamp(q[0], lo, hi);
      update();
    },
  }));

  function update() {
    const { t } = state, w = weights(), n = t.length - 1, d = precisionDegree(t, w), poles = interpolantPoles(t, w);
    const real = poles.filter((z) => Math.abs(z[1]) < 1e-7);
    const between = real.filter((z) => z[0] > t[0] && z[0] < t[n]).length;
    const hidden = poles.filter((z) => z[0] < VIEW.xmin || z[0] > VIEW.xmax || Math.abs(z[1]) > VIEW.ymax).length;
    readout.innerHTML =
      `<table><thead><tr><th>${n + 1} nodes</th><th>value</th></tr></thead><tbody>` +
      `<tr><td>polynomials reproduced: degree up to</td><td><b>${d}</b></td></tr>` +
      `<tr><td>number of poles = degree of the denominator D</td><td><b>${poles.length}</b></td></tr>` +
      `<tr><td>poles on the real axis</td><td><b>${real.length}</b></td></tr>` +
      `<tr><td>poles between the first and the last node</td><td><b>${between}</b></td></tr></tbody></table>` +
      `<p>${NOTES[state.kind]}${hidden ? ` (${hidden} pole${hidden > 1 ? "s lie" : " lies"} outside the picture.)` : ""}</p>`;
    stage.redraw();
  }

  const kind = choiceGroup("Weights", KINDS, state.kind, (v) => { state.kind = v; update(); });
  root.append(el("div", { class: "controls" }, kind.node), box,
    el("div", { class: "legend" },
      el("span", { class: "key" }, el("i", { style: "background:var(--ink); height:8px; width:8px; border-radius:50%" }), "nodes; above each one the sign of its weight"),
      el("span", { class: "key" }, el("b", { style: "color:var(--series-2); font-size:1rem; line-height:1" }, "×"), "poles of the interpolant (zeros of D)")),
    el("p", { class: "hint" }, "Drag the nodes along the real axis."),
    readout);
  update();
}
