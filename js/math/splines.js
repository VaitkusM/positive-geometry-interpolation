/**
 * splines.js — the spline side of the dual-volume picture (Section 8.2).
 *
 * Setting (De Concini & Procesi, "Topics in Hyperplane Arrangements, Polytopes
 * and Box-Splines", Chapter 7). For a list X = (a_1, …, a_m) of vectors in R^s
 * that lie in an open half space, the MULTIVARIATE SPLINE (or truncated power)
 * T_X is the density of the image of Lebesgue measure on the positive orthant
 * of R^m under  t ↦ Σ t_i a_i.  It is supported on the cone C(X) spanned by X,
 * piecewise polynomial and homogeneous of degree m − s, and
 *
 *     Laplace transform:  ∫ e^{−⟨u,v⟩} T_X(v) dv = 1 / Π_i ⟨u, a_i⟩     (Thm 7.6)
 *     derivative:         D_a T_X = T_{X∖a}                              (Prop 7.14)
 *     recursion:          (m − s) T_X(v) = Σ t_i T_{X∖a_i}(v)  if v = Σ t_i a_i   (Thm 7.25)
 *     basis case m = s:   T_X = indicator of C(X) / |det X|              (Prop 7.15)
 *
 * Link with canonical forms. For a convex polygon P (conventions of
 * polygon.js) put  a_i = (−n_i·p_i, n_i) ∈ R^3,  so that ⟨a_i, (1, x)⟩ = h_i(x).
 * The cone C(X) is the dual cone of the cone over P, and with u = (1, x):
 *
 *     C_P(x)        = Laplace transform of the INDICATOR of C(X)
 *     1 / Π h_i(x)  = Laplace transform of the SPLINE T_X
 *     adj_P(∂) T_X  = indicator of C(X)       (adjoint as a differential operator)
 *
 * Slicing the cone by the plane ⟨(1, x), v⟩ = 1 gives the polar dual polygon
 * P*_x of barycentric.js (v = (1 − x·w, w), w ∈ P*_x), on which
 *
 *     C_P(x) = 2 · Area(P*_x),      1 / Π h_i(x) = (n − 1)! · ∫_{P*_x} T_X(1 − x·w, w) dw.
 */

import { edgeLines, dot } from "./polygon.js";

/** 3×3 determinant of the rows a, b, c. */
export const det3 = (a, b, c) =>
  a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);

/** The vectors a_i = (−n_i·p_i, n_i) of a convex CCW polygon: ⟨a_i, (1, x)⟩ = h_i(x). */
export function facetVectors(pts) {
  return edgeLines(pts).map((l) => [-dot(l.n, l.p), l.n[0], l.n[1]]);
}

/**
 * The multivariate spline T_X(v) for a list X of m ≥ 3 vectors in R^3 (any
 * three of them linearly independent), by Micchelli's recursion. v is written
 * in terms of the first three vectors of the current list; the recursion ends
 * with three vectors, where T is the indicator of their cone over |det|.
 */
export function coneSpline(X, v) {
  const [a, b, c] = X, D = det3(a, b, c);
  // coordinates of v in the basis (a, b, c), by Cramer's rule
  const t = [det3(v, b, c) / D, det3(a, v, c) / D, det3(a, b, v) / D];
  if (X.length === 3) return t[0] >= 0 && t[1] >= 0 && t[2] >= 0 ? 1 / Math.abs(D) : 0;
  let sum = 0;
  for (let i = 0; i < 3; i++) {
    if (t[i] !== 0) sum += t[i] * coneSpline(X.filter((_, k) => k !== i), v);
  }
  return sum / (X.length - 3);
}

/**
 * The spline restricted to the polar dual polygon about x:
 *     τ_x(w) = T_X(1 − x·w, w),   w ∈ P*_x   (zero outside).
 */
export function dualSplineDensity(pts, x, w) {
  return coneSpline(facetVectors(pts), [1 - dot(x, w), w[0], w[1]]);
}

