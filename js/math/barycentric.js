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
