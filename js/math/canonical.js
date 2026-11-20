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

/* ------------------------------------------------------------------ */
/*  Later developments: polycons (regions bounded by lines and conics) */
/* ------------------------------------------------------------------ */

/**
 * The polycon of C. Brüser, "The Geometry of Polycons and a Counterexample to
 * Wachspress' Conjecture", arXiv:2603.18643 (Example 2.10): three ellipses
 * c1, c2, c3, vertices v12, v23, v31, residual points and the adjoint cubic.
 * The polycon is the component of { c1 ≤ 0, c2 ≥ 0, c3 ≥ 0 } that contains
 * the point (0, 4). Its adjoint has an oval INSIDE the polycon.
 */
export const BRUSER = {
  c1: (x, y) => 20 * x * x + 27 * y * y - 120 * x + 108 * y - 864,
  c2: (x, y) => 80 * x * x + 102 * x * y + 57 * y * y - 400 * x - 96 * y,
  c3: (x, y) => 32 * x * x - 26 * x * y + 9 * y * y - 96 * x + 72 * y,
  adjoint: (x, y) => 3440 * x ** 3 - 8400 * x * x * y - 762 * x * y * y + 1971 * y ** 3 +
    20720 * x * x + 51168 * x * y - 1620 * y * y - 193248 * x - 96336 * y + 342144,
  vertices: [[9, -6], [0, 0], [-3, -6]],
  residual: [[6, -8], [2, -4], [0, -8]],
  /** Membership test for the (closed) polycon. */
  inside(x, y) {
    if (!(this.c1(x, y) <= 0 && this.c2(x, y) >= 0 && this.c3(x, y) >= 0)) return false;
    // the three inequalities also cut out a second, separate region between
    // the residual points; it lies in the box below and is not part of the polycon
    return !(x > 0 && x < 6 && y < -4);
  },
};

/**
 * Pizza slice as a polycon: boundary polynomials (positive inside), the
 * adjoint line and the weight that the wedge construction of the paper gives
 * for the vertex at the origin, where two LINES meet:
 *     λ_O = Ω(wedge) / Ω(P) = (1 − x² − y²) / (1 + 2y).
 */
export const PIZZA = {
  circle: (x, y) => 1 - x * x - y * y,
  line1: (x, y) => Math.sqrt(3) * y - x,
  line2: (x, y) => Math.sqrt(3) * y + x,
  adjoint: (x, y) => 1 + 2 * y,
  vertices: [[0, 0], [Math.sqrt(3) / 2, 0.5], [-Math.sqrt(3) / 2, 0.5]],
  residual: [[Math.sqrt(3) / 2, -0.5], [-Math.sqrt(3) / 2, -0.5]],
  inside(x, y) { return this.circle(x, y) >= 0 && this.line1(x, y) >= 0 && this.line2(x, y) >= 0; },
  lambdaO: (x, y) => (1 - x * x - y * y) / (1 + 2 * y),
};

/* ------------------------------------------------------------------ */
/*  Later developments, continued                                      */
/* ------------------------------------------------------------------ */

/**
 * Wachspress' rational basis ("wedges") for the pizza slice, following the
 * construction in his slides "Generalized barycentrics: rational bases for 2D
 * and 3D elements with algebraic sides": a conic side needs a third node, the
 * SIDE NODE M (here at angle `theta` on the arc). With m = 4 the boundary
 * order, all four functions share the adjoint D = 1 + 2y as denominator and
 * have numerators of degree m − 2 = 2:
 *
 *     corner O  (two lines meet):        Q                (the opposite side)
 *     side node M:                       L1 · L2          (all other sides)
 *     vertex V1 (line L1 meets conic):   L2 · ℓ1          opposite side × "adjacent factor",
 *     vertex V2 (line L2 meets conic):   L1 · ℓ2          ℓ_k = line through M and the
 *                                                         residual point E_k of L_k
 *
 * each scaled to equal 1 at its own node. They sum to 1 and reproduce linear
 * functions, but — unlike on polygons — they are NOT all positive inside.
 *
 * @returns {{nodes:number[][], weights:number[], adjacent:{a:number[],b:number[]}[]}}
 *   nodes/weights in the order [O, V1, V2, M]; adjacent[k] gives two points
 *   on the line ℓ_{k+1} (for drawing).
 */
export function pizzaWachspress(theta, [x, y]) {
  const [O, V1, V2] = PIZZA.vertices;
  const [E2, E1] = PIZZA.residual;          // E1 = −V1 lies on line1, E2 = −V2 on line2
  const M = [Math.cos(theta), Math.sin(theta)];
  // linear function vanishing on the line through a and b
  const through = (a, b) => (px, py) => -(b[1] - a[1]) * (px - a[0]) + (b[0] - a[0]) * (py - a[1]);
  const l1 = through(M, E1), l2 = through(M, E2);
  const numerators = [
    (px, py) => PIZZA.circle(px, py),
    (px, py) => PIZZA.line2(px, py) * l1(px, py),
    (px, py) => PIZZA.line1(px, py) * l2(px, py),
    (px, py) => PIZZA.line1(px, py) * PIZZA.line2(px, py),
  ];
  const nodes = [O, V1, V2, M];
  const D = PIZZA.adjoint;
  const weights = numerators.map((N, i) => {
    const k = D(nodes[i][0], nodes[i][1]) / N(nodes[i][0], nodes[i][1]); // normalise to 1 at the node
    return (k * N(x, y)) / D(x, y);
  });
  return { nodes, weights, adjacent: [{ a: M, b: E1 }, { a: M, b: E2 }] };
}

