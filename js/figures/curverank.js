/**
 * curverank.js — Figure 11c (later development): genus and combinatorial rank
 * of some curves in the plane.
 *
 * For a curve Y in the projective plane, Brown and Dupont's two numbers are
 * (math/hodge.js)
 *     genus  g  = sum of the genera of the components,
 *     rank   cr = Σ_P (branches at P − 1) − (components − 1),
 * and for curves whose only singular points are crossings of two branches the
 * rank is the number of independent loops of the graph with one dot for every
 * component and one line for every crossing. There are cr independent
 * canonical forms, each determined up to g ambiguities.
 *
 * Left:  the real picture of the curves, with the crossing points marked.
 * Right: the graph of components and crossings.
 */

import { Stage, seriesColor, withAlpha } from "../ui/stage.js";
import { el, choiceGroup } from "../ui/widgets.js";
import { regularPolygon } from "../math/polygon.js";
import { planeCurveInvariants, cubicG, cubicRoots, cubicLoop } from "../math/hodge.js";

const VIEW = { xmin: -1.6, xmax: 1.6, ymin: -1.3, ymax: 1.3 };

/** A cubic y² = x²(1 − x) − ε, moved and scaled into the view: [x, y] ↦ [2.2 x − 0.9, 2.2 y]. */
const place = ([x, y]) => [2.2 * x - 0.9, 2.2 * y];
function cubicBranches(eps) {
  const [r1] = cubicRoots(eps), loop = cubicLoop(eps, 240).pts.map(place), upper = [], lower = [];
  for (let k = 0; k <= 80; k++) {
    const u = k / 80, x = r1 - 0.6 * u * u, y = Math.sqrt(Math.max(0, cubicG(eps, x)));
    upper.push(place([x, y])); lower.push(place([x, -y]));
  }
  return [loop, upper, lower];
}
const circle = () => Array.from({ length: 121 }, (_, k) => [Math.cos((2 * Math.PI * k) / 120), Math.sin((2 * Math.PI * k) / 120)]);
const pentagon = regularPolygon(5, 0.62);

/**
 * Each example: components (name, genus, polylines to draw; `closed` for filled outlines),
 * crossings ([i, j] = components that meet there, with the point `at` if it is in the picture),
 * and a note.
 */