/**
 * The adjoint as a homogeneous polynomial of degree n − 3 in u ∈ R^3, from the
 * fan triangulation of C(X) at a_0 (Warren's definition):
 *     adj(u) = Σ_{i=1}^{n−2} |det(a_0, a_i, a_{i+1})| · Π_{k ∉ {0, i, i+1}} ⟨u, a_k⟩,
 * so that adj(1, x) = adj_P(x) of canonical.js and adj / Π⟨u, a_k⟩ is the
 * Laplace transform of the indicator of C(X).
 * Returns the terms { coeff, factors } (factors = indices k of the linear forms).
 */
export function adjointTerms(X) {
  const n = X.length, terms = [];
  for (let i = 1; i <= n - 2; i++) {
    const factors = [];
    for (let k = 1; k < n; k++) if (k !== i && k !== i + 1) factors.push(k);
    terms.push({ coeff: Math.abs(det3(X[0], X[i], X[i + 1])), factors });
  }
  return terms;
}

/** Value of the homogeneous adjoint at u (see adjointTerms). */
export function adjointHom(X, u) {
  const d3 = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
  return adjointTerms(X).reduce((s, t) => s + t.coeff * t.factors.reduce((p, k) => p * d3(u, X[k]), 1), 0);
}

/**
 * ∫ f over the triangle (0, a, b) by a tensor Gauss–Legendre rule in Duffy
 * coordinates  w = s·((1 − t) a + t b),  dw = s·|det(a, b)| ds dt.
 */
const GAUSS = (() => {
  // 12-point Gauss–Legendre nodes and weights on [0, 1]
  const x = [0.1252334085114689, 0.3678314989981802, 0.5873179542866175, 0.7699026741943047, 0.9041172563704749, 0.9815606342467192];
  const w = [0.2491470458134028, 0.2334925365383548, 0.2031674267230659, 0.1600783285433462, 0.1069393259953184, 0.0471753363865118];
  const nodes = [];
  x.forEach((xi, i) => { nodes.push([(1 - xi) / 2, w[i] / 2], [(1 + xi) / 2, w[i] / 2]); });
  return nodes;
})();

export function integrateFan(d, f, pieces = 6, radial = 1) {
  // each fan triangle is cut into `pieces` slivers in t and `radial` bands in s,
  // so that kinks of f (the walls of a spline) matter less
  let total = 0;
  const n = d.length;
  for (let i = 0; i < n; i++) {
    const a = d[i], b = d[(i + 1) % n], J = Math.abs(a[0] * b[1] - a[1] * b[0]);
    if (J === 0) continue;
    for (let p = 0; p < pieces; p++) {
      for (const [t0, wt] of GAUSS) {
        const t = (p + t0) / pieces, e = [(1 - t) * a[0] + t * b[0], (1 - t) * a[1] + t * b[1]];
        for (let r = 0; r < radial; r++) {
          for (const [s0, ws] of GAUSS) {
            const s = (r + s0) / radial;
            total += (wt / pieces) * (ws / radial) * s * J * f([s * e[0], s * e[1]]);
          }
        }
      }
    }
  }
  return total;
}

/* ------------------------------------------------------------------ */
/*  One variable: B-splines and the barycentric formula                */
/* ------------------------------------------------------------------ */

/**
 * The B-spline M(y | t_0 … t_n) with distinct knots, normalised to integral 1
 * (Curry–Schoenberg: the density of the shadow of an n-simplex on a line), by
 * the recurrence
 *     M(y | t_0…t_n) = n/(n−1) · [ (y − t_0) M(y | t_0…t_{n−1}) + (t_n − y) M(y | t_1…t_n) ] / (t_n − t_0).
 * Knots must be sorted increasingly.
 */
export function bspline(knots, y) {
  const n = knots.length - 1;
  if (n === 1) return y >= knots[0] && y < knots[1] ? 1 / (knots[1] - knots[0]) : 0;
  return (n / (n - 1)) * ((y - knots[0]) * bspline(knots.slice(0, n), y) +
    (knots[n] - y) * bspline(knots.slice(1), y)) / (knots[n] - knots[0]);
}

/** Weights c_i = 1 / Π_{j≠i} (t_i − t_j) of Lagrange interpolation in barycentric form. */
export function lagrangeWeights(nodes) {
  return nodes.map((ti, i) => 1 / nodes.reduce((p, tj, j) => (j === i ? p : p * (ti - tj)), 1));
}
