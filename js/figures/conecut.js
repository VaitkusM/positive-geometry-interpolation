/**
 * conecut.js — Figure 12b (added remark): the cone behind the dual polygon.
 *
 * The edge normals of a polygon, written as vectors a_i = (−n_i·p_i, n_i) in
 * three dimensions (math/splines.js), span a cone C that does NOT depend on
 * the evaluation point x. The point x only chooses a cutting plane
 *     ⟨(1, x), v⟩ = 1,
 * and the cut is the dual polygon P*_x. The Laplace transform of the indicator
 * function of C at (1, x) is 3! times the volume of the pyramid between the
 * apex and the cutting plane, which is the canonical function C_P(x).
 *
 * Left:  the polygon and the point x (draggable).
 * Right: the cone, its rays a_i and the cutting plane, in a 3D view that can
 *        be rotated by dragging. The first coordinate of R^3 points upwards.
 */

import { Stage, seriesColor, withAlpha } from "../ui/stage.js";
import { el, fmt, sub, choiceGroup } from "../ui/widgets.js";
import { centroid, edgeLines, lineDist } from "../math/polygon.js";
import { polygonCanonical } from "../math/canonical.js";
import { facetVectors, det3 } from "../math/splines.js";
import { defaultPolygon, attachPolygonHandles } from "./common.js";

const VIEW = { xmin: -1.75, xmax: 1.75, ymin: -1.5, ymax: 1.5 };

