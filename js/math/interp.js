/**
 * interp.js — interpolation in one variable, in barycentric form (Section 8.2).
 *
 * Nodes t_0 < … < t_n on a line, node polynomial ℓ(x) = Π (x − t_j).
 *
 *   Barycentric form.  For ANY non-zero weights w_j,
 *       r(x) = Σ_j w_j f_j / (x − t_j)  /  Σ_j w_j / (x − t_j)
 *   interpolates the data f_j (Schneider & Werner). Write
 *       R(x) = Σ_j w_j / (x − t_j),       λ_j(x) = (w_j / (x − t_j)) / R(x),
 *   so that R has a simple pole with residue w_j at every node.
 *
 *   Polynomial case.  w_j = c_j = 1 / Π_{k≠j} (t_j − t_k) = 1 / ℓ'(t_j) gives
 *   R = 1/ℓ and the λ_j are Lagrange's basis polynomials.
 *
 *   Degree of precision.  r reproduces every polynomial of degree ≤ d exactly
 *   when R(x) = O(x^{−d−1}) at infinity, i.e. when the moments Σ_j w_j t_j^k
 *   vanish for k = 0 … d − 1. (Residue theorem on the Riemann sphere, applied
 *   to g(t) R(t) / (x − t); constants are always reproduced.)
 *
 *   Denominator.  D(x) = ℓ(x) R(x) = Σ_j w_j Π_{k≠j} (x − t_k) is a polynomial of
 *   degree n − d; its zeros are the poles of the interpolant. D is constant
 *   exactly for the polynomial weights.
 *
 *   Hermite's formula.  For f analytic inside a contour Γ around the nodes and x,
 *       f(x) − p(x) = (1/2πi) ∮_Γ  ℓ(x) f(t) / (ℓ(t) (t − x)) dt,
 *   (for other weights the same holds with R(t)/R(x) in place of ℓ(x)/ℓ(t)),
 *   and for a rational f with simple poles π_k (residues ρ_k) that vanishes at
 *   infinity, moving the contour to infinity gives
 *       f(x) − p(x) = Σ_k ρ_k ℓ(x) / (ℓ(π_k) (x − π_k)).
 *
 * Complex numbers are pairs [re, im].
 */

/* ---------------- complex arithmetic ---------------- */

export const cadd = (a, b) => [a[0] + b[0], a[1] + b[1]];
export const csub = (a, b) => [a[0] - b[0], a[1] - b[1]];
export const cmul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
export const cdiv = (a, b) => {
  const d = b[0] * b[0] + b[1] * b[1];
  return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d];
};
export const cabs = (a) => Math.hypot(a[0], a[1]);

/* ---------------- nodes and weights ---------------- */

/** n + 1 equispaced points in [−1, 1]. */
export const equispaced = (n) => Array.from({ length: n + 1 }, (_, j) => -1 + (2 * j) / n);

/** n + 1 Chebyshev points cos(jπ/n) in [−1, 1], in increasing order. */
export const chebyshev = (n) => Array.from({ length: n + 1 }, (_, j) => -Math.cos((j * Math.PI) / n));

/** Weights of polynomial interpolation: c_j = 1 / Π_{k≠j} (t_j − t_k) = 1 / ℓ'(t_j). */
export function polynomialWeights(t) {
  return t.map((tj, j) => 1 / t.reduce((p, tk, k) => (k === j ? p : p * (tj - tk)), 1));
}

/**
 * Berrut's weights (−1)^j: a rational interpolant without real poles for any nodes.
 * For an even number of nodes, R(x) = Σ (−1)^j / (x − t_j) is the canonical function
 * of the union of the intervals [t_0, t_1], [t_2, t_3], … (a positive geometry on the line).
 */
export const berrutWeights = (t) => t.map((_, j) => (j % 2 ? -1 : 1));

/**
 * Weights of the Floater–Hormann interpolant of degree d (0 ≤ d ≤ n): the blend
 * Σ_i μ_i(x) p_i(x) / Σ_i μ_i(x) of the polynomials p_i that interpolate at
 * t_i … t_{i+d}, with μ_i(x) = (−1)^i / ((x − t_i) ⋯ (x − t_{i+d})). In barycentric
 * form
 *     w_k = Σ_{i = max(0, k−d)}^{min(k, n−d)} (−1)^i Π_{j=i, j≠k}^{i+d} 1 / (t_k − t_j).
 * d = 0 gives Berrut's weights, d = n the polynomial weights (up to a common sign).
 */
