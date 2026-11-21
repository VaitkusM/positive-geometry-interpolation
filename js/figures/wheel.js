/**
 * wheel.js — Figure 5b (added remark): the mechanical reading of Section 5.
 *
 * Left:  the polygon as a WHEEL. Its edges are rim bars, the point x is the
 *        hub, and spokes join x to the vertices. Spoke i pulls with the force
 *        w_i (p_i − x); bar widths show the size of the forces.
 * Right: the FORCE DIAGRAM (Maxwell's reciprocal figure). Every bar force is
 *        turned by a right angle; the spoke forces form a closed polygon.
 *
 * The spoke forces can be taken from Wachspress, mean value or discrete
 * harmonic coordinates (forcePolygon in math/barycentric.js). All three
 * balance at the hub. The rim can balance them at the vertices only if the
 * lines through the corners of the force polygon, perpendicular to the rim
 * bars, meet in one point — which singles out the Wachspress weights.
 *
 * Selection: a vertex (its force triangle is highlighted) or the hub.
 */

import { Stage, seriesColor, withAlpha } from "../ui/stage.js";
import { el, fmt, sub, choiceGroup, makeBars } from "../ui/widgets.js";
import { centroid, edgeLines, mod } from "../math/polygon.js";
import { forcePolygon } from "../math/barycentric.js";
import { defaultPolygon, attachPolygonHandles } from "./common.js";

const VIEW = { xmin: -1.75, xmax: 1.75, ymin: -1.5, ymax: 1.5 };
const HUB = -1;                 // value of state.selected when the hub is selected
const BALANCED = 1e-6;          // apex spread below this counts as "one point"
const ARROW = 0.75;             // world length of the longest force arrow

const KINDS = [
  { value: "wachspress", label: "Wachspress" },
  { value: "meanvalue", label: "Mean value" },
  { value: "harmonic", label: "Discrete harmonic" },
];

