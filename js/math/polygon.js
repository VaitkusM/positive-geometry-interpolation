/**
 * polygon.js — elementary planar geometry for convex polygons.
 *
 * Conventions used by EVERY module in this project
 * ------------------------------------------------
 *  - A point / vector is a plain array [x, y].
 *  - A polygon is an array of points p_0 … p_{n-1} in COUNTER-CLOCKWISE order.
 *  - Edge i joins p_i to p_{i+1} (indices are cyclic, i.e. taken modulo n).
 *  - Hence vertex i sits between edge i-1 and edge i.
 *  - The line carrying edge i is stored as { n, p } where n is the UNIT normal
 *    pointing into the polygon and p is a point on the line. Its signed
 *    distance function
 *        h_i(x) = n · (x − p)
 *    is positive inside the polygon and vanishes on the edge line.
 *
 * These modules are pure (no DOM access), so they can be unit-tested with
 * `deno test tests/` and reused by other tools.
 */

/** 2×2 determinant det(u, v) = u_x v_y − u_y v_x (signed parallelogram area). */
export const det2 = (u, v) => u[0] * v[1] - u[1] * v[0];

export const sub = (u, v) => [u[0] - v[0], u[1] - v[1]];
export const add = (u, v) => [u[0] + v[0], u[1] + v[1]];
export const scale = (u, s) => [u[0] * s, u[1] * s];
export const dot = (u, v) => u[0] * v[0] + u[1] * v[1];
export const norm = (u) => Math.hypot(u[0], u[1]);
export const lerp = (u, v, t) => [u[0] + (v[0] - u[0]) * t, u[1] + (v[1] - u[1]) * t];
export const dist = (u, v) => Math.hypot(u[0] - v[0], u[1] - v[1]);

/** Cyclic index helper: mod(-1, n) === n-1. */
export const mod = (i, n) => ((i % n) + n) % n;

/** Signed area of the triangle (a, b, c); positive when a→b→c turns left. */
export const triArea = (a, b, c) => 0.5 * det2(sub(b, a), sub(c, a));

/** Signed area of a polygon (shoelace formula); positive for CCW order. */
export function signedArea(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) s += det2(pts[i], pts[(i + 1) % pts.length]);
  return 0.5 * s;
}

/** Area centroid of a polygon. */
export function centroid(pts) {
  let cx = 0, cy = 0, a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    const w = det2(p, q);
    cx += (p[0] + q[0]) * w;
    cy += (p[1] + q[1]) * w;
    a += w;
  }
  return [cx / (3 * a), cy / (3 * a)];
}

/**
 * True when the polygon is strictly convex and counter-clockwise.
 * `minTurn` rejects nearly-degenerate corners: every corner must satisfy
 * sin(turning angle) > minTurn, and every edge must be longer than `minEdge`.
 */
export function isConvexCCW(pts, minTurn = 1e-9, minEdge = 1e-9) {
  const n = pts.length;
  if (n < 3) return false;
  for (let i = 0; i < n; i++) {
    const a = pts[mod(i - 1, n)], b = pts[i], c = pts[(i + 1) % n];
    const e1 = sub(b, a), e2 = sub(c, b);
    const l1 = norm(e1), l2 = norm(e2);
    if (l1 <= minEdge || l2 <= minEdge) return false;
    if (det2(e1, e2) / (l1 * l2) <= minTurn) return false;
  }
  return true;
}

/**
 * The lines carrying the edges: lines[i] = { n, p } for edge i (p_i → p_{i+1}),
 * with n the unit normal pointing to the LEFT of the edge direction, which is
 * the inside of a CCW polygon.
 */
export function edgeLines(pts) {
  const n = pts.length;
  const lines = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    const d = sub(q, p);
    const len = norm(d);
    lines.push({ n: [-d[1] / len, d[0] / len], p });
  }
  return lines;
}

/** Signed distance h(x) = n·(x − p) from the point x to a line {n, p}. */
export const lineDist = (line, x) => dot(line.n, sub(x, line.p));

/** Intersection point of two lines {n, p}; returns null if (nearly) parallel. */
export function lineIntersection(l1, l2) {
  const d = det2(l1.n, l2.n);
  if (Math.abs(d) < 1e-12) return null;
  const c1 = dot(l1.n, l1.p), c2 = dot(l2.n, l2.p);
  // Solve n1·x = c1, n2·x = c2 by Cramer's rule.
  return [(c1 * l2.n[1] - c2 * l1.n[1]) / d, (l1.n[0] * c2 - l2.n[0] * c1) / d];
}

/** True when x lies strictly inside the convex CCW polygon (margin ≥ 0). */
export function pointInConvex(pts, x, margin = 0) {
  return edgeLines(pts).every((l) => lineDist(l, x) > margin);
}

/**
 * Pull a point into the polygon: if x is not at least `margin` inside, move it
 * along the segment towards the centroid until it is (bisection search).
 */
export function clampIntoConvex(pts, x, margin = 1e-3) {
  if (pointInConvex(pts, x, margin)) return x;
  const c = centroid(pts);
  let lo = 0, hi = 1; // t = 0 → x (outside), t = 1 → centroid (inside)
  for (let k = 0; k < 40; k++) {
    const t = 0.5 * (lo + hi);
    if (pointInConvex(pts, lerp(x, c, t), margin)) hi = t; else lo = t;
  }
  return lerp(x, c, hi);
}

/** Regular n-gon with circumradius r, first vertex at angle `phase` (radians). */
export function regularPolygon(n, r = 1, phase = Math.PI / 2, center = [0, 0]) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = phase + (2 * Math.PI * i) / n;
    pts.push([center[0] + r * Math.cos(t), center[1] + r * Math.sin(t)]);
  }
  return pts;
}
