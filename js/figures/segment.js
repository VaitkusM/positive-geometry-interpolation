/**
 * segment.js — Figure 1: linear interpolation on a segment as a ratio of poles.
 *
 * Top plot:    the data (a, f(a)), (b, f(b)) and the linear interpolant.
 * Bottom plot: the two "pole" weights 1/(x−a) and 1/(b−x) and their sum, which
 *              is the canonical function of the segment [a, b]  (eq. 2.2).
 * The user drags the two data points and the evaluation point x.
 */

import { Stage, seriesColor } from "../ui/stage.js";
import { el, fmt } from "../ui/widgets.js";
import { segmentCanonical } from "../math/canonical.js";
import { segmentCoords } from "../math/barycentric.js";

const X_RANGE = [0, 10];   // visible range of the abscissa
const F_RANGE = [0, 5];    // visible range of the data values
const W_MAX = 3;           // top of the weight plot
const GAP = 0.6;           // minimum b − a
const EDGE = 0.12;         // x stays this far from a and b

export function initSegment(root) {
  const state = { a: 2.5, b: 8, fa: 1.5, fb: 3.8, x: 4.4 };
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const fixX = () => { state.x = clamp(state.x, state.a + EDGE, state.b - EDGE); };

  const topBox = el("div"), botBox = el("div");
  const readout = el("p", { class: "readout", "aria-live": "polite" });
  root.append(
    el("div", { class: "plot-title" }, "Data and linear interpolant"), topBox,
    el("div", { class: "plot-title" }, "Weights with poles at the end points"),
    el("div", { class: "legend" },
      el("span", { class: "key" }, el("i", { style: "background:var(--series-1)" }), "1/(x − a)"),
      el("span", { class: "key" }, el("i", { style: "background:var(--series-2)" }), "1/(b − x)"),
      el("span", { class: "key" }, el("i", { style: "background:var(--ink)" }), "sum = canonical function of [a, b] (upper curve)")),
    botBox, readout);

  const pad = { l: 34, r: 12, t: 24, b: 26 };
  const xticks = [0, 2, 4, 6, 8, 10].map((v) => [v, String(v)]);

  /** Dashed vertical guides at a, b and x, shared by both plots. */
  function guides(s, ymin, ymax) {
    s.line([state.a, ymin], [state.a, ymax], { stroke: seriesColor(0), width: 1, dash: [4, 4] });
    s.line([state.b, ymin], [state.b, ymax], { stroke: seriesColor(1), width: 1, dash: [4, 4] });
    s.line([state.x, ymin], [state.x, ymax], { stroke: s.color("ink-2"), width: 1 });
  }

  const top = new Stage(topBox, {
    view: { xmin: X_RANGE[0], xmax: X_RANGE[1], ymin: F_RANGE[0], ymax: F_RANGE[1] },
    equal: false, aspect: 0.36, maxHeight: 250, pad,
    label: "Linear interpolation between two draggable data points",
    draw(s) {
      const { a, b, fa, fb, x } = state;
      const [la, lb] = segmentCoords(a, b, x);
      const fx = la * fa + lb * fb;
      s.axes({ xticks, yticks: [0, 1, 2, 3, 4, 5].map((v) => [v, String(v)]), ylabel: "f" });
      s.clipped(() => {
        guides(s, F_RANGE[0], F_RANGE[1]);
        s.line([a, fa], [b, fb], { stroke: s.color("ink"), width: 2 });
      });
      s.knob([a, fa], seriesColor(0));
      s.knob([b, fb], seriesColor(1));
      s.knob([x, fx], s.color("ink"), 5);
      s.knob([x, 0], s.color("ink"));
      s.text([a, fa], "f(a)", { dy: -18 });
      s.text([b, fb], "f(b)", { dy: -18 });
      s.text([x, fx], "f(x)", { dy: -16 });
      s.text([x, 0], "x", { dy: -16, dx: 12 });
    },
  });

  const bottom = new Stage(botBox, {
    view: { xmin: X_RANGE[0], xmax: X_RANGE[1], ymin: 0, ymax: W_MAX },
    equal: false, aspect: 0.36, maxHeight: 250, pad,
    label: "The two pole weights and their sum between a and b",
    draw(s) {
      const { a, b, x } = state;
      s.axes({ xticks, yticks: [0, 1, 2, 3].map((v) => [v, String(v)]) });
      const curve = (f) => {
        const pts = [];
        for (let k = 1; k < 400; k++) {
          const t = a + ((b - a) * k) / 400;
          pts.push([t, f(t)]);
        }
        return pts;
      };
      const wa = (t) => 1 / (t - a), wb = (t) => 1 / (b - t);
      s.clipped(() => {
        guides(s, 0, W_MAX);
        s.poly(curve(wa), { stroke: seriesColor(0), width: 2, open: true });
        s.poly(curve(wb), { stroke: seriesColor(1), width: 2, open: true });
        s.poly(curve((t) => segmentCanonical(a, b, t)), { stroke: s.color("ink"), width: 2, open: true });
        s.dot([x, wa(x)], { r: 4, fill: seriesColor(0) });
        s.dot([x, wb(x)], { r: 4, fill: seriesColor(1) });
        s.dot([x, segmentCanonical(a, b, x)], { r: 4, fill: s.color("ink") });
      });
      s.text([a, 0], "a", { dy: -10, dx: -10 });
      s.text([b, 0], "b", { dy: -10, dx: 10 });
      s.knob([x, 0], s.color("ink"));
    },
  });

  function update() {
    const { a, b, fa, fb, x } = state;
    const wa = 1 / (x - a), wb = 1 / (b - x);
    const [la, lb] = segmentCoords(a, b, x);
    readout.innerHTML =
      `1/(x−a) = <b>${fmt(wa)}</b>, &nbsp; 1/(b−x) = <b>${fmt(wb)}</b>, &nbsp; sum = <b>${fmt(wa + wb)}</b>` +
      `<br>λ<sub>a</sub> = ${fmt(wa)} / ${fmt(wa + wb)} = <b>${fmt(la)}</b>, &nbsp; ` +
      `λ<sub>b</sub> = <b>${fmt(lb)}</b>, &nbsp; ` +
      `f(x) = λ<sub>a</sub> f(a) + λ<sub>b</sub> f(b) = <b>${fmt(la * fa + lb * fb)}</b>`;
    top.redraw();
    bottom.redraw();
  }

  const dragX = { pos: () => [state.x, 0], drag: (q) => { state.x = q[0]; fixX(); update(); } };
  top.handles = () => [
    { pos: () => [state.a, state.fa],
      drag: (q) => {
        state.a = clamp(q[0], X_RANGE[0] + 0.3, state.b - GAP);
        state.fa = clamp(q[1], F_RANGE[0] + 0.2, F_RANGE[1] - 0.6);
        fixX(); update();
      } },
    { pos: () => [state.b, state.fb],
      drag: (q) => {
        state.b = clamp(q[0], state.a + GAP, X_RANGE[1] - 0.3);
        state.fb = clamp(q[1], F_RANGE[0] + 0.2, F_RANGE[1] - 0.6);
        fixX(); update();
      } },
    dragX,
  ];
  bottom.handles = () => [dragX];
  update();
}