export function floaterHormannWeights(t, d) {
  const n = t.length - 1;
  return t.map((tk, k) => {
    let w = 0;
    for (let i = Math.max(0, k - d); i <= Math.min(k, n - d); i++) {
      let p = i % 2 ? -1 : 1;
      for (let j = i; j <= i + d; j++) if (j !== k) p /= tk - t[j];
      w += p;
    }
    return w;
  });
}

/* ---------------- evaluation ---------------- */

/** The node polynomial ℓ(x) = Π (x − t_j), real argument. */
export const nodePolynomial = (t, x) => t.reduce((p, tj) => p * (x - tj), 1);

/** The node polynomial at a complex point z. */
export const nodePolynomialC = (t, z) => t.reduce((p, tj) => cmul(p, [z[0] - tj, z[1]]), [1, 0]);

/** Index of a node that x coincides with (to rounding), or −1. */
function hitNode(t, x) {
  for (let j = 0; j < t.length; j++) if (Math.abs(x - t[j]) < 1e-14 * (1 + Math.abs(x))) return j;
  return -1;
}

/** The coordinates λ_j(x) = (w_j / (x − t_j)) / Σ_k w_k / (x − t_k). */
export function baryCoordinates(t, w, x) {
  const hit = hitNode(t, x);
  if (hit >= 0) return t.map((_, j) => (j === hit ? 1 : 0));
  const terms = t.map((tj, j) => w[j] / (x - tj)), sum = terms.reduce((s, v) => s + v, 0);
  return terms.map((v) => v / sum);
}

/** The barycentric interpolant of the values f_j at x. */
export const baryEval = (t, w, f, x) => baryCoordinates(t, w, x).reduce((s, l, j) => s + l * f[j], 0);

/** R(x) = Σ_j w_j / (x − t_j) (x not a node). */
export const poleSum = (t, w, x) => t.reduce((s, tj, j) => s + w[j] / (x - tj), 0);

/** The denominator polynomial D(x) = ℓ(x) R(x) = Σ_j w_j Π_{k≠j} (x − t_k), valid at the nodes too. */
export function denominator(t, w, x) {
  return t.reduce((s, _, j) => s + w[j] * t.reduce((p, tk, k) => (k === j ? p : p * (x - tk)), 1), 0);
}

/** The Lebesgue function Σ_j |λ_j(x)|; it equals 1 exactly where all coordinates are ≥ 0. */
export const lebesgue = (t, w, x) => baryCoordinates(t, w, x).reduce((s, l) => s + Math.abs(l), 0);

/**
 * Degree of precision: the largest d ≤ n with Σ_j w_j t_j^k = 0 for all k < d
 * (relative to Σ_j |w_j t_j^k|). The interpolant reproduces polynomials of degree ≤ d.
 */
export function precisionDegree(t, w, tol = 1e-9) {
  const n = t.length - 1;
  for (let k = 0; k < n; k++) {
    let m = 0, size = 0;
    t.forEach((tj, j) => { const v = w[j] * tj ** k; m += v; size += Math.abs(v); });
    if (Math.abs(m) > tol * size) return k;
  }
  return n;
}

/* ---------------- Hermite's formula ---------------- */

/**
 * (1/2πi) ∮ ℓ(x) f(t) / (ℓ(t) (t − x)) dt over the ellipse with foci ±1 and
 * semi-axes (ρ + 1/ρ)/2, (ρ − 1/ρ)/2 (a Bernstein ellipse), by the trapezoidal
 * rule with m points. f maps a complex number to a complex number.
 */
export function hermiteContour(t, f, x, rho, m = 2000) {
  let sum = [0, 0];
  const a = (rho + 1 / rho) / 2, b = (rho - 1 / rho) / 2, lx = nodePolynomial(t, x);
  for (let k = 0; k < m; k++) {
    const th = (2 * Math.PI * k) / m, z = [a * Math.cos(th), b * Math.sin(th)];
    const dz = [-a * Math.sin(th), b * Math.cos(th)];                    // dz/dθ
    const integrand = cdiv(cmul([lx, 0], f(z)), cmul(nodePolynomialC(t, z), [z[0] - x, z[1]]));
    sum = cadd(sum, cmul(integrand, dz));
  }
  // (1/2πi) Σ … · 2π/m  =  (1/(i m)) Σ …
  return cdiv([sum[0] / m, sum[1] / m], [0, 1]);
}

