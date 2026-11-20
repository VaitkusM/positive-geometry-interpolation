/**
 * common.js — pieces shared by several figures.
 */

import { regularPolygon, isConvexCCW, clampIntoConvex } from "../math/polygon.js";

/**
 * A pleasant, deliberately irregular convex n-gon (n = 3 … 8), roughly of
 * radius 1 around the origin. Irregular so that no two edge lines are parallel
 * (which keeps the adjoint figure generic).
 */
export function defaultPolygon(n) {
  return regularPolygon(n, 1, Math.PI / 2 + 0.2).map(([x, y], i) => {
    const r = 1 + 0.16 * Math.sin(2.3 * i + 0.7);
    return [x * r, y * r];
  });
}

/**
 * Make the vertices of `state.pts` (and optionally the point `state.x`)
 * draggable on a stage, keeping the polygon strictly convex and inside
 * `bounds`, and keeping x inside the polygon.
 *
 * @param {Stage} stage
 * @param {{pts:number[][], x?:number[], selected?:number}} state  mutated in place
 * @param {object} o
 * @param {{xmin,xmax,ymin,ymax}} o.bounds  vertices may not leave this box
 * @param {() => void} o.onChange           called after every accepted change
 * @param {number} [o.margin=0.03]          minimum distance of x from the boundary
 */
export function attachPolygonHandles(stage, state, o) {
  const margin = o.margin ?? 0.03;
  // keep vertices a little inside the box so that their knobs stay fully visible
  const mx = 0.04 * (o.bounds.xmax - o.bounds.xmin), my = 0.04 * (o.bounds.ymax - o.bounds.ymin);
  const inBounds = (p) => p[0] >= o.bounds.xmin + mx && p[0] <= o.bounds.xmax - mx &&
    p[1] >= o.bounds.ymin + my && p[1] <= o.bounds.ymax - my;

  stage.handles = () => {
    const list = state.pts.map((_, i) => ({
      pos: () => state.pts[i],
      select: () => { if ("selected" in state) { state.selected = i; o.onChange(); } },
      drag: (q) => {
        const trial = state.pts.map((p, k) => (k === i ? q : p));
        // reject moves that would make the polygon (nearly) non-convex
        if (!inBounds(q) || !isConvexCCW(trial, 0.06, 0.25)) return;
        state.pts = trial;
        if (state.x) state.x = clampIntoConvex(state.pts, state.x, margin);
        o.onChange();
      },
    }));
    if (state.x) {
      list.push({
        pos: () => state.x,
        drag: (q) => { state.x = clampIntoConvex(state.pts, q, margin); o.onChange(); },
      });
    }
    return list;
  };
}