/**
 * Disc cut by a line: the region { x² + y² ≤ 1, y ≥ −a } with 0 < a < 1, and
 * its dual description by Mazzucchelli & Raman (arXiv:2509.02239, eq. (61)).
 *
 *   canonical(x)   = 2√(1−a²) / ( (1 − x² − y²)(y + a) )
 *   inDual(y)      : the polar dual about the origin = convex hull of the unit
 *                    disc and the point (0, 1/a) dual to the cutting line
 *   density(y)     : 1 outside the disc; inside it
 *                    ½ + (1/π) arctan( (y₂ − a) / √((1−a²)(1 − |y|²)) )
 *
 * and canonical(x) = 2 ∫_dual density(y) dy / (1 + x·y)³. For a polygon the
 * density is identically 1 and the formula is the dual volume (eq. 3.10).
 */
export const chordRegion = {
  canonical: (a, [x, y]) => (2 * Math.sqrt(1 - a * a)) / ((1 - x * x - y * y) * (y + a)),
  inside: (a, [x, y]) => x * x + y * y < 1 && y > -a,
  inDual(a, [y1, y2]) {
    if (y1 * y1 + y2 * y2 <= 1) return true;
    if (y2 < a || y2 > 1 / a) return false;
    // between the two tangent lines from the apex (0, 1/a); they touch the circle at (±√(1−a²), a)
    return Math.abs(y1) <= (Math.sqrt(1 - a * a) * (1 / a - y2)) / (1 / a - a);
  },
  density(a, [y1, y2]) {
    const q = 1 - y1 * y1 - y2 * y2;
    if (q <= 0) return 1;
    return 0.5 + Math.atan((y2 - a) / Math.sqrt((1 - a * a) * q)) / Math.PI;
  },
};

/**
 * Midpoint-rule value of  2 ∫_box inDual(y) · density(y) / (1 + x·y)³ dy,
 * the Laplace-type dual integral of a region, on an N × N grid over `box`.
 */
export function dualIntegral(inDual, density, x, box, N = 400) {
  const dx = (box.xmax - box.xmin) / N, dy = (box.ymax - box.ymin) / N;
  let s = 0;
  for (let j = 0; j < N; j++) {
    const y2 = box.ymin + (j + 0.5) * dy;
    for (let i = 0; i < N; i++) {
      const y1 = box.xmin + (i + 0.5) * dx;
      if (!inDual([y1, y2])) continue;
      const t = 1 + x[0] * y1 + x[1] * y2;
      s += density([y1, y2]) / (t * t * t);
    }
  }
  return 2 * s * dx * dy;
}

/** Complete elliptic integral of the second kind E(m), m = k², 0 ≤ m < 1, by the AGM. */
export function ellipticE(m) {
  let a = 1, b = Math.sqrt(1 - m), c = Math.sqrt(m);
  let sum = 0.5 * c * c, pow = 0.5;
  for (let n = 0; n < 40 && Math.abs(c) > 1e-16; n++) {
    c = 0.5 * (a - b);
    const an = 0.5 * (a + b);
    b = Math.sqrt(a * b);
    a = an;
    pow *= 2;
    sum += pow * c * c;
  }
  return (Math.PI / (2 * a)) * (1 - sum);
}

/**
 * The two "normalisers" of the unit disc at distance r from the centre:
 *   Wachspress type (twice the area of the dual ellipse):  2π / (1 − r²)^{3/2}
 *   mean value type (perimeter of the dual ellipse):       4 E(r²) / (1 − r²)
 * The dual of the disc about x is an ellipse with semi-axes 1/(1−r²), 1/√(1−r²).
 */
export const discDualArea2 = (r) => (2 * Math.PI) / Math.pow(1 - r * r, 1.5);
export const discDualPerimeter = (r) => (4 * ellipticE(r * r)) / (1 - r * r);

/**
 * Kernel of the Wachspress-type coordinates of a smooth convex set (Warren,
 * Schaefer, Hirani, Desbrun 2007), w = κ / (n·(v − x))², for the unit circle:
 * as a density in the angle θ of the boundary point v, normalised to
 * integrate to 1:   b(θ; x) = (1 − |x|²)^{3/2} / ( 2π (1 − v·x)² ).
 */
export function discKernel(theta, x) {
  const t = 1 - (Math.cos(theta) * x[0] + Math.sin(theta) * x[1]);
  return Math.pow(1 - x[0] * x[0] - x[1] * x[1], 1.5) / (2 * Math.PI * t * t);
}
