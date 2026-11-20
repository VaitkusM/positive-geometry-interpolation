/**
 * smooth.js — Figure 14 (later developments / observation): from polygons to
 * a smooth convex set.
 *
 * Wachspress coordinates of regular polygons inscribed in the unit circle
 * converge to the kernel of Warren, Schaefer, Hirani and Desbrun's
 * coordinates for smooth convex sets,
 *     b(θ; x) = κ / (n·(v − x))² / ∫ … = (1 − |x|²)^{3/2} / ( 2π (1 − v·x)² ),
 * whose normaliser 2π/(1 − |x|²)^{3/2} is the "canonical function" of the
 * disc of eq. (5.14) and Figure 9.
 * Left: circle, inscribed n-gon, point x. Right: weight per unit angle.
 */

import { Stage, seriesColor } from "../ui/stage.js";
import { el, fmt, slider } from "../ui/widgets.js";
import { regularPolygon, clampIntoConvex } from "../math/polygon.js";
import { vertexWedges, discKernel, discDualArea2 } from "../math/canonical.js";

const N_VALUES = [3, 4, 6, 8, 12, 24, 48, 96];
const TWO_PI = 2 * Math.PI;

export function initSmooth(root) {
  const state = { idx: 3, x: [0.35, 0.15] };
  const left = el("div", { class: "fig-main" }), right = el("div", { class: "fig-side wide" });
  const readout = el("p", { class: "readout", "aria-live": "polite" });
  const polygon = () => regularPolygon(N_VALUES[state.idx], 1, 0);

  /** λ_i of the inscribed polygon and the total weight (its canonical function). */
  function coords() {
    const w = vertexWedges(polygon(), state.x);
    const C = w.reduce((a, b) => a + b, 0);
    return { lam: w.map((v) => v / C), C };
  }

  const disc = new Stage(left, {
    view: { xmin: -1.25, xmax: 1.25, ymin: -1.25, ymax: 1.25 }, aspect: 1, maxHeight: 380,
    label: "Unit circle with an inscribed regular polygon and the point x",
    draw(s) {
      const pts = polygon(), { lam } = coords();
      const circle = [];
      for (let k = 0; k < 180; k++) circle.push([Math.cos((TWO_PI * k) / 180), Math.sin((TWO_PI * k) / 180)]);
      s.poly(circle, { stroke: seriesColor(1), width: 2 });
      s.poly(pts, { fill: s.color("fill-soft"), stroke: s.color("ink"), width: 1.5 });
      // vertex dots with area proportional to their coordinate
      const n = pts.length;
      pts.forEach((p, i) => s.dot(p, { r: Math.max(2, 9 * Math.sqrt(lam[i] * Math.min(n, 12) / 3)), fill: seriesColor(0) }));
      s.knob(state.x, s.color("ink"), 6);
      s.text(state.x, "x", { dx: 12, dy: -12, size: 14 });
    },
  });
  disc.handles = () => [{
    pos: () => state.x,
    drag: (q) => {
      // stay inside the polygon and away from the circle
      const r = Math.hypot(q[0], q[1]), lim = 0.9;
      const p = r > lim ? [(q[0] * lim) / r, (q[1] * lim) / r] : q;
      state.x = clampIntoConvex(polygon(), p, 0.04);
      update();
    },
  }];

  const plot = new Stage(right, {
    view: { xmin: 0, xmax: TWO_PI, ymin: 0, ymax: 1 }, equal: false, aspect: 0.7, maxHeight: 380,
    pad: { l: 40, r: 12, t: 24, b: 40 },
    label: "Weight per unit angle: polygon vertices versus the smooth kernel",
    draw(s) {
      const n = N_VALUES[state.idx], { lam } = coords();
      const curve = [];
      for (let k = 0; k <= 360; k++) {
        const t = (TWO_PI * k) / 360;
        curve.push([t, discKernel(t, state.x)]);
      }
      const dots = lam.map((l, i) => [(TWO_PI * i) / n, (l * n) / TWO_PI]);
      const top = 1.15 * Math.max(...curve.map((p) => p[1]), ...dots.map((p) => p[1]));
      s.setView({ xmin: 0, xmax: TWO_PI, ymin: 0, ymax: top });
      const step = top > 2 ? 1 : top > 0.8 ? 0.25 : 0.1;
      const yticks = [];
      for (let v = 0; v <= top; v += step) yticks.push([v, fmt(v, step < 0.25 ? 1 : 2)]);
      s.axes({
        xticks: [0, 0.5, 1, 1.5, 2].map((k) => [k * Math.PI, k === 0 ? "0" : k === 1 ? "π" : k === 2 ? "2π" : `${k}π`]),
        yticks, xlabel: "angle θ of the boundary point", ylabel: "weight per unit angle",
      });
      s.clipped(() => {
        s.poly(curve, { stroke: seriesColor(1), width: 2, open: true });
        dots.forEach((p) => { s.line([p[0], 0], p, { stroke: seriesColor(0), width: 1 }); });
        dots.forEach((p) => s.dot(p, { r: n > 30 ? 2.5 : 4, fill: seriesColor(0) }));
      });
    },
  });

  function update() {
    // changing n may leave x outside the new polygon
    state.x = clampIntoConvex(polygon(), state.x, 0.04);
    const { C } = coords();
    const r = Math.hypot(state.x[0], state.x[1]);
    readout.innerHTML = `Total weight (canonical function) of the ${N_VALUES[state.idx]}-gon: <b>${fmt(C)}</b>; ` +
      `&nbsp; disc: 2π/(1 − |x|²)<sup>3/2</sup> = <b>${fmt(discDualArea2(r))}</b>.`;
    disc.redraw();
    plot.redraw();
  }

  const nSlider = slider("Inscribed polygon", { min: 0, max: N_VALUES.length - 1, step: 1, value: state.idx },
    (i) => `regular ${N_VALUES[i]}-gon`, (i) => { state.idx = i; update(); });

  root.append(el("div", { class: "controls" }, nSlider.node),
    el("div", { class: "legend" },
      el("span", { class: "key" }, el("i", { style: "background:var(--series-1)" }),
        "polygon: n·λᵢ/2π at the vertices"),
      el("span", { class: "key" }, el("i", { style: "background:var(--series-2)" }),
        "smooth kernel b(θ; x) of the circle")),
    el("div", { class: "fig-split" }, left, right),
    el("p", { class: "hint" }, "Drag the point x."), readout);
  update();
}
