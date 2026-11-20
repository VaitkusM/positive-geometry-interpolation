/**
 * residue.js — Figure 4: the recursive structure of a canonical form.
 *
 * Left:  a pentagon; the user picks an edge. A line parallel to that edge at
 *        distance ε shows where the canonical function is sampled.
 * Right: ε · C sampled along that line, compared with the canonical function
 *        L / (s (L − s)) of the edge itself (a segment of length L).
 * As ε → 0 the two agree: "taking the residue" along a boundary component
 * yields the canonical form of that component. Doing it once more at an end
 * point of the edge leaves ±1, the canonical form of a point.
 */

import { Stage, seriesColor, withAlpha } from "../ui/stage.js";
import { el, fmt, sub, choiceGroup, slider } from "../ui/widgets.js";
import { edgeLines, pointInConvex, dist, add, scale, sub as vsub } from "../math/polygon.js";
import { polygonCanonical, segmentCanonical } from "../math/canonical.js";
import { defaultPolygon } from "./common.js";

const SAMPLES = 300;

export function initResidue(root) {
  const pts = defaultPolygon(5);
  const lines = edgeLines(pts);
  const state = { edge: 0, logEps: -0.7, hover: null };

  /** Geometry of the selected edge: end points, length, unit direction, inward normal. */
  function edgeGeom() {
    const p = pts[state.edge], q = pts[(state.edge + 1) % pts.length];
    const L = dist(p, q);
    return { p, q, L, dir: scale(vsub(q, p), 1 / L), n: lines[state.edge].n };
  }
  const eps = () => Math.pow(10, state.logEps);

  /** Sample point at arclength s along the edge, pushed inwards by ε. */
  const sample = (g, s) => add(add(g.p, scale(g.dir, s)), scale(g.n, eps()));

  const left = el("div", { class: "fig-main" }), right = el("div", { class: "fig-side wide" });
  const readout = el("p", { class: "readout", "aria-live": "polite" });

  const polyStage = new Stage(left, {
    view: { xmin: -1.45, xmax: 1.45, ymin: -1.3, ymax: 1.4 }, aspect: 0.93, maxHeight: 400,
    label: "Pentagon with a selected edge and a parallel sampling line",
    draw(s) {
      const g = edgeGeom();
      s.poly(pts, { fill: s.color("fill-soft"), stroke: s.color("ink"), width: 1.5 });
      s.line(g.p, g.q, { stroke: seriesColor(0), width: 4 });
      // the part of the offset line that lies inside the polygon
      const inside = [];
      for (let k = 0; k <= SAMPLES; k++) {
        const x = sample(g, (g.L * k) / SAMPLES);
        if (pointInConvex(pts, x)) inside.push(x);
      }
      if (inside.length > 1) s.poly(inside, { stroke: seriesColor(0), width: 1.5, dash: [5, 4], open: true });
      if (state.hover != null) {
        const x = sample(g, state.hover);
        if (pointInConvex(pts, x)) s.dot(x, { r: 4, fill: seriesColor(0) });
      }
      const mid = add(g.p, scale(g.dir, g.L / 2));
      s.text(mid, "selected edge", { dx: -g.n[0] * 16, dy: g.n[1] * 16, size: 12, color: s.color("ink-2") });
      pts.forEach((p, i) => {
        s.dot(p, { r: 4, fill: s.color("ink") });
        const l = Math.hypot(p[0], p[1]); // the polygon is centred at the origin
        s.text(p, sub("p", i), { dx: (16 * p[0]) / l, dy: (-16 * p[1]) / l, color: s.color("ink-2") });
      });
      // second residue: the two end points of the edge carry +1 and −1
      // (labels are placed just inside the polygon, next to each end point)
      s.text(g.p, "+1", { dx: (g.n[0] + g.dir[0]) * 17, dy: -(g.n[1] + g.dir[1]) * 17, weight: 700 });
      s.text(g.q, "−1", { dx: (g.n[0] - g.dir[0]) * 17, dy: -(g.n[1] - g.dir[1]) * 17, weight: 700 });
    },
  });
  // clicking near an edge selects it
  polyStage.onClick = (w) => {
    let best = 0, bestD = Infinity;
    pts.forEach((p, i) => {
      const q = pts[(i + 1) % pts.length];
      const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      if (dist(m, w) < bestD) { bestD = dist(m, w); best = i; }
    });
    state.edge = best;
    edgeChoice.set(best);
    update();
  };

  const Y_MAX = 12;
  const plot = new Stage(right, {
    view: { xmin: 0, xmax: 1, ymin: 0, ymax: Y_MAX }, equal: false, aspect: 0.62, maxHeight: 400,
    pad: { l: 34, r: 12, t: 22, b: 38 },
    label: "Epsilon times the canonical function along the offset line, versus the canonical function of the edge",
    draw(s) {
      const g = edgeGeom();
      s.axes({
        xticks: [0, 0.25, 0.5, 0.75, 1].map((v) => [v, v === 0 ? "0" : v === 1 ? "L" : `${v}L`]),
        yticks: [0, 4, 8, 12].map((v) => [v, String(v)]),
        xlabel: "position s along the edge",
      });
      const limit = [], scaled = [];
      for (let k = 1; k < SAMPLES; k++) {
        const u = k / SAMPLES, sArc = u * g.L;
        limit.push([u, segmentCanonical(0, g.L, sArc)]);
        const x = sample(g, sArc);
        if (pointInConvex(pts, x)) scaled.push([u, eps() * polygonCanonical(pts, x)]);
      }
      s.clipped(() => {
        s.poly(limit, { stroke: s.color("ink"), width: 2, dash: [6, 5], open: true });
        if (scaled.length > 1) s.poly(scaled, { stroke: seriesColor(0), width: 2, open: true });
        if (state.hover != null) {
          const u = state.hover / g.L;
          s.line([u, 0], [u, Y_MAX], { stroke: s.color("ink-2"), width: 1 });
        }
      });
    },
  });
  plot.onHover = (w) => {
    const g = edgeGeom();
    state.hover = w && w[0] > 0.01 && w[0] < 0.99 ? w[0] * g.L : null;
    update();
  };

  function update() {
    const g = edgeGeom();
    let txt = `ε = <b>${fmt(eps())}</b> (edge length L = ${fmt(g.L, 2)}). `;
    if (state.hover != null) {
      const x = sample(g, state.hover);
      const lim = segmentCanonical(0, g.L, state.hover);
      txt += pointInConvex(pts, x)
        ? `At s = ${fmt(state.hover / g.L, 2)} L: &nbsp; ε·C = <b>${fmt(eps() * polygonCanonical(pts, x))}</b>, ` +
          `&nbsp; L/(s(L−s)) = <b>${fmt(lim)}</b>.`
        : `At s = ${fmt(state.hover / g.L, 2)} L the sampling line is outside the polygon.`;
    } else {
      txt += "Hover over the plot to compare values.";
    }
    readout.innerHTML = txt;
    polyStage.redraw();
    plot.redraw();
  }

  const edgeChoice = choiceGroup("Edge",
    pts.map((_, i) => ({ value: i, label: `${sub("p", i)}${sub("p", (i + 1) % pts.length)}` })),
    state.edge, (v) => { state.edge = v; update(); });
  const epsSlider = slider("Distance ε from the edge", { min: -3, max: -0.5, step: 0.05, value: state.logEps },
    (v) => fmt(Math.pow(10, v)), (v) => { state.logEps = v; update(); });

  root.append(
    el("div", { class: "controls" }, edgeChoice.node, epsSlider.node),
    el("div", { class: "legend" },
      el("span", { class: "key" }, el("i", { style: "background:var(--series-1)" }),
        "ε · C(x), sampled at distance ε from the edge"),
      el("span", { class: "key" }, el("i", { class: "dashed" }),
        "L / (s (L − s)): canonical function of the edge")),
    el("div", { class: "fig-split" }, left, right), readout);
  update();
}