/**
 * The same integral for arbitrary weights, with R(t) = Σ w_j / (t − t_j) in place of 1/ℓ(t):
 *     f(x) − r(x) = (1/2πi) ∮ R(t) f(t) / (R(x) (t − x)) dt
 * (the residues at the nodes are −λ_j(x) f(t_j), the residue at t = x is f(x)).
 */
export function baryContour(t, w, f, x, rho, m = 2000) {
  let sum = [0, 0];
  const a = (rho + 1 / rho) / 2, b = (rho - 1 / rho) / 2, Rx = poleSum(t, w, x);
  for (let k = 0; k < m; k++) {
    const th = (2 * Math.PI * k) / m, z = [a * Math.cos(th), b * Math.sin(th)];
    const dz = [-a * Math.sin(th), b * Math.cos(th)];
    const Rz = t.reduce((s, tj, j) => cadd(s, cdiv([w[j], 0], [z[0] - tj, z[1]])), [0, 0]);
    const integrand = cdiv(cmul(Rz, f(z)), [Rx * (z[0] - x), Rx * z[1]]);
    sum = cadd(sum, cmul(integrand, dz));
  }
  return cdiv([sum[0] / m, sum[1] / m], [0, 1]);
}

/**
 * Error f(x) − p(x) of polynomial interpolation for the rational function
 * f(t) = Σ_k ρ_k / (t − π_k), from the residues at its poles:
 *     f(x) − p(x) = Σ_k ρ_k ℓ(x) / (ℓ(π_k) (x − π_k)).
 * poles: [{ at: [re, im], residue: [re, im] }]. Returns a complex number
 * (real when the poles come in conjugate pairs).
 */
export function hermiteResidues(t, poles, x) {
  const lx = nodePolynomial(t, x);
  return poles.reduce((s, p) =>
    cadd(s, cdiv(cmul(p.residue, [lx, 0]), cmul(nodePolynomialC(t, p.at), [x - p.at[0], -p.at[1]]))), [0, 0]);
}

/** The Bernstein-ellipse parameter ρ = |z + √(z² − 1)| ≥ 1 of a complex point z. */
export function bernsteinRho(z) {
  const w = csub(cmul(z, z), [1, 0]), r = Math.sqrt(cabs(w)), phi = Math.atan2(w[1], w[0]) / 2;
  const root = [r * Math.cos(phi), r * Math.sin(phi)];
  return Math.max(cabs(cadd(z, root)), cabs(csub(z, root)));
}

/* ---------------- potentials ---------------- */

/** Discrete potential u_n(z) = (1/(n+1)) Σ log |z − t_j|, so that |ℓ(z)| = exp((n+1) u_n(z)). */
export const discretePotential = (t, z) =>
  t.reduce((s, tj) => s + Math.log(Math.hypot(z[0] - tj, z[1])), 0) / t.length;

/** Principal branch of z·log z for complex z (0 at z = 0). */
const zlogz = (z) => (cabs(z) === 0 ? [0, 0] : cmul(z, [Math.log(cabs(z)), Math.atan2(z[1], z[0])]));

/**
 * Limiting potentials for n → ∞ on [−1, 1]:
 *   equispaced nodes   u(z) = −1 + ½ Re[(z + 1) log(z + 1) − (z − 1) log(z − 1)]
 *   Chebyshev nodes    u(z) = log |z + √(z² − 1)| − log 2     (constant on [−1, 1])
 */
export function limitPotential(kind, z) {
  if (kind === "chebyshev") return Math.log(bernsteinRho(z)) - Math.LN2;
  return -1 + 0.5 * (zlogz([z[0] + 1, z[1]])[0] - zlogz([z[0] - 1, z[1]])[0]);
}

/* ---------------- the moment curve ---------------- */

/**
 * Barycentric coordinates of a point q ∈ R^n with respect to the simplex with
 * vertices v_0 … v_n: the solution of Σ β_j = 1, Σ β_j v_j = q (Gaussian
 * elimination with partial pivoting).
 */
export function simplexCoordinates(v, q) {
  const m = v.length;
  const A = Array.from({ length: m }, (_, r) => [...v.map((vj) => (r === 0 ? 1 : vj[r - 1])), r === 0 ? 1 : q[r - 1]]);
  for (let c = 0; c < m; c++) {
    let p = c;
    for (let r = c + 1; r < m; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    for (let r = 0; r < m; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k <= m; k++) A[r][k] -= f * A[c][k];
    }
  }
  return A.map((row, r) => row[m] / row[r]);
}

