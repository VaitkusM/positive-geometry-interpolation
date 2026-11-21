/**
 * barycentric.js — barycentric coordinates as ratios of canonical forms.
 *
 * The central construction of the paper (eqs. 4.11–4.13):
 *
 *     λ_i(x) = Ω( wedge at vertex i ) / Ω( whole shape )
 *
 * For a triangle this is ordinary barycentric interpolation, for a convex
 * polygon it gives Wachspress coordinates. The "classic" area formulas are
 * implemented as well so that the tests (and the applet) can show that both
 * routes give identical numbers.
 */

import { mod, triArea, edgeLines, lineDist } from "./polygon.js";
import { vertexWedges } from "./canonical.js";

/** Linear interpolation weights on [a, b]: returns [λ_a, λ_b]. */
export function segmentCoords(a, b, x) {
  // Shepard-like form (2.2): weights 1/(x−a) and 1/(b−x), then normalise.
  const wa = 1 / (x - a), wb = 1 / (b - x);
  return [wa / (wa + wb), wb / (wa + wb)];
}

/**
 * Wachspress coordinates of x in a convex CCW polygon, computed as ratios of
 * canonical functions: λ_i = w_i / Σ_k w_k with w_i the wedge function of
 * vertex i (see canonical.js). Valid for x strictly inside the polygon.
 */
export function wachspress(pts, x) {
  const w = vertexWedges(pts, x);
  let sum = 0;
  for (const v of w) sum += v;
  return w.map((v) => v / sum);
}

/**
 * Wachspress coordinates by the classic area formula (2.5):
 *     w_i = C_i / (A_{i−1} · A_i),
 * where C_i = area(p_{i−1}, p_i, p_{i+1}) and A_i = area(x, p_i, p_{i+1}).
 * Used only as an independent cross-check.
 */
export function wachspressClassic(pts, x) {
  const n = pts.length;
  const A = pts.map((p, i) => triArea(x, p, pts[(i + 1) % n]));
  const w = pts.map((p, i) =>
    triArea(pts[mod(i - 1, n)], p, pts[(i + 1) % n]) / (A[mod(i - 1, n)] * A[i]));
  let sum = 0;
  for (const v of w) sum += v;
  return w.map((v) => v / sum);
}

/**
 * Sub-triangle areas of a triangle: A_i is the area of the triangle formed by
 * x and the side OPPOSITE to vertex i (so λ_i = A_i / A). Returns {A, Ai:[…]}.
 */
export function triangleAreas(p0, p1, p2, x) {
  return {
    A: triArea(p0, p1, p2),
    Ai: [triArea(x, p1, p2), triArea(x, p2, p0), triArea(x, p0, p1)],
  };
}

/**
 * Polar dual polygon of P with respect to the point x (x plays the role of the
 * origin): each edge line h_i = 0 becomes the dual vertex
 *     d_i = n_i / h_i(x).
 * The dual vertices are in CCW order. The triangle (0, d_{i−1}, d_i) is dual
 * to the primal vertex i and has area w_i / 2, hence
 *     λ_i = area(0, d_{i−1}, d_i) / area(dual)      (Ju, Schaefer, Warren, Desbrun).
 */
export function polarDual(pts, x) {
  return edgeLines(pts).map((l) => {
    const h = lineDist(l, x);
    return [l.n[0] / h, l.n[1] / h];
  });
}

/** Weighted combination Σ λ_i v_i of points (or any equal-length arrays). */
export function combine(lambda, values) {
  const out = new Array(values[0].length).fill(0);
  lambda.forEach((l, i) => values[i].forEach((v, k) => (out[k] += l * v)));
  return out;
}

/* ------------------------------------------------------------------ */
/*  Mean value coordinates (for the comparison in Section 8.3)         */
/* ------------------------------------------------------------------ */

/**
 * Unnormalised mean value weights (Floater 2003) of x in a convex CCW polygon:
 *     w_i = ( tan(α_{i−1}/2) + tan(α_i/2) ) / |p_i − x|,
 * where α_i is the angle at x between p_i and p_{i+1}.
 *
 * Their sum equals the PERIMETER of the polar dual polygon about x, whereas
 * the Wachspress weights of canonical.js sum to twice its AREA. Reason: with
 * ρ(θ) the distance from x to the boundary in direction θ, the mean value sum
 * is ∫ dθ / ρ(θ); 1/ρ is the support function of the dual, and the integral of
 * a support function over all directions is the perimeter (Cauchy's formula).
 */
