/**
 * hodgecubic.js — Figure 11b (later development): a nodal cubic and a
 * smooth cubic.
 *
 * The cubic curves  y² = x²(1 − x) − ε  (math/hodge.js). For ε = 0 the curve
 * has a node and bounds a "teardrop" with one corner; the pair (plane, curve)
 * has genus 0 and combinatorial rank 1, and
 *     2 dx∧dy / (x²(1 − x) − y²)
 * is the canonical form of the teardrop (Brown & Dupont, Proposition 5.2). Its
 * residue along the boundary is the canonical form of a segment whose two ends
 * are the two branches at the node. For ε > 0 the curve is smooth of genus 1:
 * the corner is gone, the residue of the same form is finite all round the
 * oval, and the form is no longer a canonical form but an ambiguity that could
 * be added to one.
 *
 * Left:  the curve and the bounded region.
 * Right: the residue of the form along the boundary of that region, per unit
 *        length, against the position on the boundary.
 */

import { Stage, seriesColor } from "../ui/stage.js";
import { el, fmt, slider } from "../ui/widgets.js";
import { cubicG, cubicRoots, cubicLoop, cubicPeriod, planeCurveInvariants } from "../math/hodge.js";

const VIEW = { xmin: -0.55, xmax: 1.25, ymin: -0.75, ymax: 0.75 };
const TOP = 14;                                   // the density plot is cut off here

export function initHodgeCubic(root) {
  const state = { eps: 0 };
  const left = el("div"), right = el("div");
  const readout = el("div", { class: "readout", "aria-live": "polite" });

  const curve = new Stage(left, {
    view: VIEW, aspect: 0.83, maxHeight: 400,
    label: "A cubic curve with a bounded region: a teardrop with a corner, or a smooth oval",
    draw(s) {
      const { eps } = state, [r1] = cubicRoots(eps), loop = cubicLoop(eps, 360);
      s.poly(loop.pts, { fill: s.color("fill-soft"), stroke: s.color("ink"), width: 2 });
      // the unbounded branch over x ≤ r1
      const upper = [], lower = [];
      for (let k = 0; k <= 120; k++) {
        const u = k / 120, x = r1 - (r1 - VIEW.xmin + 0.1) * u * u, y = Math.sqrt(Math.max(0, cubicG(eps, x)));
        upper.push([x, y]); lower.push([x, -y]);
      }
      s.clipped(() => {
        s.poly(upper, { stroke: s.color("ink"), width: 2, open: true });
        s.poly(lower, { stroke: s.color("ink"), width: 2, open: true });
      });
      if (eps === 0) {
        s.knob([0, 0], seriesColor(1), 6);
        s.text([0, 0], "corner (node)", { dx: -8, dy: -20, size: 12, align: "right" });
      }
      // start of the boundary parameter used on the right
      s.dot(loop.pts[0], { r: 3.5, fill: s.color("ink") });
    },
  });

  const plot = new Stage(right, {
    view: { xmin: 0, xmax: 1, ymin: 0, ymax: TOP },
    equal: false, aspect: 0.83, maxHeight: 400, pad: { l: 34, r: 12, t: 14, b: 40 },
    label: "The residue of the form along the boundary of the region",
    draw(s) {
      const loop = cubicLoop(state.eps, 1440);
      s.axes({ xticks: [0, 0.25, 0.5, 0.75, 1].map((u) => [u, String(u)]), yticks: [0, 4, 8, 12].map((u) => [u, String(u)]),
        xlabel: "position on the boundary (fraction of its length, from the left end)" });
      s.clipped(() => {
        s.poly(loop.pts.map((_, k) => [loop.s[k] / loop.length, Math.min(loop.density[k], 3 * TOP)]),
          { stroke: seriesColor(0), width: 2, open: true });
      });
    },
  });

  function update() {
    const { eps } = state, nodal = eps === 0;
    const inv = nodal ? planeCurveInvariants([0], [2]) : planeCurveInvariants([1], []);
    const loop = cubicLoop(eps, 1440), peak = Math.max(...loop.density.filter(Number.isFinite));
    readout.innerHTML =
      `<table><thead><tr><th>y² = x²(1 − x) − ε, &nbsp; ε = ${fmt(eps, 3)}</th><th>value</th></tr></thead><tbody>` +
      `<tr><td>genus of the pair (number of ambiguities)</td><td><b>${inv.genus}</b></td></tr>` +
      `<tr><td>combinatorial rank (number of independent canonical forms)</td><td><b>${inv.rank}</b></td></tr>` +
      `<tr><td>largest value of the residue on the boundary</td><td><b>${nodal ? "∞ (at the corner)" : fmt(peak, 2)}</b></td></tr>` +
      `<tr><td>integral of the residue once around the boundary</td><td><b>${nodal ? "∞" : fmt(cubicPeriod(eps), 3)}</b></td></tr></tbody></table>` +
      (nodal
        ? `<p>The curve has a node. The form 2 dx∧dy / (x²(1 − x) − y²) is the canonical form of the teardrop, and it is ` +
          `the only form with logarithmic poles along the curve. Its residue along the boundary has a simple pole at each end: ` +
          `it is the canonical form of a segment whose two ends meet at the corner.</p>`
        : `<p>The curve is smooth and has genus 1. The same formula still gives the only form with a simple pole along the curve, ` +
          `but its residue is finite everywhere on the oval: there is no corner whose residue could single it out. ` +
          `The oval region has no canonical form, and this form is the ambiguity.</p>`);
    curve.redraw();
    plot.redraw();
  }

  const eps = slider("ε", { min: 0, max: 0.12, step: 0.002, value: 0 }, (v) => v.toFixed(3),
    (v) => { state.eps = v; update(); });

  root.append(el("div", { class: "controls" }, eps.node),
    el("div", { class: "fig-pair" },
      el("div", {}, el("div", { class: "plot-title" }, "The curve and its bounded region"), left),
      el("div", {}, el("div", { class: "plot-title" }, "Residue of the form along the boundary"), right)),
    el("p", { class: "hint" }, "Move the slider away from zero: the node opens up and the two poles of the residue merge into a finite peak."),
    readout);
  update();
}
