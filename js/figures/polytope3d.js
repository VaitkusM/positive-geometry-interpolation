/**
 * polytope3d.js — Figure 6 (added illustration): the construction of Figure 5
 * one dimension up.
 *
 * Left:  a simple polyhedron P, the point x and the selected vertex with the
 *        three faces through it (they bound the "wedge", a cone).
 * Right: the polar dual of P about x. Each face of P is a dual vertex, each
 *        vertex of P a dual triangle; with the origin it spans a pyramid, and
 *        λ_v = volume of that pyramid / volume of the dual.
 * Both views share one orientation; drag either to rotate. Rendering is the
 * same simple painter's algorithm as in surface.js.
 */

import { Stage, seriesColor, withAlpha } from "../ui/stage.js";
import { el, fmt, sub, makeBars, choiceGroup, slider } from "../ui/widgets.js";
import {
  buildPolytope, wachspress3d, vertexWedges3d, polarDual3d, faceDistances, dot3, SOLIDS,
} from "../math/polytope3d.js";

const MARGIN = 0.07; // x stays at least this far from every face

export function initPolytope3d(root) {
  const state = { solid: "cube", raw: [0.3, -0.2, 0.25], selected: 0, az: 0.6, elev: 0.45 };
  let poly = buildPolytope(SOLIDS[state.solid]);

  /** The evaluation point: the slider values, pulled back into the solid if necessary. */
  function point() {
    let t = 1;
    for (const pl of poly.planes) {
      const along = dot3(pl.n, state.raw);
      if (along > pl.d - MARGIN) t = Math.min(t, (pl.d - MARGIN) / along);
    }
    return state.raw.map((c) => c * t);
  }

  /** Orthographic projection: {s: [X, Y] for the stage, depth: larger = nearer}. */
  function project(p) {
    const ca = Math.cos(state.az), sa = Math.sin(state.az);
    const ce = Math.cos(state.elev), se = Math.sin(state.elev);
    const xr = p[0] * ca - p[1] * sa, yr = p[0] * sa + p[1] * ca;
    return { s: [xr, yr * se + p[2] * ce], depth: -yr * ce + p[2] * se };
  }
  const meanDepth = (pts) => pts.reduce((a, p) => a + project(p).depth, 0) / pts.length;

  /** Index of the vertex closest to the viewer (a sensible vertex to select first). */
  const nearestVertex = () => poly.vertices.reduce(
    (best, v, i) => (project(v.p).depth > project(poly.vertices[best].p).depth ? i : best), 0);
  state.selected = nearestVertex();

  const left = el("div"), right = el("div"), side = el("div");
  const readout = el("div", { class: "readout", "aria-live": "polite" });
  const updateBars = makeBars(side);

  const primal = new Stage(left, {
    view: { xmin: -1.35, xmax: 1.35, ymin: -1.25, ymax: 1.25 }, aspect: 0.9, maxHeight: 420,
    label: "A polyhedron with an interior point x and a selected vertex",
    draw(s) {
      const x = point(), sel = poly.vertices[state.selected];
      const col = seriesColor(state.selected);
      // faces, far to near; the three faces through the selected vertex are tinted
      const faces = poly.faceLoops.map((loop, f) => ({ f, pts: loop.map((i) => poly.vertices[i].p) }))
        .sort((a, b) => meanDepth(a.pts) - meanDepth(b.pts));
      const xDepth = project(x).depth;
      let drewX = false;
      const drawX = () => {
        s.knob(project(x).s, s.color("ink"), 5);
        s.text(project(x).s, "x", { dx: 11, dy: -11, size: 14 });
        drewX = true;
      };
      for (const face of faces) {
        // x lies inside: draw it once all faces behind it are painted
        if (!drewX && meanDepth(face.pts) > xDepth) drawX();
        s.poly(face.pts.map((p) => project(p).s), {
          fill: sel.faces.includes(face.f) ? withAlpha(col, 0.32) : withAlpha(s.color("fill-soft"), 0.55),
          stroke: s.color("ink"), width: 1.25,
        });
      }
      if (!drewX) drawX();
      poly.vertices.forEach((v, i) => {
        const q = project(v.p).s;
        s.knob(q, seriesColor(i), i === state.selected ? 7 : 5);
        const l = Math.hypot(q[0], q[1]) || 1;
        s.text(q, sub("p", i), { dx: (16 * q[0]) / l, dy: (-16 * q[1]) / l, size: 13,
          weight: i === state.selected ? 700 : 500 });
      });
    },
  });
  // clicking a vertex selects it
  primal.handles = () => poly.vertices.map((v, i) => ({
    pos: () => project(v.p).s,
    select: () => { state.selected = i; update(); },
    drag: () => {},
  }));

  const dual = new Stage(right, {
    view: { xmin: -1, xmax: 1, ymin: -1, ymax: 1 }, aspect: 0.9, maxHeight: 420,
    label: "The polar dual polyhedron, split into one pyramid per vertex of the original",
    draw(s) {
      const d = polarDual3d(poly, point());
      const R = 1.2 * Math.max(...d.map((p) => Math.hypot(...p)));
      s.setView({ xmin: -R, xmax: R, ymin: -R, ymax: R });
      const o = project([0, 0, 0]);
      const tris = poly.vertices.map((v, i) => ({ i, pts: v.faces.map((f) => d[f]) }))
        .sort((a, b) => meanDepth(a.pts) - meanDepth(b.pts));
      let drewO = false;
      const drawO = () => {
        // the pyramid of the selected vertex: edges from the origin (= x) to its triangle
        for (const f of poly.vertices[state.selected].faces) {
          s.line(o.s, project(d[f]).s, { stroke: seriesColor(state.selected), width: 2, dash: [5, 4] });
        }
        s.knob(o.s, s.color("ink"), 5);
        s.text(o.s, "x", { dx: 11, dy: -11, size: 14 });
        drewO = true;
      };
      for (const t of tris) {
        if (!drewO && meanDepth(t.pts) > o.depth) drawO();
        s.poly(t.pts.map((p) => project(p).s), {
          fill: withAlpha(seriesColor(t.i), t.i === state.selected ? 0.8 : 0.3),
          stroke: s.color("ink"), width: 1,
        });
      }
      if (!drewO) drawO();
    },
  });

  // drag either view to rotate both
  for (const st of [primal, dual]) {
    const cv = st.canvas;
    cv.style.touchAction = "pan-y";
    let last = null;
    cv.addEventListener("pointerdown", (e) => { last = [e.clientX, e.clientY]; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener("pointermove", (e) => {
      if (!last) return;
      state.az += (e.clientX - last[0]) * 0.01;
      state.elev = Math.max(-1.4, Math.min(1.4, state.elev + (e.clientY - last[1]) * 0.01));
      last = [e.clientX, e.clientY];
      primal.redraw();
      dual.redraw();
    });
    const stop = () => { last = null; };
    cv.addEventListener("pointerup", stop);
    cv.addEventListener("pointercancel", stop);
  }

  function update() {
    const x = point(), i = state.selected;
    const w = vertexWedges3d(poly, x), lam = wachspress3d(poly, x);
    const C = w.reduce((a, b) => a + b, 0);
    const back = [0, 1, 2].map((k) => poly.vertices.reduce((acc, v, j) => acc + lam[j] * v.p[k], 0));
    const [a, b, c] = poly.vertices[i].faces;
    const h = faceDistances(poly, x);
    updateBars(lam, i);
    readout.innerHTML =
      `<p>Selected vertex p<sub>${i}</sub>: &nbsp; w<sub>${i}</sub> = |det(n<sub>a</sub>, n<sub>b</sub>, n<sub>c</sub>)| / ` +
      `(h<sub>a</sub> h<sub>b</sub> h<sub>c</sub>) = <b>${fmt(w[i])}</b> ` +
      `&nbsp;(distances to its three faces: ${fmt(h[a], 2)}, ${fmt(h[b], 2)}, ${fmt(h[c], 2)})` +
      `<br>whole solid: &nbsp; C<sub>P</sub> = Σ w<sub>k</sub> = <b>${fmt(C)}</b> = 3! × volume of the dual` +
      `<br>ratio: &nbsp; λ<sub>${i}</sub> = <b>${fmt(lam[i])}</b></p>` +
      `<p>Checks: &nbsp; Σ λ<sub>k</sub> = <b>${fmt(lam.reduce((p, q) => p + q, 0))}</b>, &nbsp; ` +
      `Σ λ<sub>k</sub> p<sub>k</sub> = <b>(${back.map((v) => fmt(v, 2)).join(", ")})</b> ` +
      `&nbsp;vs.&nbsp; x = (${x.map((v) => fmt(v, 2)).join(", ")})</p>`;
    primal.redraw();
    dual.redraw();
  }

  const solids = choiceGroup("Solid",
    [{ value: "tetrahedron", label: "Tetrahedron" }, { value: "cube", label: "Cube" },
     { value: "prism", label: "Triangular prism" }],
    state.solid, (v) => {
      state.solid = v;
      poly = buildPolytope(SOLIDS[v]);
      state.selected = nearestVertex();
      update();
    });
  const coord = (k, name) => slider(`x: ${name}`, { min: -0.75, max: 0.75, step: 0.01, value: state.raw[k] },
    (v) => fmt(v, 2), (v) => { state.raw[k] = v; update(); }).node;

  root.append(
    el("div", { class: "controls" }, solids.node),
    el("div", { class: "controls" }, coord(0, "first"), coord(1, "second"), coord(2, "third coordinate")),
    el("div", { class: "fig-pair" },
      el("div", {}, el("div", { class: "plot-title" }, "Polyhedron P, point x, selected vertex and its three faces"), left),
      el("div", {}, el("div", { class: "plot-title" }, "Polar dual P*ₓ: one pyramid per vertex of P"), right)),
    el("p", { class: "hint" }, "Drag either picture to rotate. Click a vertex of P to select it. " +
      "If the sliders would move x outside the solid, it stops just inside."),
    side, readout);
  update();
}
