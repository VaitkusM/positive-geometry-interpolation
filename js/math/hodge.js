/**
 * hodge.js — genus and combinatorial rank of plane curves (Section 8.1; after
 * F. Brown & C. Dupont, "Positive geometries and canonical forms via mixed
 * Hodge theory", arXiv:2501.03202).
 *
 * For a compact variety X of dimension n and a closed subvariety Y, the
 * relative homology H_n(X, Y) carries a mixed Hodge structure with Hodge
 * numbers h^{−p,−q}, 0 ≤ p, q ≤ n. Two of them matter for canonical forms:
 *
 *   combinatorial rank   cr = h^{0,0}            the number of independent canonical forms
 *   genus                g  = Σ_{p>0} h^{−p,0}   the number of independent ambiguities
 *
 * A canonical form exists (is non-zero) iff cr > 0 and is unique iff g = 0; the
 * space of n-forms with logarithmic poles on X∖Y has dimension g + cr.
 *
 * For a curve Y in the projective plane (their Propositions 3.21, 3.22, 4.14, 4.15):
 *   g(P², Y)  = sum of the genera of the components of Y (after resolving singularities),
 *   cr(P², Y) = Σ_P (r_P − 1) − (k − 1),
 * with r_P the number of local branches of Y at the point P and k the number of
 * components. If all singular points are ordinary crossings of two branches,
 * cr is the number of independent loops of the graph with one dot per component
 * and one line per crossing point (a self-crossing is a loop).
 */

/**
 * @param {number[]} genera    geometric genus of every component
 * @param {number[]} branches  number of local branches at every singular point of the union
 *                             (complex points and points at infinity included)
 * @returns {{ genus, rank, forms, hodge }}  forms = g + cr; hodge[q][p] = h^{−p,−q} of H_2(P², Y)
 */
export function planeCurveInvariants(genera, branches) {
  const genus = genera.reduce((s, g) => s + g, 0);
  const rank = branches.reduce((s, r) => s + (r - 1), 0) - (genera.length - 1);
  // H_2(P², Y) ≅ H_1(Y): weight 0 of type (0,0), weight −1 of types (−1,0) and (0,−1)
  const hodge = [[rank, genus, 0], [genus, 0, 0], [0, 0, 0]];
  return { genus, rank, forms: genus + rank, hodge };
}

/* ---------------- the cubics  y² = x²(1 − x) − ε ---------------- */

/** g(x) = x²(1 − x) − ε and its derivative; the curve is y² = g(x). */
export const cubicG = (eps, x) => x * x * (1 - x) - eps;
export const cubicDG = (x) => 2 * x - 3 * x * x;

/**
 * The three real roots r1 ≤ r2 ≤ r3 of g for 0 ≤ ε < 4/27. For ε = 0 the roots
 * are 0, 0, 1 (the curve has a node at the origin); for ε > 0 the curve is
 * smooth, with an oval over [r2, r3] and an unbounded branch over (−∞, r1].
 */
export function cubicRoots(eps) {
  if (eps <= 0) return [0, 0, 1];
  const bisect = (lo, hi) => {
    const up = cubicG(eps, hi) > 0;
    for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if ((cubicG(eps, m) > 0) === up) hi = m; else lo = m; }
    return (lo + hi) / 2;
  };
  return [bisect(-1, 0), bisect(0, 2 / 3), bisect(2 / 3, 1)];
}

/**
 * The bounded loop of the curve (teardrop for ε = 0, oval for ε > 0), sampled
 * as { pts, s, density, length }:
 *   pts       points of the loop, starting and ending at its left end (r2, 0)
 *   s         arclength from the start to each point
 *   density   2 / |∇f| at each point, f = y² − g(x): the residue of the form
 *             2 dx∧dy / f along the curve, per unit of arclength
 */
export function cubicLoop(eps, N = 720) {
  const [, r2, r3] = cubicRoots(eps), mid = (r2 + r3) / 2, rad = (r3 - r2) / 2;
  const pts = [], s = [], density = [];
  for (let k = 0; k <= N; k++) {
    const th = (2 * Math.PI * k) / N, x = mid - rad * Math.cos(th);
    const y = (th <= Math.PI ? 1 : -1) * Math.sqrt(Math.max(0, cubicG(eps, x)));
    pts.push([x, y]);
    s.push(k === 0 ? 0 : s[k - 1] + Math.hypot(x - pts[k - 1][0], y - pts[k - 1][1]));
    density.push(2 / Math.hypot(cubicDG(x), 2 * y));
  }
  return { pts, s, density, length: s[N] };
}

/** ∮ of the residue around the oval, 2 ∫_{r2}^{r3} dx / √g(x); infinite for ε = 0. */
export function cubicPeriod(eps, N = 4000) {
  if (eps <= 0) return Infinity;
  const [r1, r2, r3] = cubicRoots(eps), mid = (r2 + r3) / 2, rad = (r3 - r2) / 2;
  // x = mid − rad·cos θ removes the square-root singularities: dx/√g = dθ / √(x − r1)
  let sum = 0;
  for (let k = 0; k < N; k++) {
    const th = (Math.PI * (k + 0.5)) / N;
    sum += 1 / Math.sqrt(mid - rad * Math.cos(th) - r1);
  }
  return (2 * sum * Math.PI) / N;
}
