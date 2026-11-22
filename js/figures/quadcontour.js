/**
 * quadcontour.js — Figure 12m (added remark): the two triangulations of a
 * quadrilateral as a contour integral.
 *
 * For a convex quadrilateral and a point x with positive coefficients c
 * (here: its Wachspress coordinates),
 *     C_P(x) = (1/2π) ∫ ds / Π_j (c_j − i s k_j)            (math/contour.js),
 * where k is the linear relation among the four vertices. The integrand has
 * four poles on the imaginary axis, two above and two below the real axis. At
 * each pole one coefficient vanishes, and the pole contributes the canonical
 * function of the triangle on the other three vertices. Closing the contour
 * above or below gives the two triangulations of the quadrilateral
 * (Arkani-Hamed, Bai & Lam: triangulation independence from Cauchy's theorem).
 *
 * Left:  the quadrilateral, the point x and the triangulation that belongs to
 *        the chosen way of closing the contour.
 * Right: the s-plane with the four poles and the closed contour.
 */

import { Stage, seriesColor, withAlpha } from "../ui/stage.js";
import { el, fmt, sub, choiceGroup } from "../ui/widgets.js";
import { centroid } from "../math/polygon.js";
import { polygonCanonical } from "../math/canonical.js";
import { wachspress } from "../math/barycentric.js";
import { quadPoles, quadLineIntegral } from "../math/contour.js";
import { defaultPolygon, attachPolygonHandles } from "./common.js";

const VIEW = { xmin: -1.75, xmax: 1.75, ymin: -1.5, ymax: 1.5 };

