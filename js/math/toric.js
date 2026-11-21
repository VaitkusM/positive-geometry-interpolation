/**
 * toric.js — the toric and symplectic readings of Section 8.2.
 *
 * 1. Fibre polytopes (Duistermaat–Heckman). The torus T³ acts on Cⁿ with the
 *    weights a_0 … a_{n−1} ∈ R³ (the vectors of splines.js). Its moment map is
 *    z ↦ Σ ½|z_i|² a_i, and the reduced space over a point v of the cone is a
 *    toric variety of complex dimension n − 3 whose moment polytope is
 *        Π(v) = { t ∈ Rⁿ : t_i ≥ 0, Σ t_i a_i = v }.
 *    The multivariate spline is its volume:  T_X(v) = Vol Π(v) / √det(A Aᵀ)
 *    (De Concini & Procesi, Theorem 7.3).
 *
 * 2. Volume minimisation (Martelli, Sparks & Yau). For a polygon P with
 *    vertices p_a, the cone over P is the fan of an affine toric threefold; the
 *    volume of its link with Reeb vector b = 3·(1, x) is
 *        vol = (π³ / b_1) Σ_a (v_{a−1}, v_a, v_{a+1}) / ((b, v_{a−1}, v_a)(b, v_a, v_{a+1})),
 *    v_a = (1, p_a), which equals (π³ / 27) · C_P(x). Its unique minimiser over
 *    x ∈ P (the "Reeb point") is the Santaló point of P.
 */

import { centroid, pointInConvex } from "./polygon.js";
import { polygonCanonical } from "./canonical.js";

const d3 = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
const det3 = (a, b, c) =>
  a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);

/** Solve the 3×3 system G y = r (G given by rows) by Cramer's rule. */
function solve3(G, r) {
  const D = det3(G[0], G[1], G[2]);
  const col = (k) => G.map((row, i) => row.map((c, j) => (j === k ? r[i] : c)));
  return [0, 1, 2].map((k) => det3(...col(k)) / D);
}

/**
 * The fibre polytope Π(v) for n = 4 (a segment) or n = 5 (a polygon), in
 * orthonormal coordinates of the kernel of A = [a_0 … a_{n−1}].
 *
 * @returns {{ dim, points, facets, volume, gram, spline }}
 *   points   corners of Π(v) in kernel coordinates (numbers for dim 1, [x, y] for dim 2)
 *   facets   for dim 2: facets[k] = index i of the constraint t_i = 0 on the edge
 *            from points[k] to points[k+1]; for dim 1: the two indices at the ends
 *   volume   length or area of Π(v);  gram = √det(A Aᵀ);  spline = volume / gram
 */
export function fibrePolytope(X, v) {
  const n = X.length, dim = n - 3;
  if (dim !== 1 && dim !== 2) throw new Error("fibrePolytope: four or five vectors expected");
  const G = [0, 1, 2].map((r) => [0, 1, 2].map((c) => X.reduce((s, a) => s + a[r] * a[c], 0)));
  const gram = Math.sqrt(det3(G[0], G[1], G[2]));
  // particular solution t0 = Aᵀ G⁻¹ v, and an orthonormal basis of the kernel by Gram–Schmidt
  const y = solve3(G, v), t0 = X.map((a) => d3(a, y));
  const basis = [];
  for (let j = 0; j < n && basis.length < dim; j++) {
    const g = solve3(G, X[j]);
    let k = X.map((a, i) => (i === j ? 1 : 0) - d3(a, g));        // projection of e_j onto the kernel
    for (const b of basis) { const c = k.reduce((s, ki, i) => s + ki * b[i], 0); k = k.map((ki, i) => ki - c * b[i]); }
    const len = Math.hypot(...k);
    if (len > 1e-8) basis.push(k.map((ki) => ki / len));
  }
  if (dim === 1) {
    // t = t0 + s·k ≥ 0 gives an interval for s
    const k = basis[0];
    let lo = -Infinity, hi = Infinity, iLo = -1, iHi = -1;
    k.forEach((ki, i) => {
      if (Math.abs(ki) < 1e-12) return;
      const s = -t0[i] / ki;
      if (ki > 0 && s > lo) { lo = s; iLo = i; }
      if (ki < 0 && s < hi) { hi = s; iHi = i; }
    });
    const volume = Math.max(0, hi - lo);
    return { dim, points: volume > 0 ? [lo, hi] : [], facets: [iLo, iHi], volume, gram, spline: volume / gram };
  }
  // dim 2: clip a large square by the n half planes  k_i · s + t0_i ≥ 0
  const B = 1e4 * (1 + Math.max(...t0.map(Math.abs)));
  let poly = [[-B, -B], [B, -B], [B, B], [-B, B]].map((p) => ({ p, label: -1 }));
  for (let i = 0; i < n && poly.length; i++) {
    const ki = [basis[0][i], basis[1][i]], value = (p) => ki[0] * p[0] + ki[1] * p[1] + t0[i];
    const next = [];
    poly.forEach((cur, idx) => {
      const nxt = poly[(idx + 1) % poly.length], a = value(cur.p), b = value(nxt.p);
      if (a >= 0) next.push(cur);
      if ((a >= 0) !== (b >= 0)) {
        const t = a / (a - b), cut = [cur.p[0] + t * (nxt.p[0] - cur.p[0]), cur.p[1] + t * (nxt.p[1] - cur.p[1])];
        // leaving the half plane: the new edge runs along constraint i; entering: the old edge continues
        next.push({ p: cut, label: a >= 0 ? i : cur.label });
      }
    });
    poly = next;
  }
  let area = 0;
  poly.forEach((cur, idx) => { const q = poly[(idx + 1) % poly.length].p; area += cur.p[0] * q[1] - cur.p[1] * q[0]; });
  const volume = Math.abs(area) / 2;
  return { dim, points: poly.map((e) => e.p), facets: poly.map((e) => e.label), volume, gram, spline: volume / gram };
}