export function initWheel(root) {
  const state = { pts: defaultPolygon(5), x: [0.2, -0.1], selected: 0, kind: "wachspress" };
  const left = el("div", { class: "fig-main" }), right = el("div", { class: "fig-main" });
  const side = el("div");
  const readout = el("div", { class: "readout", "aria-live": "polite" });
  const updateBars = makeBars(side);

  /** All forces of the current configuration (recomputed on every change). */
  function solve() {
    const { pts, x, kind } = state, n = pts.length;
    const F = forcePolygon(pts, x, kind);
    const r = pts.map((p) => Math.hypot(p[0] - x[0], p[1] - x[1]));
    const balanced = F.spread < BALANCED;
    const O = F.apex.reduce((s, a) => [s[0] + a[0] / n, s[1] + a[1] / n], [0, 0]);
    const spoke = F.weights.map((w, i) => Math.abs(w) * r[i]);               // force in spoke i
    const rim = F.v.map((q) => Math.hypot(q[0] - O[0], q[1] - O[1]));         // force in rim bar i (if balanced)
    const biggest = Math.max(...spoke, ...(balanced ? rim : []));
    return { F, r, balanced, O, spoke, rim, biggest };
  }

  /** Arrow from the world point `from` along the world vector `vec`. */
  function arrow(s, from, vec, color) {
    const len = Math.hypot(vec[0], vec[1]);
    if (len < 1e-9) return;
    const to = [from[0] + vec[0], from[1] + vec[1]];
    const d = [vec[0] / len, vec[1] / len], h = Math.min(11 * s.pixel, 0.6 * len), w = 0.45 * h;
    const base = [to[0] - h * d[0], to[1] - h * d[1]];
    s.line(from, base, { stroke: s.color("surface"), width: 6 });
    s.line(from, base, { stroke: color, width: 3 });
    s.poly([to, [base[0] - w * d[1], base[1] + w * d[0]], [base[0] + w * d[1], base[1] - w * d[0]]],
      { fill: color, stroke: s.color("surface"), width: 1 });
  }

  const wheel = new Stage(left, {
    view: VIEW, aspect: 0.86, maxHeight: 440,
    label: "The polygon as a wheel: rim bars, hub x and spokes, with the forces at the selected joint",
    draw(s) {
      const { pts, x, selected } = state, n = pts.length;
      const { F, balanced, spoke, rim, biggest } = solve();
      const thick = (f) => 1.5 + (7 * f) / biggest;
      s.poly(pts, { fill: s.color("fill-soft") });
      // rim bars: heavy when they carry a force, thin and dashed when they cannot balance the spokes
      pts.forEach((p, i) => s.line(p, pts[(i + 1) % n], balanced
        ? { stroke: s.color("ink"), width: thick(rim[i]) }
        : { stroke: s.color("ink-2"), width: 1.5, dash: [5, 4] }));
      // spokes: width shows the force; a dashed spoke would have to push (negative weight)
      pts.forEach((p, i) => s.line(x, p,
        { stroke: seriesColor(i), width: thick(spoke[i]), dash: F.weights[i] < 0 ? [6, 4] : undefined }));
      // forces at the selected joint, drawn as arrows
      const k = ARROW / biggest;
      const unit = (a, b) => { const d = [b[0] - a[0], b[1] - a[1]], l = Math.hypot(...d); return [d[0] / l, d[1] / l]; };
      if (selected === HUB) {
        pts.forEach((p, i) => arrow(s, x, [k * F.weights[i] * (p[0] - x[0]), k * F.weights[i] * (p[1] - x[1])], seriesColor(i)));
      } else {
        const i = selected, p = pts[i], im = mod(i - 1, n);
        arrow(s, p, [k * F.weights[i] * (x[0] - p[0]), k * F.weights[i] * (x[1] - p[1])], seriesColor(i));
        if (balanced) {
          // a bar in compression pushes its end joint away from the other end
          const a = unit(pts[(i + 1) % n], p), b = unit(pts[im], p);
          arrow(s, p, [k * rim[i] * a[0], k * rim[i] * a[1]], s.color("ink"));
          arrow(s, p, [k * rim[im] * b[0], k * rim[im] * b[1]], s.color("ink"));
        }
      }
      const c = centroid(pts);
      pts.forEach((p, i) => {
        s.knob(p, seriesColor(i), i === selected ? 8 : 6);
        const d = [p[0] - c[0], p[1] - c[1]], l = Math.hypot(...d);
        s.text(p, sub("p", i), { dx: (20 * d[0]) / l, dy: (-20 * d[1]) / l, size: 14, weight: i === selected ? 700 : 500 });
      });
      s.knob(x, s.color("ink"), selected === HUB ? 8 : 6);
      s.text(x, "x", { dx: 13, dy: -13, size: 14, weight: selected === HUB ? 700 : 500 });
    },
  });

  const diagram = new Stage(right, {
    view: { xmin: -1, xmax: 1, ymin: -1, ymax: 1 }, aspect: 0.86, maxHeight: 440,
    label: "Force diagram: the spoke forces turned by a right angle form a closed polygon",
    draw(s) {
      const { pts, selected } = state, n = pts.length;
      const { F, balanced, O } = solve();
      const { v, apex } = F;
      const normals = edgeLines(pts).map((l) => l.n);
      const R = 1.25 * Math.max(...v.map((q) => Math.hypot(q[0], q[1])), balanced ? Math.hypot(O[0], O[1]) : 0);
      s.setView({ xmin: -R, xmax: R, ymin: -R, ymax: R });
      if (balanced) {
        // one force triangle per vertex of the wheel; together they tile the force polygon
        for (let i = 0; i < n; i++) {
          const on = selected === HUB || i === selected;
          s.poly([O, v[mod(i - 1, n)], v[i]], { fill: withAlpha(seriesColor(i), on ? (selected === HUB ? 0.45 : 0.75) : 0.22),
            stroke: s.color("surface"), width: 2 });
        }
        v.forEach((q, i) => s.line(O, q, { stroke: s.color("ink"),
          width: selected !== HUB && (i === selected || i === mod(selected - 1, n)) ? 3.5 : 1.5 }));
      } else {
        // the lines that would carry the rim forces: through v_i, perpendicular to rim bar i
        s.poly(v, { fill: withAlpha(s.color("ink-2"), 0.08) });
        v.forEach((q, i) => s.fullLine({ n: [-normals[i][1], normals[i][0]], p: q },
          { stroke: s.color("ink-2"), width: 1.25, dash: [5, 4] }));
        apex.forEach((a) => {
          if (Math.hypot(a[0], a[1]) < 3 * R) s.dot(a, { r: 4.5, fill: s.color("surface"), stroke: s.color("ink"), width: 1.5 });
        });
      }
      for (let i = 0; i < n; i++) {
        s.line(v[mod(i - 1, n)], v[i], { stroke: seriesColor(i), width: selected === HUB || i === selected ? 4.5 : 2.5 });
      }
      v.forEach((q) => s.dot(q, { r: 3.5, fill: s.color("ink") }));
      if (balanced) {
        s.knob(O, s.color("ink"), 5);
        s.text(O, Math.hypot(O[0], O[1]) < 1e-9 * R ? "O = x" : "O", { dx: 12, dy: -12, size: 14, align: "left" });
      }
    },
  });
  // clicking near an edge of the force polygon selects the corresponding vertex
  diagram.onClick = (q) => {
    const { v } = solve().F, n = v.length;
    let best = 0, bestDist = Infinity;
    for (let i = 0; i < n; i++) {
      const a = v[mod(i - 1, n)], b = v[i], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const dist = Math.hypot(q[0] - m[0], q[1] - m[1]);
      if (dist < bestDist) { bestDist = dist; best = i; }
    }
    state.selected = best;
    update();
  };

  function update() {
    const { pts, selected, kind } = state, n = pts.length;
    const { F, r, balanced, spoke, rim } = solve();
    const total = F.weights.reduce((a, b) => a + b, 0);
    updateBars(F.weights.map((w) => w / total), selected);
    const name = KINDS.find((k) => k.value === kind).label.toLowerCase();
    let html;
    if (selected === HUB) {
      const res = pts.reduce((s, p, i) => [s[0] + F.weights[i] * (p[0] - state.x[0]), s[1] + F.weights[i] * (p[1] - state.x[1])], [0, 0]);
      html = `<p>Hub x: the ${n} spoke forces w<sub>k</sub> (p<sub>k</sub> − x) balance; ` +
        `the length of their sum is <b>${Math.hypot(...res) < 1e-9 ? "0.000" : fmt(Math.hypot(...res))}</b>. In the force diagram they form the closed polygon.</p>`;
    } else {
      const i = selected, im = mod(i - 1, n);
      html = `<p>Vertex p<sub>${i}</sub>: &nbsp; stress of its spoke w<sub>${i}</sub> = <b>${fmt(F.weights[i])}</b>, ` +
        `force w<sub>${i}</sub> · |p<sub>${i}</sub> − x| = <b>${fmt(spoke[i])}</b> ` +
        `(the length of the highlighted edge of the force polygon)`;
      html += balanced
        ? `<br>rim bars ${im} and ${i}: compression <b>${fmt(rim[im])}</b> and <b>${fmt(rim[i])}</b> ` +
          `(the two sides of the highlighted triangle that meet at O)</p>`
        : `</p>`;
    }
    html += balanced
      ? `<p>The lines through the corners of the force polygon, perpendicular to the rim bars, all pass through one point O. ` +
        `<b>The rim balances these spokes</b>; the wheel is in equilibrium on its own.</p>`
      : `<p>The dashed lines through the corners of the force polygon, perpendicular to the rim bars, do not meet in one point ` +
        `(the circles mark where neighbouring lines cross; largest gap <b>${fmt(F.spread)}</b> × the size of the polygon). ` +
        `<b>The rim cannot balance the ${name} spoke forces</b>: the vertices would need outside support.</p>`;
    readout.innerHTML = html;
    wheel.redraw();
    diagram.redraw();
  }

  attachPolygonHandles(wheel, state, { bounds: VIEW, onChange: update });
  // the hub can be selected as well: add a select action to its handle (the last one)
  const vertexHandles = wheel.handles;
  wheel.handles = () => {
    const list = vertexHandles();
    list[list.length - 1].select = () => { state.selected = HUB; update(); };
    return list;
  };

  const sides = choiceGroup("Number of vertices",
    [3, 4, 5, 6, 7].map((v) => ({ value: v, label: String(v) })), 5,
    (v) => {
      state.pts = defaultPolygon(v);
      state.x = [0.2, -0.1];
      if (state.selected >= v) state.selected = v - 1;
      update();
    });
  const kinds = choiceGroup("Spoke forces from", KINDS, state.kind, (v) => { state.kind = v; update(); });

  root.append(
    el("div", { class: "controls" }, sides.node, kinds.node),
    el("div", { class: "fig-pair" },
      el("div", {}, el("div", { class: "plot-title" }, "The wheel: rim bars, hub x and spokes"), left),
      el("div", {}, el("div", { class: "plot-title" }, "Force diagram: every force turned by a right angle"), right)),
    el("div", { class: "legend" },
      el("span", { class: "key" }, el("i", { style: "background:var(--series-1); height:5px" }),
        "spokes and their forces (tension), one colour per vertex"),
      el("span", { class: "key" }, el("i", { style: "background:var(--ink); height:5px" }),
        "rim bars and their forces (compression)"),
      el("span", { class: "key" }, "line width in the wheel = size of the force")),
    el("p", { class: "hint" },
      "Drag the vertices or the hub x. Click a vertex or the hub to see the forces acting on it."),
    side, readout);
  update();
}