export function initQuadContour(root) {
  const state = { pts: defaultPolygon(4), x: [0.25, -0.1], side: "upper" };
  const left = el("div"), right = el("div");
  const readout = el("div", { class: "readout", "aria-live": "polite" });
  const poles = () => quadPoles(state.pts, wachspress(state.pts, state.x));
  const chosen = () => poles().filter((p) => p.upper === (state.side === "upper"));

  const primal = new Stage(left, {
    view: VIEW, aspect: 0.86, maxHeight: 420,
    label: "A quadrilateral with a point x and one of its two triangulations",
    draw(s) {
      const { pts, x } = state, c = centroid(pts), pair = chosen();
      // the two triangles; each wears the colour of the vertex that it leaves out
      pair.forEach((p) => s.poly(p.triangle.map((i) => pts[i]), { fill: withAlpha(seriesColor(p.vertex), 0.28) }));
      const kept = [0, 1, 2, 3].filter((i) => !pair.some((p) => p.vertex === i));
      s.line(pts[kept[0]], pts[kept[1]], { stroke: s.color("ink-2"), width: 1.5, dash: [5, 4] });
      s.poly(pts, { stroke: s.color("ink"), width: 2 });
      pts.forEach((p, k) => {
        s.knob(p, seriesColor(k), 6);
        const d = [p[0] - c[0], p[1] - c[1]], l = Math.hypot(...d);
        s.text(p, sub("p", k), { dx: (18 * d[0]) / l, dy: (-18 * d[1]) / l, size: 14 });
      });
      s.knob(x, s.color("ink"), 6);
      s.text(x, "x", { dx: 12, dy: -12, size: 14 });
    },
  });

  const plane = new Stage(right, {
    view: { xmin: -1, xmax: 1, ymin: -1, ymax: 1 }, aspect: 0.86, maxHeight: 420,
    label: "The complex s-plane with four poles on the imaginary axis and the contour closed by a half circle",
    draw(s) {
      const all = poles(), R = 1.75 * Math.max(...all.map((p) => Math.abs(p.s))), up = state.side === "upper";
      s.setView({ xmin: -R, xmax: R, ymin: -R, ymax: R });
      const r = 0.86 * R, arc = [];
      for (let k = 0; k <= 90; k++) { const th = (Math.PI * k) / 90; arc.push([r * Math.cos(th), (up ? 1 : -1) * r * Math.sin(th)]); }
      s.poly(arc, { fill: withAlpha(seriesColor(0), 0.1) });
      s.line([0, -R], [0, R], { stroke: s.color("grid"), width: 1 });
      s.poly(arc, { stroke: seriesColor(0), width: 2, dash: [6, 5], open: true });
      s.line([-r, 0], [r, 0], { stroke: seriesColor(0), width: 2.5 });
      // arrow head: the real axis is run through from left to right
      const px = s.pixel;
      s.poly([[0.45 * r, 0], [0.45 * r - 11 * px, 6 * px], [0.45 * r - 11 * px, -6 * px]], { fill: seriesColor(0) });
      s.text([-r, 0], "real axis of s", { dx: 46, dy: up ? 14 : -14, size: 11, color: s.color("ink-2") });
      all.forEach((p) => {
        const at = [0, p.s], taken = p.upper === up;
        if (taken) s.dot(at, { r: 12, fill: withAlpha(seriesColor(0), 0.25), stroke: seriesColor(0), width: 1.5 });
        s.dot(at, { r: 6, fill: seriesColor(p.vertex), stroke: s.color("surface"), width: 2 });
        s.text(at, `${sub("c", p.vertex)} = 0`, { dx: 18, align: "left", size: 12, weight: taken ? 700 : 500 });
      });
    },
  });

  function update() {
    const { pts, x } = state, c = wachspress(pts, x), pair = chosen(), C = polygonCanonical(pts, x);
    const name = (p) => p.triangle.map((i) => `p<sub>${i}</sub>`).join(" ");
    readout.innerHTML =
      `<table><thead><tr><th>pole</th><th>triangle that remains</th><th>its canonical function at x</th></tr></thead><tbody>` +
      pair.map((p) => `<tr><td>c<sub>${p.vertex}</sub> = 0</td><td>${name(p)}</td><td><b>${fmt(p.value)}</b></td></tr>`).join("") +
      `<tr><td>sum of the two residues</td><td></td><td><b>${fmt(pair[0].value + pair[1].value)}</b></td></tr>` +
      `<tr><td>integral along the real axis (numerical)</td><td></td><td><b>${fmt(quadLineIntegral(pts, c))}</b></td></tr>` +
      `<tr><td>canonical function of the quadrilateral</td><td></td><td><b>${fmt(C)}</b></td></tr></tbody></table>` +
      `<p>The point x lies in one of the two triangles; the other one contributes a negative number. ` +
      `Starting coefficients (Wachspress coordinates of x): ${c.map((v, j) => `c<sub>${j}</sub> = ${fmt(v)}`).join(", ")}.</p>`;
    primal.redraw();
    plane.redraw();
  }

  attachPolygonHandles(primal, state, { bounds: VIEW, onChange: update, margin: 0.06 });
  const side = choiceGroup("Close the contour",
    [{ value: "upper", label: "Above" }, { value: "lower", label: "Below" }], state.side,
    (v) => { state.side = v; update(); });

  root.append(el("div", { class: "controls" }, side.node),
    el("div", { class: "fig-pair" },
      el("div", {}, el("div", { class: "plot-title" }, "The quadrilateral and the triangulation"), left),
      el("div", {}, el("div", { class: "plot-title" }, "The plane of the variable s"), right)),
    el("div", { class: "legend" },
      el("span", { class: "key" }, el("i", { style: "background:var(--series-1)" }), "the contour: the real axis, closed by a half circle"),
      el("span", { class: "key" }, el("i", { style: "background:var(--ink-2); height:8px; width:8px; border-radius:50%" }), "poles, coloured like the vertex whose coefficient vanishes there")),
    el("p", { class: "hint" }, "Drag the vertices or the point x. Move x towards an edge and watch two poles close in on the real axis from both sides."),
    readout);
  update();
}
