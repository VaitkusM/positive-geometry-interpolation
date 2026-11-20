/**
 * pushforward.js — the canonical form of a quadrilateral as a push-forward.
 *
 * The bilinear map (the simplest toric / tensor-product Bézier patch)
 *
 *     B(u, v) = (1−u)(1−v) p0 + u(1−v) p1 + u v p2 + (1−u) v p3
 *
 * sends the unit square onto the convex quadrilateral p0 p1 p2 p3. The square
 * has canonical form  du dv / ( u(1−u) v(1−v) ). Push-forward means: to
 * evaluate at a point y, sum over ALL solutions (u, v) of B(u, v) = y —
 * there are two, possibly complex — the value at the solution divided by the
 * Jacobian determinant. The result is the canonical function of the
 * quadrilateral (Arkani-Hamed, Bai, Lam 2017, Theorem 7.12 and Example 7.13):
 *
 *     C_quad(y) = Σ_roots  1 / ( u(1−u) v(1−v) · J(u, v) ).
 *
 * Complex numbers are pairs [re, im].
 */

const cadd = (a, b) => [a[0] + b[0], a[1] + b[1]];
const cmul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const cdiv = (a, b) => {
  const d = b[0] * b[0] + b[1] * b[1];
  return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d];
};
const cscale = (a, s) => [a[0] * s, a[1] * s];
const conj = (a) => [a[0], -a[1]];
const ONE = [1, 0];
const det = (a, b) => a[0] * b[1] - a[1] * b[0];

/** Bilinear map of the unit square onto the quadrilateral P = [p0, p1, p2, p3]. */
export function bilinear(P, u, v) {
  const w = [(1 - u) * (1 - v), u * (1 - v), u * v, (1 - u) * v];
  return [0, 1].map((k) => w.reduce((s, wi, i) => s + wi * P[i][k], 0));
}

/** The four bilinear blending functions at (u, v), in vertex order. */
export const bilinearWeights = (u, v) => [(1 - u) * (1 - v), u * (1 - v), u * v, (1 - u) * v];

/**
 * All solutions (u, v) of B(u, v) = y, with the Jacobian determinant J and the
 * term 1/(u(1−u)v(1−v)J) each contributes to the push-forward.
 * Returns one root if the quadrilateral is a parallelogram (B is then affine),
 * otherwise two (real, or a complex-conjugate pair).
 * @returns {{u:number[], v:number[], J:number[], term:number[]}[]}
 */
export function inverseBilinear(P, y) {
  // B(u,v) − y = e + u f + v g + u v k
  const e = [P[0][0] - y[0], P[0][1] - y[1]];
  const f = [P[1][0] - P[0][0], P[1][1] - P[0][1]];
  const g = [P[3][0] - P[0][0], P[3][1] - P[0][1]];
  const k = [P[0][0] - P[1][0] + P[2][0] - P[3][0], P[0][1] - P[1][1] + P[2][1] - P[3][1]];
  // (e + u f) and (g + u k) must be parallel:  a u² + b u + c = 0
  const a = det(f, k), b = det(e, k) + det(f, g), c = det(e, g);
  const scale = Math.abs(a) + Math.abs(b) + Math.abs(c);
  let us;
  if (Math.abs(a) < 1e-10 * scale) {
    us = [[-c / b, 0]];
  } else {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      // numerically stable real roots
      const q = -0.5 * (b + (b >= 0 ? 1 : -1) * Math.sqrt(disc));
      us = [[q / a, 0], [c / q, 0]];
    } else {
      const s = Math.sqrt(-disc);
      us = [[-b / (2 * a), s / (2 * a)], [-b / (2 * a), -s / (2 * a)]];
    }
  }
  return us.map((u) => {
    // A + v B = 0 with A = e + u f, B = g + u k (complex 2-vectors)
    const A = [cadd([e[0], 0], cscale(u, f[0])), cadd([e[1], 0], cscale(u, f[1]))];
    const B = [cadd([g[0], 0], cscale(u, k[0])), cadd([g[1], 0], cscale(u, k[1]))];
    const num = cadd(cmul(A[0], conj(B[0])), cmul(A[1], conj(B[1])));
    const den = B[0][0] ** 2 + B[0][1] ** 2 + B[1][0] ** 2 + B[1][1] ** 2;
    const v = cscale(num, -1 / den);
    // Jacobian: det( ∂B/∂u, ∂B/∂v ) = det( f + v k, g + u k )
    const du = [cadd([f[0], 0], cscale(v, k[0])), cadd([f[1], 0], cscale(v, k[1]))];
    const dv = B;
    const J = cadd(cmul(du[0], dv[1]), cscale(cmul(du[1], dv[0]), -1));
    const om = (z) => cmul(z, cadd(ONE, cscale(z, -1))); // z (1 − z)
    const term = cdiv(ONE, cmul(cmul(om(u), om(v)), J));
    return { u, v, J, term };
  });
}

/** Canonical function of the quadrilateral by push-forward (sum over the roots). */
export function pushforwardCanonical(P, y) {
  return inverseBilinear(P, y).reduce((s, r) => s + r.term[0], 0);
}
