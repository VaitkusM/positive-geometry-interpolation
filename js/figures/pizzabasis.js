/**
 * pizzabasis.js — Figure 11 (later developments): Wachspress' own rational
 * basis on a polycon, shown on the pizza slice.
 *
 * A conic side needs a third node, the side node M, which the user can slide
 * along the arc. The four basis functions (corner O, vertices V1, V2, side
 * node M) share the adjoint 1 + 2y as denominator. They sum to one and
 * reproduce linear functions, but the two vertex functions change sign inside
 * the element — as Wachspress himself points out.
 * Math: pizzaWachspress() in js/math/canonical.js.
 */

import { Stage, seriesColor } from "../ui/stage.js";
import { sequentialRGB } from "../ui/ramp.js";
import { zeroSet, strokeSegments } from "../ui/contour.js";
import { el, fmt, choiceGroup } from "../ui/widgets.js";
import { PIZZA, pizzaWachspress } from "../math/canonical.js";

const VIEW = { xmin: -1.75, xmax: 1.75, ymin: -1.15, ymax: 1.3 };
const NAMES = ["O", "V₁", "V₂", "M"];
const DEG = Math.PI / 180;
const STEP = 2; // raster step in css pixels

export function initPizzaBasis(root) {
  const state = { theta: 75 * DEG, x: [0.15, 0.55], sel: 1 };
  const box = el("div");
  const table = el("div", { class: "readout", "aria-live": "polite" });
  const buffer = document.createElement("canvas");

  function hexRGB(hex) {
    const v = parseInt(hex.replace("#", ""), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }

  const stage = new Stage(box, {
    view: VIEW, aspect: 0.7, maxHeight: 500,
    label: "Pizza slice shaded by one of Wachspress' four basis functions, with a movable side node on the arc",
    draw(s) {
      // shade the slice by the selected basis function; negative values in a second colour
      const w = Math.ceil(s.width / STEP), h = Math.ceil(s.height / STEP);
      buffer.width = w; buffer.height = h;
      const bctx = buffer.getContext("2d"), img = bctx.createImageData(w, h);
      const neg = hexRGB(seriesColor(7));
      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          const p = s.toWorld([(px + 0.5) * STEP, (py + 0.5) * STEP]);
          if (!PIZZA.inside(p[0], p[1])) continue;
          const val = pizzaWachspress(state.theta, p).weights[state.sel];
          const rgb = val < 0 ? neg : sequentialRGB(val);
          const o = 4 * (py * w + px);
          img.data[o] = rgb[0]; img.data[o + 1] = rgb[1]; img.data[o + 2] = rgb[2]; img.data[o + 3] = 255;
        }
      }
      bctx.putImageData(img, 0, 0);
      s.ctx.imageSmoothingEnabled = false;
      s.ctx.drawImage(buffer, 0, 0, w * STEP, h * STEP);

      const a = s.toWorld([0, s.height]), b = s.toWorld([s.width, 0]);
      const vis = { xmin: a[0], xmax: b[0], ymin: a[1], ymax: b[1] };
      for (const f of [PIZZA.circle, PIZZA.line1, PIZZA.line2]) {
        strokeSegments(s, zeroSet(f, vis, 240), s.color("axis"), 1.25);
      }
      strokeSegments(s, zeroSet(PIZZA.adjoint, vis, 60), seriesColor(1), 2.5);
      const { nodes, adjacent } = pizzaWachspress(state.theta, state.x);
      // the "adjacent factor" of the selected vertex: the line through M and a residual point
      if (state.sel === 1 || state.sel === 2) {
        const { a: m, b: e } = adjacent[state.sel - 1];
        const dir = [e[0] - m[0], e[1] - m[1]];
        s.line([m[0] - 3 * dir[0], m[1] - 3 * dir[1]], [m[0] + 3 * dir[0], m[1] + 3 * dir[1]],
          { stroke: s.color("ink"), width: 1.5, dash: [6, 4] });
      }
      for (const r of PIZZA.residual) {
        s.dot(r, { r: 6.5, fill: s.color("surface") });
        s.dot(r, { r: 4.5, fill: seriesColor(1) });
      }
      const offsets = [[0, 18], [16, 6], [-16, 6], [0, -18]];
      nodes.forEach((p, i) => {
        s.knob(p, i === 3 ? seriesColor(0) : s.color("ink"), i === state.sel ? 8 : 6);
        s.text(p, NAMES[i], { dx: offsets[i][0], dy: offsets[i][1], size: 14, weight: i === state.sel ? 700 : 500 });
      });
      s.knob(state.x, s.color("ink"), 5);
      s.text(state.x, "x", { dx: 11, dy: -11, size: 14 });
    },
  });

  stage.handles = () => [
    { // side node: slides along the arc, kept away from the two vertices
      pos: () => [Math.cos(state.theta), Math.sin(state.theta)],
      drag: (q) => {
        state.theta = Math.max(38 * DEG, Math.min(142 * DEG, Math.atan2(q[1], q[0] )));
        update();
      },
    },
    { // evaluation point: only moves to positions safely inside the slice
      pos: () => state.x,
      drag: (q) => {
        const inside = PIZZA.circle(q[0], q[1]) > 0.03 && PIZZA.line1(q[0], q[1]) > 0.03 &&
          PIZZA.line2(q[0], q[1]) > 0.03;
        if (inside) { state.x = q; update(); }
      },
    },
  ];

  function update() {
    const { nodes, weights } = pizzaWachspress(state.theta, state.x);
    const sum = weights.reduce((a, b) => a + b, 0);
    const back = [0, 1].map((k) => weights.reduce((acc, w, i) => acc + w * nodes[i][k], 0));
    table.innerHTML =
      `<table><thead><tr><th>node</th>${NAMES.map((n) => `<th>${n}</th>`).join("")}</tr></thead>` +
      `<tbody><tr><td>value at x</td>${weights.map((w) => `<td>${fmt(w)}</td>`).join("")}</tr></tbody></table>` +
      `<p>Checks: &nbsp; sum = <b>${fmt(sum)}</b>, &nbsp; Σ (value × node) = ` +
      `<b>(${fmt(back[0])}, ${fmt(back[1])})</b> &nbsp;vs.&nbsp; x = (${fmt(state.x[0])}, ${fmt(state.x[1])})</p>`;
    stage.redraw();
  }

  const choice = choiceGroup("Shade by the basis function of",
    NAMES.map((label, value) => ({ value, label: value === 3 ? "side node M" : value === 0 ? "corner O" : `vertex ${label}` })),
    state.sel, (v) => { state.sel = v; update(); });

  root.append(el("div", { class: "controls" }, choice.node),
    el("div", { class: "legend" },
      el("span", { class: "key" }, el("i", { class: "ramp" }), "value from 0 to 1"),
      el("span", { class: "key" }, el("i", { style: "background:var(--series-8);height:10px;width:10px" }),
        "negative values"),
      el("span", { class: "key" }, el("i", { style: "background:var(--series-2)" }), "adjoint line (common denominator)"),
      el("span", { class: "key" }, el("i", { class: "dashed" }), "adjacent factor of the selected vertex")),
    box, el("p", { class: "hint" }, "Drag the side node M along the arc, or the point x."), table);
  update();
}