const EXAMPLES = {
  triangle: {
    label: "Three lines",
    components: [
      { name: "line", genus: 0, paths: [[[-1.5, -0.7], [1.5, -0.7]]] },
      { name: "line", genus: 0, paths: [[[-1.3, -1.2], [0.5, 1.2]]] },
      { name: "line", genus: 0, paths: [[[1.3, -1.2], [-0.5, 1.2]]] },
    ],
    crossings: [{ of: [0, 1], at: [-0.925, -0.7] }, { of: [0, 2], at: [0.925, -0.7] }, { of: [1, 2], at: [0, 0.533] }],
    note: "One bounded region, the triangle, and one canonical form.",
  },
  pentagon: {
    label: "Five lines",
    components: pentagon.map((p, i) => {
      const q = pentagon[(i + 1) % 5], d = [q[0] - p[0], q[1] - p[1]];
      return { name: "line", genus: 0, paths: [[[p[0] - 3 * d[0], p[1] - 3 * d[1]], [q[0] + 3 * d[0], q[1] + 3 * d[1]]]] };
    }),
    crossings: (() => {
      const out = [];
      for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) {
        // intersection of the edge lines i and j
        const a = pentagon[i], b = pentagon[(i + 1) % 5], c = pentagon[j], d = pentagon[(j + 1) % 5];
        const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]], den = r[0] * s[1] - r[1] * s[0];
        const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den;
        out.push({ of: [i, j], at: [a[0] + t * r[0], a[1] + t * r[1]] });
      }
      return out;
    })(),
    note: "Six bounded regions: the pentagon and the five triangles of the star. Their canonical forms are a basis of all forms with logarithmic poles on the five lines.",
  },
  halfdisc: {
    label: "Conic and line",
    components: [
      { name: "conic", genus: 0, paths: [circle()] },
      { name: "line", genus: 0, paths: [[[-1.5, 0], [1.5, 0]]] },
    ],
    crossings: [{ of: [0, 1], at: [-1, 0] }, { of: [0, 1], at: [1, 0] }],
    note: "Two bounded regions, the two half discs, but only one canonical form up to sign: the forms of the two halves cancel, because together they make the disc, whose canonical form is zero.",
  },
  pizza: {
    label: "Conic and two lines",
    components: [
      { name: "conic", genus: 0, paths: [circle()] },
      { name: "line", genus: 0, paths: [[[-1.5, -0.6], [1.5, 0.6]]] },
      { name: "line", genus: 0, paths: [[[-0.5, -1.25], [0.5, 1.25]]] },
    ],
    crossings: [
      { of: [1, 2], at: [0, 0] },
      { of: [0, 1], at: [0.928, 0.371] }, { of: [0, 1], at: [-0.928, -0.371] },
      { of: [0, 2], at: [0.371, 0.928] }, { of: [0, 2], at: [-0.371, -0.928] },
    ],
    note: "Four sectors, but three independent canonical forms: the four forms add up to that of the disc, which is zero.",
  },
  nodal: {
    label: "Nodal cubic",
    components: [{ name: "cubic", genus: 0, paths: cubicBranches(0) }],
    crossings: [{ of: [0, 0], at: place([0, 0]) }],
    note: "The curve crosses itself once. One bounded region, the teardrop, and one canonical form (Figure 11b).",
  },
  cusp: {
    label: "Cuspidal cubic",
    components: [{ name: "cubic", genus: 0,
      paths: [Array.from({ length: 81 }, (_, k) => { const t = -1.1 + (2.2 * k) / 80; return [1.3 * t * t - 0.9, 1.3 * t * t * t]; })] }],
    crossings: [],
    note: "A cusp is a single branch, not a crossing: the rank is zero. There is no form with logarithmic poles on this curve at all.",
  },
  smooth: {
    label: "Smooth cubic",
    components: [{ name: "cubic", genus: 1, paths: cubicBranches(0.05) }],
    crossings: [],
    note: "No crossings, so no canonical form; and one ambiguity, the form that Figure 11b follows through the smoothing of the node.",
  },
  cubicline: {
    label: "Smooth cubic and line",
    components: [
      { name: "cubic", genus: 1, paths: cubicBranches(0.05) },
      { name: "line", genus: 0, paths: [[[0.45, -1.25], [0.45, 1.25]]] },
    ],
    crossings: (() => {
      const x = (0.45 + 0.9) / 2.2, y = Math.sqrt(cubicG(0.05, x));
      return [{ of: [0, 1], at: place([x, y]) }, { of: [0, 1], at: place([x, -y]) }, { of: [0, 1], at: null }];
    })(),
    note: "Three crossings (the third one is at infinity). Two independent canonical forms exist, but each is determined only up to adding a multiple of the ambiguity of the cubic.",
  },
};