export function initConeCut(root) {
  const state = { pts: defaultPolygon(5), x: [0.2, -0.1], az: 0.7, elev: 0.35 };
  const left = el("div"), right = el("div");
  const readout = el("div", { class: "readout", "aria-live": "polite" });

  /** The cone data: rays, their intersections s_i with the cutting plane, pyramid volume. */
  function solve() {
    const { pts, x } = state, n = pts.length;
    const X = facetVectors(pts), h = edgeLines(pts).map((l) => lineDist(l, x));
    const cut = X.map((a, i) => a.map((c) => c / h[i]));           // ⟨(1,x), s_i⟩ = 1
    let volume = 0;
    for (let i = 1; i < n - 1; i++) volume += Math.abs(det3(cut[0], cut[i], cut[i + 1])) / 6;
    return { X, cut, volume };
  }

  /** Orthographic projection; the first coordinate of R^3 is drawn upwards. */
  function project(v) {
    const ca = Math.cos(state.az), sa = Math.sin(state.az);
    const ce = Math.cos(state.elev), se = Math.sin(state.elev);
    const xr = v[1] * ca - v[2] * sa, yr = v[1] * sa + v[2] * ca;
    return { s: [xr, yr * se + v[0] * ce], depth: -yr * ce + v[0] * se };
  }

  const primal = new Stage(left, {
    view: VIEW, aspect: 0.86, maxHeight: 420,
    label: "Convex polygon with draggable vertices and evaluation point x",
    draw(s) {
      const { pts, x } = state, n = pts.length, c = centroid(pts);
      s.poly(pts, { fill: s.color("fill-soft") });
      pts.forEach((p, i) => s.line(p, pts[(i + 1) % n], { stroke: seriesColor(i), width: 3 }));
      pts.forEach((p, k) => {
        s.knob(p, s.color("ink"), 6);
        const d = [p[0] - c[0], p[1] - c[1]], l = Math.hypot(...d);
        s.text(p, sub("p", k), { dx: (18 * d[0]) / l, dy: (-18 * d[1]) / l, size: 14 });
      });
      s.knob(x, s.color("ink"), 6);
      s.text(x, "x", { dx: 12, dy: -12, size: 14 });
    },
  });

  const space = new Stage(right, {
    view: { xmin: -1, xmax: 1, ymin: -1, ymax: 1 }, aspect: 0.86, maxHeight: 420,
    label: "The cone spanned by the edge normals, cut by the plane that belongs to the point x",
    draw(s) {
      const { X, cut } = solve(), n = X.length;
      // rays of a common length, a little longer than the farthest corner of the cut
      const L = 1.3 * Math.max(...cut.map((p) => Math.hypot(...p)));
      const ends = X.map((a) => a.map((c) => (c * L) / Math.hypot(...a)));
      // centre the picture on the middle of the cone
      const mid = ends.reduce((m, p) => m.map((c, k) => c + p[k] / (2 * n)), [0, 0, 0]);
      const P = (v) => { const q = project(v.map((c, k) => c - mid[k])); return q; };
      s.setView({ xmin: -0.75 * L, xmax: 0.75 * L, ymin: -0.75 * L, ymax: 0.75 * L });
      const depthOf = (list) => list.reduce((a, p) => a + P(p).depth, 0) / list.length;
      // the side faces of the cone (up to the ray ends) and the cut, painted far to near
      const faces = X.map((_, i) => ({ kind: "side", i, pts: [[0, 0, 0], ends[i], ends[(i + 1) % n]] }));
      faces.push({ kind: "cut", pts: cut });
      faces.sort((a, b) => depthOf(a.pts) - depthOf(b.pts));
      for (const f of faces) {
        const flat = f.pts.map((p) => P(p).s);
        if (f.kind === "side") s.poly(flat, { fill: withAlpha(s.color("ink-2"), 0.1), stroke: withAlpha(s.color("ink-2"), 0.35), width: 1 });
        else s.poly(flat, { fill: withAlpha(seriesColor(0), 0.55), stroke: s.color("ink"), width: 2 });
      }
      // the rays, coloured like the edges of the polygon they come from
      X.forEach((_, i) => {
        s.line(P([0, 0, 0]).s, P(ends[i]).s, { stroke: seriesColor(i), width: 2 });
        s.dot(P(cut[i]).s, { r: 4, fill: seriesColor(i), stroke: s.color("surface"), width: 1.5 });
        const e = P(ends[i]).s, o = P([0, 0, 0]).s, d = [e[0] - o[0], e[1] - o[1]], l = Math.hypot(...d) || 1;
        s.text(e, sub("a", i), { dx: (13 * d[0]) / l, dy: (-13 * d[1]) / l, size: 12 });
      });
      // the normal direction (1, x) of the cutting plane, from the apex to the plane
      const u = [1, state.x[0], state.x[1]], uu = u[0] * u[0] + u[1] * u[1] + u[2] * u[2];
      const foot = u.map((c) => c / uu);
      s.line(P([0, 0, 0]).s, P(foot).s, { stroke: s.color("ink"), width: 1.5, dash: [4, 3] });
      s.dot(P(foot).s, { r: 3, fill: s.color("ink") });
      s.text(P(foot).s, "x", { dx: 10, dy: -10, size: 13 });
      s.knob(P([0, 0, 0]).s, s.color("ink"), 4);
      s.text(P([0, 0, 0]).s, "apex", { dy: 14, size: 12, color: s.color("ink-2") });
    },
  });

  // drag the 3D view to rotate it
  {
    const cv = space.canvas;
    cv.style.touchAction = "pan-y";
    cv.style.cursor = "grab";
    let last = null;
    cv.addEventListener("pointerdown", (e) => { last = [e.clientX, e.clientY]; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener("pointermove", (e) => {
      if (!last) return;
      state.az += (e.clientX - last[0]) * 0.01;
      state.elev = Math.max(-1.4, Math.min(1.4, state.elev + (e.clientY - last[1]) * 0.01));
      last = [e.clientX, e.clientY];
      space.redraw();
    });
    const stop = () => { last = null; };
    cv.addEventListener("pointerup", stop);
    cv.addEventListener("pointercancel", stop);
  }

  function update() {
    const { volume } = solve();
    readout.innerHTML =
      `<p>3! × volume of the pyramid between the apex and the cutting plane = <b>${fmt(6 * volume)}</b>` +
      `<br>canonical function C<sub>P</sub>(x) = <b>${fmt(polygonCanonical(state.pts, state.x))}</b></p>` +
      `<p>Moving x tilts the cutting plane; the cone and its rays stay where they are. ` +
      `Moving a vertex of the polygon moves two rays.</p>`;
    primal.redraw();
    space.redraw();
  }

  attachPolygonHandles(primal, state, { bounds: VIEW, onChange: update });
  const sides = choiceGroup("Number of sides",
    [3, 4, 5, 6].map((v) => ({ value: v, label: String(v) })), 5,
    (v) => { state.pts = defaultPolygon(v); state.x = [0.2, -0.1]; update(); });

  root.append(el("div", { class: "controls" }, sides.node),
    el("div", { class: "fig-pair" },
      el("div", {}, el("div", { class: "plot-title" }, "Polygon P: one colour per edge"), left),
      el("div", {}, el("div", { class: "plot-title" }, "The cone of the edge normals and the cut that belongs to x"), right)),
    el("p", { class: "hint" }, "Drag the vertices or the point x on the left. Drag the picture on the right to rotate it."),
    readout);
  update();
}
