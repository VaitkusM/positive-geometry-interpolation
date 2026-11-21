/**
 * bsplinepoles.js — Figure 12e (added remark): the one-variable case.
 *
 * Nodes t_0 < … < t_n on a line give two objects (math/splines.js):
 *
 *   the B-spline M(y) with the nodes as knots — by Curry and Schoenberg the
 *   density of the shadow of an n-simplex whose vertices lie above the knots;
 *
 *   the rational function 1 / Π (x − t_i) = Σ c_i / (x − t_i), the denominator
 *   of Lagrange's barycentric formula, with a simple pole at every node.
 *
 * They are related by   ∫ M(y) dy / (x − y)^{n+1} = 1 / Π (x − t_i)   for x
 * outside the interval of the nodes.
 *
 * Top (three nodes only): a triangle above the knots; the length of its
 * vertical chord at y, divided by its area, is M(y).
 * Middle: the B-spline. Bottom: the rational function and its partial fractions.
 * The nodes, the slice y and the point x can be dragged.
 */

import { Stage, seriesColor, withAlpha } from "../ui/stage.js";
import { el, fmt, choiceGroup } from "../ui/widgets.js";
import { bspline, lagrangeWeights } from "../math/splines.js";

const X_RANGE = [0, 10];
const GAP = 0.7;            // minimum distance between neighbouring nodes
const EDGE = 0.25;          // x stays this far from every node
const HEIGHTS = [0.22, 1.0, 0.45];   // heights of the triangle's vertices above the knots

const START = {
  2: [3, 7], 3: [2.5, 4.6, 7.5], 4: [2, 4, 5.6, 8], 5: [1.6, 3.2, 5, 6.4, 8.4],
};