export function meanValueWeights(pts, x) {
  const n = pts.length;
  const d = pts.map((p) => [p[0] - x[0], p[1] - x[1]]);
  const r = d.map((v) => Math.hypot(v[0], v[1]));
  const t = d.map((v, i) => {
    const u = d[(i + 1) % n];
    const alpha = Math.atan2(v[0] * u[1] - v[1] * u[0], v[0] * u[0] + v[1] * u[1]);
    return Math.tan(alpha / 2);
  });
  return d.map((_, i) => (t[mod(i - 1, n)] + t[i]) / r[i]);
}

/** Mean value coordinates λ_i (normalised weights). */
export function meanValue(pts, x) {
  const w = meanValueWeights(pts, x);
  const sum = w.reduce((a, b) => a + b, 0);
  return w.map((v) => v / sum);
}

/* ------------------------------------------------------------------ */
/*  The wheel: force polygons of barycentric coordinates (Section 5)   */
/* ------------------------------------------------------------------ */

/**
 * Force polygon at the hub x for three kinds of barycentric coordinates.
 *
 * Join x to every vertex by a spoke pulling with the force w_i (p_i − x).
 * Turned by a right angle, these forces are the edges of a closed polygon
 * (that it closes is linear precision). With r_i = |p_i − x| and u_i the unit
 * vector from x to p_i, edge i lies on the line  y · u_i = −ρ_i  (beyond x as
 * seen from p_i; the same orientation as polarDual above, which uses inward
 * normals), where
 *
 *     kind "wachspress":  ρ_i = 1 / r_i   (the polar dual of the polygon)
 *     kind "meanvalue":   ρ_i = 1         (circumscribed about the unit circle)
 *     kind "harmonic":    ρ_i = r_i / 2   (perpendicular bisectors of the spokes)
 *
 * and  w_i = (signed length of edge i) / r_i.
 *
 * The polygon is the force diagram of the whole wheel (rim bars included)
 * exactly when the lines through its vertices v_i perpendicular to the rim
 * bars i pass through one point O; then |O − v_i| is the force in rim bar i.
 * The force triangle of vertex i has its third corner at
 *     apex_i = (line through v_{i−1} along n_{i−1}) ∩ (line through v_i along n_i),
 * so the test is whether all apexes coincide. This happens for the Wachspress
 * weights (O = x), and for any weights on a triangle.
 *
 * @returns {{ v:number[][], weights:number[], apex:number[][], spread:number }}
 *   v[i]     vertex between edge i and edge i+1 (coordinates relative to x)
 *   weights  the unnormalised weights w_i
 *   apex[i]  third corner of the force triangle of vertex i
 *   spread   largest distance between two apexes, relative to the polygon's size
 */
export function forcePolygon(pts, x, kind = "wachspress") {
  const n = pts.length;
  const r = pts.map((p) => Math.hypot(p[0] - x[0], p[1] - x[1]));
  const u = pts.map((p, i) => [(p[0] - x[0]) / r[i], (p[1] - x[1]) / r[i]]);
  const rho = r.map((ri) => (kind === "wachspress" ? 1 / ri : kind === "meanvalue" ? 1 : ri / 2));
  // v_i: intersection of the edge lines i and i+1 (Cramer's rule)
  // (computed first for the lines y · u_i = +ρ_i, where the signed edge lengths are simplest)
  const v = u.map((a, i) => {
    const j = (i + 1) % n, b = u[j], d = a[0] * b[1] - a[1] * b[0];
    return [(rho[i] * b[1] - rho[j] * a[1]) / d, (a[0] * rho[j] - b[0] * rho[i]) / d];
  });
  const weights = u.map((a, i) => {
    const prev = v[mod(i - 1, n)];
    return ((v[i][0] - prev[0]) * -a[1] + (v[i][1] - prev[1]) * a[0]) / r[i];
  });
  // reflect in x, so that for Wachspress weights v_i is polarDual's d_i = n_i / h_i
  v.forEach((q) => { q[0] = -q[0]; q[1] = -q[1]; });
  const normals = edgeLines(pts).map((l) => l.n);
  const apex = v.map((q, i) => {
    const j = mod(i - 1, n), p = v[j], a = normals[j], b = normals[i];
    const d = a[0] * b[1] - a[1] * b[0];
    const s = ((q[0] - p[0]) * b[1] - (q[1] - p[1]) * b[0]) / d;   // p + s a = q + t b
    return [p[0] + s * a[0], p[1] + s * a[1]];
  });
  const size = Math.max(...v.map((q) => Math.hypot(q[0], q[1])));
  let spread = 0;
  for (let i = 0; i < n; i++) for (let k = i + 1; k < n; k++) {
    spread = Math.max(spread, Math.hypot(apex[i][0] - apex[k][0], apex[i][1] - apex[k][1]) / size);
  }
  return { v, weights, apex, spread };
}