export function initCurveRank(root) {
  const state = { key: "triangle" };
  const left = el("div"), right = el("div");
  const readout = el("div", { class: "readout", "aria-live": "polite" });

  const picture = new Stage(left, {
    view: VIEW, aspect: 0.81, maxHeight: 400,
    label: "The real points of the chosen curves, with their crossing points marked",
    draw(s) {
      const ex = EXAMPLES[state.key];
      s.clipped(() => {
        ex.components.forEach((c, i) => c.paths.forEach((p) => s.poly(p, { stroke: seriesColor(i), width: 2.5, open: true })));
      });
      ex.crossings.forEach((c) => { if (c.at) s.dot(c.at, { r: 5, fill: s.color("ink"), stroke: s.color("surface"), width: 2 }); });
    },
  });

  const graph = new Stage(right, {
    view: { xmin: -1.5, xmax: 1.5, ymin: -1.25, ymax: 1.25 }, aspect: 0.81, maxHeight: 400,
    label: "A graph with one dot for each curve and one line for each crossing point",
    draw(s) {
      const ex = EXAMPLES[state.key], k = ex.components.length;
      const pos = ex.components.map((_, i) => (k === 1 ? [0, -0.1] : [0.85 * Math.cos(Math.PI / 2 + (2 * Math.PI * i) / k), 0.85 * Math.sin(Math.PI / 2 + (2 * Math.PI * i) / k)]));
      // several crossings of the same pair are drawn as arcs that bulge by different amounts
      const count = {}, seen = {};
      ex.crossings.forEach((c) => { const key = c.of.join(); count[key] = (count[key] || 0) + 1; });
      ex.crossings.forEach((c) => {
        const key = c.of.join(), idx = (seen[key] = (seen[key] || 0) + 1) - 1, m = count[key];
        const [i, j] = c.of, a = pos[i], b = pos[j];
        if (i === j) {                                             // a self-crossing: a loop at the dot
          const ring = [];
          for (let t = 0; t <= 60; t++) { const th = (2 * Math.PI * t) / 60; ring.push([a[0] + 0.42 * Math.sin(th), a[1] + 0.42 - 0.42 * Math.cos(th)]); }
          s.poly(ring, { stroke: s.color("ink"), width: 2 });
          return;
        }
        const bulge = (idx - (m - 1) / 2) * 0.34, n = [-(b[1] - a[1]), b[0] - a[0]];
        const arc = [];
        for (let t = 0; t <= 30; t++) {
          const u = t / 30, w = 4 * u * (1 - u) * bulge;
          arc.push([a[0] + u * (b[0] - a[0]) + w * n[0], a[1] + u * (b[1] - a[1]) + w * n[1]]);
        }
        s.poly(arc, { stroke: s.color("ink"), width: 2, open: true });
      });
      ex.components.forEach((c, i) => {
        // a component of positive genus is drawn as a ring
        if (c.genus > 0) s.dot(pos[i], { r: 17, fill: withAlpha(seriesColor(i), 0.18), stroke: seriesColor(i), width: 2.5 });
        s.knob(pos[i], seriesColor(i), 8);
        const out = k === 1 ? [0, -1] : pos[i];
        const l = Math.hypot(out[0], out[1]);
        s.text(pos[i], c.genus > 0 ? `${c.name}, genus ${c.genus}` : c.name,
          { dx: (34 * out[0]) / l, dy: (-28 * out[1]) / l, size: 12 });
      });
    },
  });

  function update() {
    const ex = EXAMPLES[state.key];
    // number of branches at every singular point: 2 at each crossing (a cusp has one branch and does not count)
    const inv = planeCurveInvariants(ex.components.map((c) => c.genus), ex.crossings.map(() => 2));
    const cell = (v, kind) => `<td class="${kind}">${v}</td>`;
    readout.innerHTML =
      `<table><thead><tr><th>${ex.label}</th><th>value</th></tr></thead><tbody>` +
      `<tr><td>components / crossing points</td><td><b>${ex.components.length} / ${ex.crossings.length}</b></td></tr>` +
      `<tr><td>combinatorial rank = independent loops of the graph = independent canonical forms</td><td><b>${inv.rank}</b></td></tr>` +
      `<tr><td>genus = sum of the genera of the curves = ambiguities</td><td><b>${inv.genus}</b></td></tr>` +
      `<tr><td>dimension of the space of forms with logarithmic poles (rank + genus)</td><td><b>${inv.forms}</b></td></tr></tbody></table>` +
      `<p>${inv.rank === 0 ? "No canonical form." : inv.genus === 0
        ? `Canonical forms exist and are unique.` : "Canonical forms exist but are not unique."} ${ex.note}</p>` +
      `<p>Hodge numbers h<sup>−p,−q</sup> of the relative homology group (columns p = 0, 1, 2; rows q = 0, 1, 2):</p>` +
      `<table class="hodge"><tbody>` +
      inv.hodge.map((row, q) => `<tr>${row.map((v, p) => cell(v, p === 0 && q === 0 ? "rank" : q === 0 && p > 0 ? "genus" : "")).join("")}</tr>`).join("") +
      `</tbody></table>` +
      `<p>The corner entry is the rank; the rest of the first row is the genus.</p>`;
    picture.redraw();
    graph.redraw();
  }

  const pick = choiceGroup("Curves", Object.entries(EXAMPLES).map(([value, e]) => ({ value, label: e.label })), state.key,
    (v) => { state.key = v; update(); });

  root.append(el("div", { class: "controls" }, pick.node),
    el("div", { class: "fig-pair" },
      el("div", {}, el("div", { class: "plot-title" }, "The curves (real points)"), left),
      el("div", {}, el("div", { class: "plot-title" }, "Components and crossings as a graph"), right)),
    el("div", { class: "legend" },
      el("span", { class: "key" }, el("i", { style: "background:var(--ink); height:8px; width:8px; border-radius:50%" }), "crossing point of two branches"),
      el("span", { class: "key" }, "in the graph: a dot for each curve (a ring marks genus 1), a line for each crossing")),
    readout);
  update();
}
