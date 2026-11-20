/**
 * meanvalue.js — Figure 13 (later developments / observation): Wachspress
 * and mean value coordinates in the same dual picture.
 *
 * With P*ₓ the polar dual of the polygon about x:
 *     Σ (Wachspress weights)  = 2 × AREA of P*ₓ          (the canonical function)
 *     Σ (mean value weights)  = PERIMETER of P*ₓ
 * Left: the polygon. Right: its dual, drawn with a filled interior (area) and
 * a heavy outline (perimeter). Below: both sets of coordinates side by side.
 */

import { Stage, seriesColor, withAlpha } from "../ui/stage.js";
import { el, fmt, sub, choiceGroup } from "../ui/widgets.js";
import { centroid, signedArea, perimeter } from "../math/polygon.js";
import { vertexWedges } from "../math/canonical.js";
import { polarDual, meanValueWeights, combine } from "../math/barycentric.js";
import { defaultPolygon, attachPolygonHandles } from "./common.js";

const VIEW = { xmin: -1.75, xmax: 1.75, ymin: -1.5, ymax: 1.5 };

export function initMeanValue(root) {
  const state = { pts: defaultPolygon(5), x: [0.35, -0.2] };
  const left = el("div"), right = el("div");
  const bars = el("div", { class: "bars" });
  const readout = el("div", { class: "readout", "aria-live": "polite" });

  const primal = new Stage(left, {
    view: VIEW, aspect: 0.86, maxHeight: 420,
    label: "Convex polygon with draggable vertices and evaluation point x",
    draw(s) {
      const { pts, x } = state, c = centroid(pts);
      s.poly(pts, { fill: s.color("fill-soft"), stroke: s.color("ink"), width: 2 });
      pts.forEach((p, k) => {
        s.knob(p, s.color("ink"), 6);
        const d = [p[0] - c[0], p[1] - c[1]], l = Math.hypot(...d);
        s.text(p, sub("p", k), { dx: (18 * d[0]) / l, dy: (-18 * d[1]) / l, size: 14 });
      });
      s.knob(x, s.color("ink"), 6);
      s.text(x, "x", { dx: 12, dy: -12, size: 14 });
    },
  });

  const dual = new Stage(right, {
    view: { xmin: -1, xmax: 1, ymin: -1, ymax: 1 }, aspect: 0.86, maxHeight: 420,
    label: "Polar dual polygon: its area gives the Wachspress normaliser, its perimeter the mean value normaliser",
    draw(s) {
      const d = polarDual(state.pts, state.x);
      const R = 1.25 * Math.max(...d.map((p) => Math.hypot(p[0], p[1])));
      s.setView({ xmin: -R, xmax: R, ymin: -R, ymax: R });
      s.poly(d, { fill: withAlpha(seriesColor(0), 0.3) });
      s.poly(d, { stroke: seriesColor(1), width: 4 });
      s.knob([0, 0], s.color("ink"), 5);
      s.text([0, 0], "x", { dx: 11, dy: -11, size: 14 });
      const c = centroid(d);
      s.text(c, "area", { size: 13, dy: 16 });
    },
  });

  function update() {
    const { pts, x } = state, n = pts.length;
    const wW = vertexWedges(pts, x), wM = meanValueWeights(pts, x);
    const sW = wW.reduce((a, b) => a + b, 0), sM = wM.reduce((a, b) => a + b, 0);
    const lW = wW.map((v) => v / sW), lM = wM.map((v) => v / sM);
    const d = polarDual(pts, x);
    // grouped bars: two thin bars per vertex
    if (bars.children.length !== n) {
      bars.replaceChildren(...pts.map((_, i) => el("div", { class: "bar-row double", role: "row" },
        el("span", { class: "bar-label", html: `λ<sub>${i}</sub>` }),
        el("div", { class: "bar-track" },
          el("div", { class: "bar-fill", style: "background:var(--series-1)" }),
          el("div", { class: "bar-fill", style: "background:var(--series-2)" })),
        el("span", { class: "bar-value" }))));
    }
    [...bars.children].forEach((row, i) => {
      const fills = row.querySelectorAll(".bar-fill");
      fills[0].style.width = (100 * lW[i]).toFixed(2) + "%";
      fills[1].style.width = (100 * lM[i]).toFixed(2) + "%";
      row.querySelector(".bar-value").textContent = `${fmt(lW[i])} / ${fmt(lM[i])}`;
    });
    const bW = combine(lW, pts), bM = combine(lM, pts);
    readout.innerHTML =
      `<p>Wachspress: &nbsp; Σ w<sub>k</sub> = <b>${fmt(sW)}</b> &nbsp;=&nbsp; 2 × area of the dual = <b>${fmt(2 * signedArea(d))}</b>` +
      `<br>Mean value: &nbsp; Σ w<sub>k</sub> = <b>${fmt(sM)}</b> &nbsp;=&nbsp; perimeter of the dual = <b>${fmt(perimeter(d))}</b></p>` +
      `<p>Both reproduce x: &nbsp; Σ λ<sub>k</sub> p<sub>k</sub> = (${fmt(bW[0])}, ${fmt(bW[1])}) and ` +
      `(${fmt(bM[0])}, ${fmt(bM[1])}) &nbsp;vs.&nbsp; x = (${fmt(x[0])}, ${fmt(x[1])})</p>`;
    primal.redraw();
    dual.redraw();
  }

  attachPolygonHandles(primal, state, { bounds: VIEW, onChange: update });
  const sides = choiceGroup("Number of vertices",
    [3, 4, 5, 6, 7].map((v) => ({ value: v, label: String(v) })), 5,
    (v) => { state.pts = defaultPolygon(v); state.x = [0.35, -0.2]; update(); });

  root.append(el("div", { class: "controls" }, sides.node),
    el("div", { class: "fig-pair" },
      el("div", {}, el("div", { class: "plot-title" }, "Polygon P"), left),
      el("div", {}, el("div", { class: "plot-title" }, "Polar dual P*ₓ: area and perimeter"), right)),
    el("div", { class: "legend" },
      el("span", { class: "key" }, el("i", { style: "background:var(--series-1)" }),
        "Wachspress coordinates (normalised by twice the dual area)"),
      el("span", { class: "key" }, el("i", { style: "background:var(--series-2)" }),
        "mean value coordinates (normalised by the dual perimeter)")),
    bars, readout);
  update();
}