/** Volume of the link over π³, by formula (3.26) of Martelli–Sparks–Yau with b = 3·(1, x). */
export function linkVolume(pts, x) {
  const n = pts.length, b = [3, 3 * x[0], 3 * x[1]], v = pts.map((p) => [1, p[0], p[1]]);
  let sum = 0;
  for (let a = 0; a < n; a++) {
    const prev = v[(a + n - 1) % n], next = v[(a + 1) % n];
    sum += det3(prev, v[a], next) / (det3(b, prev, v[a]) * det3(b, v[a], next));
  }
  return sum / b[0];
}

/**
 * The point of a convex polygon where its canonical function is smallest
 * (the Santaló point; the "Reeb point" of volume minimisation). The function
 * is strictly convex and infinite on the boundary, so Newton's method with
 * step halving, started at the centroid, converges.
 * @returns {{ x:number[], value:number }}
 */
export function canonicalMinimum(pts) {
  const f = (q) => (pointInConvex(pts, q, 1e-9) ? Math.log(polygonCanonical(pts, q)) : Infinity);
  let x = centroid(pts);
  const size = Math.max(...pts.map((p) => Math.hypot(p[0] - x[0], p[1] - x[1]))), h = 1e-4 * size;
  for (let iter = 0; iter < 60; iter++) {
    const f0 = f(x), at = (dx, dy) => f([x[0] + dx, x[1] + dy]);
    const gx = (at(h, 0) - at(-h, 0)) / (2 * h), gy = (at(0, h) - at(0, -h)) / (2 * h);
    const hxx = (at(h, 0) - 2 * f0 + at(-h, 0)) / (h * h), hyy = (at(0, h) - 2 * f0 + at(0, -h)) / (h * h);
    const hxy = (at(h, h) - at(h, -h) - at(-h, h) + at(-h, -h)) / (4 * h * h);
    const D = hxx * hyy - hxy * hxy;
    let step = D > 0 && hxx > 0 ? [-(hyy * gx - hxy * gy) / D, -(hxx * gy - hxy * gx) / D] : [-gx * h, -gy * h];
    let moved = false;
    for (let k = 0; k < 40; k++) {
      const trial = [x[0] + step[0], x[1] + step[1]];
      if (f(trial) <= f0) { x = trial; moved = true; break; }
      step = [step[0] / 2, step[1] / 2];
    }
    if (!moved || Math.hypot(step[0], step[1]) < 1e-13 * size) break;
  }
  return { x, value: polygonCanonical(pts, x) };
}

/** Toric diagrams used in the text and in Figure 12g (all counter-clockwise). */
export const TORIC_DIAGRAMS = {
  c3: { name: "C³", pts: [[0, 0], [1, 0], [0, 1]] },
  c3z3: { name: "C³/Z₃ (cone over P²)", pts: [[1, 0], [0, 1], [-1, -1]] },
  conifold: { name: "Conifold", pts: [[0, 0], [1, 0], [1, 1], [0, 1]] },
  dp1: { name: "dP₁", pts: [[1, 0], [0, 1], [-1, 0], [-1, -1]] },
  dp2: { name: "dP₂", pts: [[0, 0], [1, 0], [2, 1], [1, 2], [0, 1]] },
  dp3: { name: "dP₃", pts: [[1, 0], [1, 1], [0, 1], [-1, 0], [-1, -1], [0, -1]] },
};
