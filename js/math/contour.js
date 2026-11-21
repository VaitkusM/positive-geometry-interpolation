/**
 * contour.js — the canonical function of a quadrilateral as a contour integral
 * (Section 8.2; after Arkani-Hamed, Bai & Lam, Section 7.4).
 *
 * Four points p_0 … p_3 of the plane satisfy one linear relation
 *     Σ k_j (1, p_j) = 0,      k_j = (−1)^j det[(1, p_a), (1, p_b), (1, p_c)]  (a < b < c the other three).
 * For a convex quadrilateral the signs of k alternate. If x = Σ c_j p_j with
 * Σ c_j = 1 and all c_j > 0 (for instance the Wachspress coordinates of x), then
 * every other such representation is c + s·k, and
 *
 *     C_P(x) = (1/2π) ∫_{−∞}^{∞} ds / Π_j (c_j − i s k_j).
 *
 * The integrand has four simple poles, s_j = −i c_j / k_j, on the imaginary
 * axis: those with k_j > 0 below the real axis, those with k_j < 0 above. At
 * the pole s_j the coefficient of p_j vanishes, and its contribution is the
 * canonical function of the triangle on the other three vertices. Closing the
 * contour below or above therefore gives the two triangulations of the
 * quadrilateral, and Cauchy's theorem says that their sums agree.
 */

import { triangleCanonical } from "./canonical.js";

const det3 = (a, b, c) =>
  a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);

/** The linear relation k among the four homogeneous vertices (1, p_j). */
export function quadKernel(pts) {
  const Z = pts.map((p) => [1, p[0], p[1]]);
  return [0, 1, 2, 3].map((j) => {
    const o = [0, 1, 2, 3].filter((i) => i !== j);
    return (j % 2 ? -1 : 1) * det3(Z[o[0]], Z[o[1]], Z[o[2]]);
  });
}

/**
 * The four poles for positive coefficients c of x.
 * @returns [{ vertex, s, upper, triangle, value }]
 *   s         the pole is at i·s (s > 0: upper half plane)
 *   triangle  indices of the three vertices that remain when c_vertex = 0
 *   value     the pole's contribution to C_P(x): 1 / (|k_j| Π_{l≠j} (c_l − c_j k_l / k_j)),
 *             equal to the canonical function of that triangle at x
 */
export function quadPoles(pts, c) {
  const k = quadKernel(pts);
  return [0, 1, 2, 3].map((j) => {
    let prod = 1;
    for (let l = 0; l < 4; l++) if (l !== j) prod *= c[l] - (c[j] * k[l]) / k[j];
    return { vertex: j, s: -c[j] / k[j], upper: k[j] < 0, triangle: [0, 1, 2, 3].filter((i) => i !== j),
      value: 1 / (Math.abs(k[j]) * prod) };
  });
}

/** The canonical function of the triangle that remains when a vertex is left out. */
export function quadTriangleCanonical(pts, vertex, x) {
  const o = [0, 1, 2, 3].filter((i) => i !== vertex);
  return triangleCanonical(pts[o[0]], pts[o[1]], pts[o[2]], x);
}

/**
 * (1/2π) ∫ ds / Π (c_j − i s k_j) along the real axis, numerically (midpoint
 * rule after the substitution s = σ·tan θ, which maps the line to a finite interval).
 */
export function quadLineIntegral(pts, c, N = 20000) {
  const k = quadKernel(pts);
  const sigma = Math.min(...c.map((cj, j) => cj / Math.abs(k[j])));       // scale of the nearest pole
  let re = 0;
  for (let i = 0; i < N; i++) {
    const th = -Math.PI / 2 + ((i + 0.5) * Math.PI) / N, s = sigma * Math.tan(th);
    let pr = 1, pi = 0;
    for (let j = 0; j < 4; j++) {
      const a = c[j], b = -s * k[j], nr = pr * a - pi * b, ni = pr * b + pi * a;
      pr = nr; pi = ni;
    }
    re += (pr / (pr * pr + pi * pi)) * (sigma / (Math.cos(th) * Math.cos(th)));
  }
  return (re * Math.PI) / N / (2 * Math.PI);
}