export function initBsplinePoles(root) {
  const state = { knots: START[3].slice(), y: 5.4, x: 9 };
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const R = (x) => 1 / state.knots.reduce((p, t) => p * (x - t), 1);
  /** Three significant digits for the small numbers of this figure. */
  const sig = (v) => (Math.abs(v) >= 0.1 ? fmt(v) : String(Number(v.toPrecision(3))).replace("-", "−"));

  const triBox = el("div"), splineBox = el("div"), ratBox = el("div");
  const triTitle = el("div", { class: "plot-title" });
  const readout = el("div", { class: "readout", "aria-live": "polite" });
  const pad = { l: 34, r: 12, t: 16, b: 26 };
  const xticks = [0, 2, 4, 6, 8, 10].map((v) => [v, String(v)]);

  function fix() {
    const k = state.knots, n = k.length - 1;
    state.y = clamp(state.y, k[0], k[n]);
    // keep x away from the nodes: move it to the nearer side of a node it is too close to
    for (const t of k) {
      if (Math.abs(state.x - t) < EDGE) state.x = state.x >= t ? t + EDGE : t - EDGE;
    }
    state.x = clamp(state.x, X_RANGE[0] + 0.05, X_RANGE[1] - 0.05);
  }

  /** Dashed vertical guides at the nodes and a solid one at the slice y. */
  function guides(s, ymin, ymax) {
    state.knots.forEach((t, i) => s.line([t, ymin], [t, ymax], { stroke: seriesColor(i), width: 1, dash: [4, 4] }));
  }

  /** Vertical chord of the triangle at abscissa y: [lower, upper] heights. */
  function chord(y) {
    const [a, b, c] = state.knots, [ha, hb, hc] = HEIGHTS;
    const base = ha + ((hc - ha) * (y - a)) / (c - a);
    const top = y <= b ? ha + ((hb - ha) * (y - a)) / (b - a) : hb + ((hc - hb) * (y - b)) / (c - b);
    return [Math.min(base, top), Math.max(base, top)];
  }
  const triangleArea = () => {
    const [a, b, c] = state.knots, [ha, hb, hc] = HEIGHTS;
    return 0.5 * Math.abs((b - a) * (hc - ha) - (c - a) * (hb - ha));
  };

  const tri = new Stage(triBox, {
    view: { xmin: X_RANGE[0], xmax: X_RANGE[1], ymin: 0, ymax: 1.2 },
    equal: false, aspect: 0.26, maxHeight: 190, pad: { ...pad, l: 50 },
    label: "A triangle whose three vertices lie above the three knots, with a vertical chord",
    draw(s) {
      if (state.knots.length !== 3) return;
      s.axes({ xticks });
      const P = state.knots.map((t, i) => [t, HEIGHTS[i]]);
      s.clipped(() => {
        guides(s, 0, 1.2);
        s.poly(P, { fill: withAlpha(s.color("ink-2"), 0.16), stroke: s.color("ink"), width: 2 });
        const [lo, hi] = chord(state.y);
        s.line([state.y, lo], [state.y, hi], { stroke: seriesColor(5), width: 4 });
      });
      P.forEach((p, i) => s.dot(p, { r: 4, fill: seriesColor(i) }));
    },
  });

  const spline = new Stage(splineBox, {
    view: { xmin: X_RANGE[0], xmax: X_RANGE[1], ymin: 0, ymax: 1 },
    equal: false, aspect: 0.3, maxHeight: 210, pad: { ...pad, l: 50 },
    label: "The B-spline whose knots are the nodes",
    draw(s) {
      const k = state.knots, n = k.length - 1;
      const pts = [];
      for (let i = 0; i <= 400; i++) {
        const y = k[0] + ((k[n] - k[0]) * i) / 400;
        pts.push([y, bspline(k, Math.min(y, k[n] - 1e-9))]);
      }
      const top = 1.2 * Math.max(...pts.map((p) => p[1]));
      s.setView({ xmin: X_RANGE[0], xmax: X_RANGE[1], ymin: 0, ymax: top });
      s.axes({ xticks, yticks: [[0, "0"], [top / 1.2, fmt(top / 1.2, 2)]] });
      s.clipped(() => {
        guides(s, 0, top);
        s.poly([[k[0], 0], ...pts, [k[n], 0]], { fill: withAlpha(seriesColor(5), 0.22) });
        s.poly(pts, { stroke: s.color("ink"), width: 2, open: true });
        const m = bspline(k, Math.min(state.y, k[n] - 1e-9));
        s.line([state.y, 0], [state.y, m], { stroke: seriesColor(5), width: 2 });
        s.dot([state.y, m], { r: 4, fill: seriesColor(5) });
      });
      k.forEach((t, i) => s.knob([t, 0], seriesColor(i)));
      s.knob([state.y, 0], seriesColor(5), 5);
      s.text([state.y, 0], "y", { dy: -14, dx: 11 });
    },
  });

  const rational = new Stage(ratBox, {
    view: { xmin: X_RANGE[0], xmax: X_RANGE[1], ymin: -1, ymax: 1 },
    equal: false, aspect: 0.36, maxHeight: 250, pad: { ...pad, l: 50 },
    label: "The rational function with a pole at every node, and its partial fractions",
    draw(s) {
      const k = state.knots, n = k.length - 1, c = lagrangeWeights(k);
      // vertical scale from the size of the function half way between neighbouring nodes
      let scale = 0;
      for (let i = 0; i < n; i++) scale = Math.max(scale, Math.abs(R((k[i] + k[i + 1]) / 2)));
      scale = Math.max(scale, Math.abs(R(k[0] - 1)), Math.abs(R(k[n] + 1)));
      const top = 3.2 * scale;
      s.setView({ xmin: X_RANGE[0], xmax: X_RANGE[1], ymin: -top, ymax: top });
      s.axes({ xticks, yticks: [[-top / 1.6, sig(-top / 1.6)], [0, "0"], [top / 1.6, sig(top / 1.6)]] });
      // a curve is drawn branch by branch, so that no line joins the two sides of a pole
      const branches = (f) => {
        const cuts = [X_RANGE[0], ...k, X_RANGE[1]], out = [];
        for (let b = 0; b + 1 < cuts.length; b++) {
          const pts = [];
          for (let i = 1; i < 200; i++) {
            const x = cuts[b] + ((cuts[b + 1] - cuts[b]) * i) / 200;
            pts.push([x, clamp(f(x), -3 * top, 3 * top)]);
          }
          out.push(pts);
        }
        return out;
      };
      s.clipped(() => {
        guides(s, -top, top);
        s.line([X_RANGE[0], 0], [X_RANGE[1], 0], { stroke: s.color("axis"), width: 1 });
        k.forEach((t, i) => branches((x) => c[i] / (x - t)).forEach((pts) =>
          s.poly(pts, { stroke: seriesColor(i), width: 1.5, open: true })));
        branches(R).forEach((pts) => s.poly(pts, { stroke: s.color("ink"), width: 2.5, open: true }));
        s.line([state.x, -top], [state.x, top], { stroke: s.color("ink-2"), width: 1 });
        s.dot([state.x, clamp(R(state.x), -top, top)], { r: 4, fill: s.color("ink") });
      });
      s.knob([state.x, -top], s.color("ink"));
      s.text([state.x, -top], "x", { dy: -14, dx: 11 });
    },
  });

  function update() {
    fix();
    const k = state.knots, n = k.length - 1, c = lagrangeWeights(k);
    const three = k.length === 3;
    triBox.style.display = three ? "" : "none";
    triTitle.textContent = three
      ? "A triangle above the three knots: its vertical chord at y"
      : `With ${k.length} nodes the body above the knots is a simplex of dimension ${n}` +
        (n === 1 ? " (a segment); its shadow is the uniform density." : ", which is not drawn here; its shadow is the B-spline below.");
    const m = bspline(k, Math.min(state.y, k[n] - 1e-9));
    let html = `<p>B-spline at the slice: M(y) = <b>${fmt(m)}</b>`;
    if (three) {
      const [lo, hi] = chord(state.y);
      html += ` &nbsp;=&nbsp; chord ÷ area of the triangle = ${fmt(hi - lo)} ÷ ${fmt(triangleArea())} = <b>${fmt((hi - lo) / triangleArea())}</b>`;
    }
    html += `</p><p>Weights of the barycentric formula: ` +
      c.map((v, i) => `c<sub>${i}</sub> = <b>${sig(v)}</b>`).join(", &nbsp;") +
      (n > 1 ? ` &nbsp;(alternating signs)` : ``) + `</p>`;
    const outside = state.x < k[0] || state.x > k[n];
    html += `<p>At x = ${fmt(state.x, 2)}: &nbsp; 1 / Π (x − t<sub>i</sub>) = Σ c<sub>i</sub> / (x − t<sub>i</sub>) = <b>${sig(R(state.x))}</b>`;
    if (outside) {
      const N = 4000, dy = (k[n] - k[0]) / N;
      let sum = 0;
      for (let i = 0; i < N; i++) {
        const y = k[0] + (i + 0.5) * dy;
        sum += (bspline(k, y) * dy) / Math.pow(state.x - y, n + 1);
      }
      html += `<br>transform of the B-spline: &nbsp; ∫ M(y) dy / (x − y)<sup>${n + 1}</sup> ≈ <b>${sig(sum)}</b></p>`;
    } else {
      html += `<br>x lies between the nodes, where the integral ∫ M(y) dy / (x − y)<sup>${n + 1}</sup> does not converge; ` +
        `move x outside the nodes to compare.</p>`;
    }
    readout.innerHTML = html;
    tri.redraw(); spline.redraw(); rational.redraw();
  }

  // nodes and the slice are dragged along the axis of the spline plot (the slice also in the triangle)
  const knotHandles = () => state.knots.map((_, i) => ({
    pos: () => [state.knots[i], 0],
    drag: (q) => {
      const k = state.knots;
      const lo = i === 0 ? X_RANGE[0] + 0.4 : k[i - 1] + GAP, hi = i === k.length - 1 ? X_RANGE[1] - 0.4 : k[i + 1] - GAP;
      k[i] = clamp(q[0], lo, hi);
      update();
    },
  }));
  const sliceHandle = (height) => ({ pos: () => [state.y, height()], drag: (q) => { state.y = q[0]; update(); } });
  spline.handles = () => [...knotHandles(), sliceHandle(() => 0)];
  tri.handles = () => (state.knots.length === 3 ? [sliceHandle(() => chord(state.y)[0])] : []);
  rational.handles = () => [{
    pos: () => [state.x, rational.view.ymin],
    drag: (q) => {
      // do not let x jump over a node while being dragged into its exclusion zone
      state.x = q[0];
      update();
    },
  }];

  const count = choiceGroup("Number of nodes",
    [2, 3, 4, 5].map((v) => ({ value: v, label: String(v) })), 3,
    (v) => { state.knots = START[v].slice(); state.y = (state.knots[0] + state.knots[v - 1]) / 2 + 0.3; state.x = 9; update(); });

  root.append(el("div", { class: "controls" }, count.node),
    triTitle, triBox,
    el("div", { class: "plot-title" }, "The B-spline with the nodes as knots"), splineBox,
    el("div", { class: "plot-title" }, "The function 1 / Π (x − tᵢ) and its partial fractions"),
    el("div", { class: "legend" },
      el("span", { class: "key" }, el("i", { style: "background:var(--ink)" }), "1 / Π (x − tᵢ)"),
      el("span", { class: "key" }, el("i", { style: "background:var(--series-1)" }), "the terms cᵢ / (x − tᵢ), one colour per node")),
    ratBox,
    el("p", { class: "hint" }, "Drag the nodes and the slice y in the middle plot, and the point x in the lower plot."),
    readout);
  update();
}