/** The point (x, x², …, xⁿ) of the moment curve in R^n. */
export const momentCurve = (n, x) => Array.from({ length: n }, (_, k) => x ** (k + 1));

/* ---------------- residues and poles ---------------- */

/** g(z) = z^k for a complex z. */
export const cpow = (z, k) => { let p = [1, 0]; for (let i = 0; i < k; i++) p = cmul(p, z); return p; };

/**
 * The poles of the form  R(t) g(t) dt / (R(x) (x − t)),  g(t) = t^degree, in the
 * finite plane: the nodes, with residue λ_j(x) g(t_j), and the point x, with
 * residue −g(x). Returns [{ at, residue, node }] (node = index, or −1 for x).
 * If the degree is at most the degree of precision the residues add up to zero.
 */
export function kernelResidues(t, w, x, degree) {
  const lam = baryCoordinates(t, w, x);
  return [...t.map((tj, j) => ({ at: tj, residue: lam[j] * tj ** degree, node: j })),
    { at: x, residue: -(x ** degree), node: -1 }];
}

/** (1/2πi) ∮ R(t) t^degree / (R(x) (x − t)) dt over the circle |t − centre| = radius (trapezoidal rule). */
export function kernelCircleIntegral(t, w, x, degree, centre, radius, m = 2000) {
  let sum = [0, 0];
  const Rx = poleSum(t, w, x);
  for (let k = 0; k < m; k++) {
    const th = (2 * Math.PI * k) / m, e = [Math.cos(th), Math.sin(th)];
    const z = [centre[0] + radius * e[0], centre[1] + radius * e[1]];
    const Rz = t.reduce((s, tj, j) => cadd(s, cdiv([w[j], 0], [z[0] - tj, z[1]])), [0, 0]);
    const integrand = cdiv(cmul(Rz, cpow(z, degree)), [Rx * (x - z[0]), -Rx * z[1]]);
    // dt = i·radius·e^{iθ} dθ, and the factor 1/(2πi) · 2π/m leaves radius·e^{iθ}/m
    sum = cadd(sum, cmul(integrand, [radius * e[0], radius * e[1]]));
  }
  return [sum[0] / m, sum[1] / m];
}

/** Coefficients (lowest degree first) of D(x) = Σ_j w_j Π_{k≠j} (x − t_k). */
export function denominatorCoefficients(t, w) {
  const out = new Array(t.length).fill(0);
  t.forEach((_, j) => {
    let p = [1];
    t.forEach((tk, k) => {
      if (k === j) return;
      const q = new Array(p.length + 1).fill(0);
      p.forEach((c, i) => { q[i + 1] += c; q[i] -= c * tk; });
      p = q;
    });
    p.forEach((c, i) => { out[i] += w[j] * c; });
  });
  return out;
}

/**
 * All complex roots of a real polynomial (coefficients lowest degree first, the
 * last one non-zero), by the Durand–Kerner iteration. Meant for small degrees.
 */
export function polynomialRoots(coeffs) {
  const n = coeffs.length - 1;
  if (n < 1) return [];
  const a = coeffs.map((c) => c / coeffs[n]);
  const value = (z) => { let p = [1, 0]; for (let i = n - 1; i >= 0; i--) p = cadd(cmul(p, z), [a[i], 0]); return p; };
  const bound = 1 + Math.max(...a.slice(0, n).map(Math.abs));
  let roots = Array.from({ length: n }, (_, k) => {
    const th = (2 * Math.PI * k) / n + 0.4;
    return [0.5 * bound * Math.cos(th), 0.5 * bound * Math.sin(th)];
  });
  for (let iter = 0; iter < 500; iter++) {
    let move = 0;
    roots = roots.map((z, i) => {
      let den = [1, 0];
      roots.forEach((u, k) => { if (k !== i) den = cmul(den, csub(z, u)); });
      const step = cdiv(value(z), den);
      move = Math.max(move, cabs(step));
      return csub(z, step);
    });
    if (move < 1e-14 * bound) break;
  }
  return roots;
}

/**
 * The poles of the barycentric interpolant with weights w: the roots of its
 * denominator D, which has degree n − d (d = degree of precision).
 */
export function interpolantPoles(t, w) {
  const d = precisionDegree(t, w), n = t.length - 1;
  return polynomialRoots(denominatorCoefficients(t, w).slice(0, n - d + 1));
}
