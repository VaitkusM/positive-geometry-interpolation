/**
 * wachspress.js — Figure 5 (the main figure): barycentric coordinates of a
 * convex polygon as ratios of canonical forms, and their dual-volume meaning.
 *
 * Left stage  — the polygon P, the evaluation point x and, for the selected
 *               vertex i, the wedge bounded by the two edge lines through it.
 *               (Projectively the wedge is the triangle Δ(l_{i−1}, l_i, x*),
 *               whose third side x* is the line at infinity in this chart.)
 * Right stage — the polar dual polygon P*_x (x is the origin). It is tiled by
 *               the fan triangles (0, d_{i−1}, d_i), one per vertex of P, and
 *               λ_i = area of triangle i / area of the dual polygon.
 */

import { Stage, seriesColor, withAlpha } from "../ui/stage.js";
import { sequentialRGB } from "../ui/ramp.js";
import { el, fmt, sub, makeBars, choiceGroup, checkbox } from "../ui/widgets.js";
import { edgeLines, lineDist, det2, mod, add, scale, sub as vsub, centroid } from "../math/polygon.js";
import { vertexWedges } from "../math/canonical.js";
import { polarDual, combine } from "../math/barycentric.js";
import { defaultPolygon, attachPolygonHandles } from "./common.js";

const VIEW = { xmin: -1.75, xmax: 1.75, ymin: -1.5, ymax: 1.5 };
const HEAT_STEP = 3; // heat map resolution: one sample per HEAT_STEP css pixels

