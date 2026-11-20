/**
 * triangle.js — Figure 2: barycentric coordinates on a triangle.
 *
 * Shows the three sub-triangle areas A_i and verifies live that the usual
 * formula λ_i = A_i / A coincides with the "ratio of poles" form (2.4), whose
 * denominator A / (A0 A1 A2) is (up to a constant) the canonical function of
 * the triangle.
 */

import { Stage, seriesColor, withAlpha } from "../ui/stage.js";
import { el, fmt, sub, makeBars } from "../ui/widgets.js";
import { triangleAreas } from "../math/barycentric.js";
import { triangleCanonical } from "../math/canonical.js";
import { centroid } from "../math/polygon.js";
import { attachPolygonHandles } from "./common.js";

const VIEW = { xmin: -1.7, xmax: 1.7, ymin: -1.25, ymax: 1.35 };

export function initTriangle(root) {
  const state = { pts: [[-1.2, -0.55], [1.25, -0.9], [0.35, 1.05]], x: [0.15, -0.15] };

  const stageBox = el("div", { class: "fig-main" });
  const side = el("div", { class: "fig-side" });
  root.append(el("div", { class: "fig-split" }, stageBox, side));
  const table = el("div", { class: "readout" });
  const updateBars = makeBars(side);
  side.append(table);

  const stage = new Stage(stageBox, {
    view: VIEW, aspect: 0.78,
    label: "Triangle with draggable vertices and a draggable interior point x",
    draw(s) {
      const { pts, x } = state;
      s.poly(pts, { fill: s.color("fill-soft") });
      // sub-triangle opposite to vertex i, tinted with the colour of vertex i
      for (let i = 0; i < 3; i++) {
        const tri = [x, pts[(i + 1) % 3], pts[(i + 2) % 3]];
        s.poly(tri, { fill: withAlpha(seriesColor(i), 0.3), stroke: s.color("surface"), width: 2 });
        s.text(centroid(tri), sub("A", i), { size: 14 });
      }
      s.poly(pts, { stroke: s.color("ink"), width: 2 });
      const c = centroid(pts);
      pts.forEach((p, i) => {
        s.knob(p, seriesColor(i));
        const d = [p[0] - c[0], p[1] - c[1]], l = Math.hypot(...d);
        s.text(p, sub("p", i), { dx: (18 * d[0]) / l, dy: (-18 * d[1]) / l, size: 14 });
      });
      s.knob(x, s.color("ink"), 6);
      s.text(x, "x", { dx: 12, dy: -12, size: 14 });
    },
  });

  function update() {
    const { A, Ai } = triangleAreas(...state.pts, state.x);
    const lam = Ai.map((a) => a / A);
    const denom = A / (Ai[0] * Ai[1] * Ai[2]);
    updateBars(lam);
    const row = (i) => {
      const j = (i + 1) % 3, k = (i + 2) % 3;
      return `<tr><td>λ<sub>${i}</sub></td><td>${fmt(Ai[i] / A)}</td>` +
        `<td>${fmt(1 / (Ai[j] * Ai[k]) / denom)}</td></tr>`;
    };
    table.innerHTML =
      `<table><thead><tr><th></th><th>A<sub>i</sub> / A</th>` +
      `<th>(1/A<sub>j</sub>A<sub>k</sub>) ÷ (A/A<sub>0</sub>A<sub>1</sub>A<sub>2</sub>)</th></tr></thead>` +
      `<tbody>${row(0)}${row(1)}${row(2)}</tbody></table>` +
      `<p>Canonical function at x: &nbsp;C = A² / (2 A<sub>0</sub>A<sub>1</sub>A<sub>2</sub>) = ` +
      `<b>${fmt(triangleCanonical(...state.pts, state.x))}</b></p>`;
    stage.redraw();
  }

  attachPolygonHandles(stage, state, { bounds: VIEW, onChange: update });
  update();
}
