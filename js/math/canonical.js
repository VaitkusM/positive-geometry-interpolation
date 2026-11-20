/**
 * canonical.js — canonical rational functions of some positive geometries.
 *
 * A positive geometry carries a canonical differential form Ω. In an affine
 * chart with coordinates (x, y) we always write
 *
 *        Ω = C(x, y) dx ∧ dy          (or  C(x) dx  in one dimension)
 *
 * and the functions below return this density C. (The paper writes Ω = C·ω
 * with a differently normalised measure ω; the two conventions differ by a
 * constant factor d! which cancels in every ratio of forms, and therefore in
 * all barycentric coordinates.)
 *
 * With this normalisation:
 *   - every 0-dimensional residue (at a vertex) is ±1;
 *   - C(x) = d! · Vol(polar dual of the shape, taken with x as the origin).
 *
 * See polygon.js for the polygon / edge-line conventions.
 */

import { det2, edgeLines, lineDist, mod } from "./polygon.js";

/* ------------------------------------------------------------------ */
/*  Dimension 1: the segment [a, b]                                    */
/* ------------------------------------------------------------------ */

/**
 * Canonical function of the segment [a, b] ⊂ ℝ:
 *     C(x) = (b − a) / ((x − a)(b − x)) = 1/(x − a) + 1/(b − x).
 * Simple poles at a and b with residues +1 and −1. Positive inside.
 */
export const segmentCanonical = (a, b, x) => (b - a) / ((x - a) * (b - x));

/* ------------------------------------------------------------------ */
/*  Dimension 2: triangles, wedges, convex polygons                    */
/* ------------------------------------------------------------------ */

/** ⟨a, b, c⟩ = det of the homogeneous coordinates [x : y : 1] = 2·signed area. */
export const bracket = (a, b, c) =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

/**
 * Canonical function of the triangle (p0, p1, p2), eq. (3.9) of the paper:
 *     C(x) = ⟨p0 p1 p2⟩² / ( ⟨x p0 p1⟩ ⟨x p1 p2⟩ ⟨x p2 p0⟩ ).
 * In terms of areas: C = A² / (2·A0·A1·A2).
 */
export function triangleCanonical(p0, p1, p2, x) {
  const D = bracket(p0, p1, p2);
  return (D * D) / (bracket(x, p0, p1) * bracket(x, p1, p2) * bracket(x, p2, p0));
}

/**
 * Canonical function of a WEDGE: the region { h_A > 0, h_B > 0 } bounded by
 * two lines. Projectively it is a triangle whose third side is the line at
 * infinity; this is the triangle Δ(l, l', x*) of eqs. (4.12)–(4.13), in the
 * affine chart where the dual line x* of the evaluation point is at infinity.
 *
 *     C(x) = det(n_A, n_B) / ( h_A(x) · h_B(x) ).
 *
 * The lines must be ordered so that det(n_A, n_B) > 0 (as consecutive edges of
 * a CCW polygon are); then C > 0 inside the wedge.
 */
export function wedgeCanonical(lineA, lineB, x) {
  return det2(lineA.n, lineB.n) / (lineDist(lineA, x) * lineDist(lineB, x));
}

/**
 * The n wedge functions of a convex polygon, one per vertex:
 *     w_i(x) = det(n_{i−1}, n_i) / ( h_{i−1}(x) h_i(x) ).
 * These are the (unnormalised) Wachspress weights.
 */
export function vertexWedges(pts, x) {
  const lines = edgeLines(pts);
  const n = pts.length;
  const h = lines.map((l) => lineDist(l, x));
  const w = new Array(n);
  for (let i = 0; i < n; i++) {
    const j = mod(i - 1, n);
    w[i] = det2(lines[j].n, lines[i].n) / (h[j] * h[i]);
  }
  return w;
}

/**
 * Canonical function of a convex polygon. Canonical forms are additive, and
 * the vertex wedges form a (signed) triangulation of the polygon, so
 *     C_P(x) = Σ_i w_i(x).
 */
export function polygonCanonical(pts, x) {
  let s = 0;
  for (const w of vertexWedges(pts, x)) s += w;
  return s;
}

/**
 * Adjoint polynomial of a convex polygon: the numerator of its canonical
 * function over the common denominator Π_i h_i(x),
 *     adj(x) = Σ_i det(n_{i−1}, n_i) · Π_{j ≠ i−1, i} h_j(x),
 * so that C_P = adj / Π h_i. It has degree n − 3 and vanishes at every
 * intersection point of two NON-adjacent edge lines.
 */
export function polygonAdjoint(pts, x) {
  const lines = edgeLines(pts);
  const n = pts.length;
  const h = lines.map((l) => lineDist(l, x));
  let s = 0;
  for (let i = 0; i < n; i++) {
    const j = mod(i - 1, n);
    let prod = det2(lines[j].n, lines[i].n);
    for (let k = 0; k < n; k++) if (k !== i && k !== j) prod *= h[k];
    s += prod;
  }
  return s;
}

/* ------------------------------------------------------------------ */
/*  Regions with curved boundaries (Arkani-Hamed, Bai, Lam, §5.3)      */
/* ------------------------------------------------------------------ */

/**
 * Half disc { x² + y² ≤ 1, y ≥ 0 } — a "generalised simplex" bounded by a
 * conic and a line:   C = 2 / ( (1 − x² − y²) · y ).
 */
export const halfDiscCanonical = ([x, y]) => 2 / ((1 - x * x - y * y) * y);

/**
 * "Pizza slice" { x² + y² ≤ 1, √3·y ≥ |x| } — a polycon bounded by a circular
 * arc and two lines (the example shown on the poster):
 *     C = 2√3 (1 + 2y) / ( (1 − x² − y²)(√3y + x)(√3y − x) ).
 * Its numerator 1 + 2y is the adjoint: the line through the two "unwanted"
 * intersection points of the side lines with the circle.
 */
export const pizzaCanonical = ([x, y]) => {
  const s3 = Math.sqrt(3);
  return (2 * s3 * (1 + 2 * y)) / ((1 - x * x - y * y) * (s3 * y + x) * (s3 * y - x));
};

/**
 * Unit disc. NOT a positive geometry: the natural analogue of the canonical
 * function is not rational,
 *     C = 2π / (1 − x² − y²)^{3/2}     ( = 2 · area of the polar dual ellipse ),
 * with a branch-type singularity of order 3/2 on the circle instead of a
 * simple pole. This is eq. (5.14) of the paper in the present normalisation.
 */
export const discCanonical = ([x, y]) => (2 * Math.PI) / Math.pow(1 - x * x - y * y, 1.5);