export function initWachspress(root) {
  const state = { pts: defaultPolygon(5), x: [0.2, -0.1], selected: 0, heat: false };

  const left = el("div", { class: "fig-main" }), right = el("div", { class: "fig-main" });
  const side = el("div");
  const readout = el("div", { class: "readout", "aria-live": "polite" });
  const updateBars = makeBars(side);
  const heatCanvas = document.createElement("canvas"); // off-screen buffer

  /** Paint λ_selected over the polygon into the off-screen buffer and blit it. */
  function drawHeat(s) {
    const w = Math.ceil(s.width / HEAT_STEP), h = Math.ceil(s.height / HEAT_STEP);
    heatCanvas.width = w;
    heatCanvas.height = h;
    const hctx = heatCanvas.getContext("2d");
    const img = hctx.createImageData(w, h);
    const lines = edgeLines(state.pts), n = lines.length;
    const hd = new Array(n);
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const p = s.toWorld([(px + 0.5) * HEAT_STEP, (py + 0.5) * HEAT_STEP]);
        let inside = true;
        for (let i = 0; i < n; i++) {
          hd[i] = lineDist(lines[i], p);
          if (hd[i] <= 0) { inside = false; break; }
        }
        if (!inside) continue;
        let sum = 0, sel = 0;
        for (let i = 0; i < n; i++) {
          const j = mod(i - 1, n);
          const wgt = det2(lines[j].n, lines[i].n) / (hd[j] * hd[i]);
          sum += wgt;
          if (i === state.selected) sel = wgt;
        }
        const [r, g, b] = sequentialRGB(sel / sum);
        const o = 4 * (py * w + px);
        img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255;
      }
    }
    hctx.putImageData(img, 0, 0);
    const c = s.ctx;
    c.save();
    c.beginPath();
    state.pts.forEach((p, i) => { const q = s.toScreen(p); if (i) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]); });
    c.closePath();
    c.clip();
    c.imageSmoothingEnabled = true;
    c.drawImage(heatCanvas, 0, 0, w * HEAT_STEP, h * HEAT_STEP);
    c.restore();
  }

  const primal = new Stage(left, {
    view: VIEW, aspect: 0.86, maxHeight: 440,
    label: "Convex polygon with draggable vertices, evaluation point x and the wedge at the selected vertex",
    draw(s) {
      const { pts, x, selected: i } = state;
      const n = pts.length, lines = edgeLines(pts);
      const col = seriesColor(i);
      const prev = pts[mod(i - 1, n)], next = pts[(i + 1) % n], v = pts[i];
      // the wedge at vertex i: the cone spanned by the two edges through it
      const far = 50;
      const wedge = [v, add(v, scale(vsub(next, v), far)), add(v, scale(vsub(prev, v), far))];
      // (drawn over the polygon's own fill, so that one sees the wedge contains P)
      if (state.heat) drawHeat(s); else s.poly(pts, { fill: s.color("fill-soft") });
      s.poly(wedge, { fill: withAlpha(col, state.heat ? 0.08 : 0.16) });
      s.fullLine(lines[mod(i - 1, n)], { stroke: col, width: 1.5 });
      s.fullLine(lines[i], { stroke: col, width: 1.5 });
      s.poly(pts, { stroke: s.color("ink"), width: 2 });
      // distances h_{i−1}, h_i from x to the two edge lines through vertex i
      for (const k of [mod(i - 1, n), i]) {
        const foot = vsub(x, scale(lines[k].n, lineDist(lines[k], x)));
        s.line(x, foot, { stroke: s.color("ink"), width: 1.25, dash: [4, 3] });
        s.text([(x[0] + foot[0]) / 2, (x[1] + foot[1]) / 2], sub("h", k), { size: 12 });
      }
      const c = centroid(pts);
      pts.forEach((p, k) => {
        s.knob(p, seriesColor(k), k === i ? 8 : 6);
        const d = vsub(p, c), l = Math.hypot(...d);
        s.text(p, sub("p", k), { dx: (19 * d[0]) / l, dy: (-19 * d[1]) / l, size: 14, weight: k === i ? 700 : 500 });
      });
      s.knob(x, s.color("ink"), 6);
      s.text(x, "x", { dx: 12, dy: -12, size: 14 });
    },
  });

  const dual = new Stage(right, {
    view: { xmin: -1, xmax: 1, ymin: -1, ymax: 1 }, aspect: 0.86, maxHeight: 440,
    label: "Polar dual polygon, tiled by one triangle per vertex of the original polygon",
    draw(s) {
      const d = polarDual(state.pts, state.x), n = d.length;
      // zoom so that the dual polygon always fills the stage
      const R = 1.25 * Math.max(...d.map((p) => Math.hypot(p[0], p[1])));
      s.setView({ xmin: -R, xmax: R, ymin: -R, ymax: R });
      for (let i = 0; i < n; i++) {
        const tri = [[0, 0], d[mod(i - 1, n)], d[i]];
        s.poly(tri, { fill: withAlpha(seriesColor(i), i === state.selected ? 0.75 : 0.3),
          stroke: s.color("surface"), width: 2 });
      }
      for (let i = 0; i < n; i++) {
        s.line(d[mod(i - 1, n)], d[i], { stroke: seriesColor(i), width: i === state.selected ? 4 : 2.5 });
      }
      d.forEach((p, k) => {
        s.dot(p, { r: 4, fill: s.color("ink") });
        const l = Math.hypot(p[0], p[1]);
        s.text(p, sub("d", k), { dx: (15 * p[0]) / l, dy: (-15 * p[1]) / l, size: 12, color: s.color("ink-2") });
      });
      s.knob([0, 0], s.color("ink"), 5);
      s.text([0, 0], "x", { dx: 11, dy: -11, size: 14 });
    },
  });
  // clicking a fan triangle of the dual selects the corresponding vertex
  dual.onClick = (w) => {
    const d = polarDual(state.pts, state.x), n = d.length;
    for (let i = 0; i < n; i++) {
      const a = d[mod(i - 1, n)], b = d[i];
      if (det2(a, w) >= 0 && det2(w, b) >= 0 && det2(vsub(b, a), vsub(w, a)) >= 0) {
        state.selected = i;
        update();
        return;
      }
    }
  };

  function update() {
    const { pts, x, selected: i } = state;
    const n = pts.length;
    const w = vertexWedges(pts, x);
    const C = w.reduce((a, b) => a + b, 0);
    const lam = w.map((v) => v / C);
    const back = combine(lam, pts);
    updateBars(lam, i);
    readout.innerHTML =
      `<p>Selected vertex p<sub>${i}</sub>: &nbsp; wedge form ` +
      `w<sub>${i}</sub> = det(n<sub>${mod(i - 1, n)}</sub>, n<sub>${i}</sub>) / ` +
      `(h<sub>${mod(i - 1, n)}</sub> h<sub>${i}</sub>) = <b>${fmt(w[i])}</b>` +
      `<br>whole polygon: &nbsp; C<sub>P</sub> = Σ w<sub>k</sub> = <b>${fmt(C)}</b> ` +
      `= 2 × area of the dual polygon` +
      `<br>ratio: &nbsp; λ<sub>${i}</sub> = w<sub>${i}</sub> / C<sub>P</sub> = <b>${fmt(lam[i])}</b></p>` +
      `<p>Checks: &nbsp; Σ λ<sub>k</sub> = <b>${fmt(lam.reduce((a, b) => a + b, 0))}</b>, &nbsp; ` +
      `Σ λ<sub>k</sub> p<sub>k</sub> = <b>(${fmt(back[0])}, ${fmt(back[1])})</b> ` +
      `&nbsp;vs.&nbsp; x = (${fmt(x[0])}, ${fmt(x[1])})</p>`;
    primal.redraw();
    dual.redraw();
  }

  attachPolygonHandles(primal, state, { bounds: VIEW, onChange: update });

  const sides = choiceGroup("Number of vertices",
    [3, 4, 5, 6, 7, 8].map((v) => ({ value: v, label: String(v) })), 5,
    (v) => {
      state.pts = defaultPolygon(v);
      state.x = [0.2, -0.1];
      state.selected = Math.min(state.selected, v - 1);
      update();
    });
  const heat = checkbox("Shade the polygon by λ of the selected vertex", state.heat,
    (on) => { state.heat = on; update(); });

  root.append(
    el("div", { class: "controls" }, sides.node, heat.node),
    el("div", { class: "fig-pair" },
      el("div", {}, el("div", { class: "plot-title" }, "Polygon P and the wedge at the selected vertex"), left),
      el("div", {}, el("div", { class: "plot-title" }, "Polar dual P*ₓ (x at the origin)"), right)),
    el("p", { class: "hint" },
      "Drag the vertices or the point x. Click a vertex (or a triangle of the dual) to select it."),
    side, readout);
  update();
}
