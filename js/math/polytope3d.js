/**
 * polytope3d.js — Wachspress coordinates and polar duals of SIMPLE convex
 * polyhedra (every vertex lies on exactly three faces).
 *
 * A polyhedron is given by its face planes  n_f · x ≤ d_f  with OUTWARD unit
 * normals n_f. With h_f(x) = d_f − n_f · x (distance from x to face f):
 *
 *   wedge function of a vertex v on faces a, b, c (the cone they bound):
 *        w_v(x) = |det(n_a, n_b, n_c)| / ( h_a h_b h_c )
 *   canonical function:   C_P = Σ_v w_v  =  3! · Vol( polar dual of P about x )
 *   coordinates:          λ_v = w_v / C_P
 *
 * exactly as in the plane (canonical.js / barycentric.js), one dimension up.
 * Points are arrays [x, y, z].
 */

export const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const det3 = (a, b, c) =>
  a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/**
 * Build the combinatorics of a simple polyhedron from its planes.
 * @param {{n:number[], d:number}[]} planes  outward unit normals and offsets
 * @returns {{planes, vertices:{p:number[], faces:number[]}[], edges:number[][], faceLoops:number[][]}}
 *   vertices[i].faces — the three faces through vertex i;
 *   edges             — pairs of vertex indices sharing two faces;
 *   faceLoops[f]      — the vertices of face f in cyclic order.
 */
export function buildPolytope(planes) {
  const F = planes.length, vertices = [];
  for (let a = 0; a < F; a++) for (let b = a + 1; b < F; b++) for (let c = b + 1; c < F; c++) {
    const na = planes[a].n, nb = planes[b].n, nc = planes[c].n;
    const D = det3(na, nb, nc);
    if (Math.abs(D) < 1e-9) continue;
    // Cramer's rule for the intersection point of the three planes
    const bc = cross(nb, nc), ca = cross(nc, na), ab = cross(na, nb);
    const p = [0, 1, 2].map((k) =>
      (planes[a].d * bc[k] + planes[b].d * ca[k] + planes[c].d * ab[k]) / D);
    if (planes.every((pl) => dot3(pl.n, p) <= pl.d + 1e-9)) vertices.push({ p, faces: [a, b, c] });
  }
  const edges = [];
  for (let i = 0; i < vertices.length; i++) for (let j = i + 1; j < vertices.length; j++) {
    if (vertices[i].faces.filter((f) => vertices[j].faces.includes(f)).length === 2) edges.push([i, j]);
  }
  const faceLoops = planes.map((pl, f) => {
    const idx = vertices.map((v, i) => i).filter((i) => vertices[i].faces.includes(f));
    // sort the face's vertices by angle around its centre, in the face plane
    const c = [0, 1, 2].map((k) => idx.reduce((s, i) => s + vertices[i].p[k], 0) / idx.length);
    const u = [0, 1, 2].map((k) => vertices[idx[0]].p[k] - c[k]);
    const v = cross(pl.n, u);
    const ang = (i) => {
      const r = [0, 1, 2].map((k) => vertices[i].p[k] - c[k]);
      return Math.atan2(dot3(r, v), dot3(r, u));
    };
    return idx.sort((i, j) => ang(i) - ang(j));
  });
  return { planes, vertices, edges, faceLoops };
}

/** Distances h_f(x) from an interior point x to all face planes. */
export const faceDistances = (poly, x) => poly.planes.map((pl) => pl.d - dot3(pl.n, x));

/** Wedge functions w_v(x), one per vertex (unnormalised Wachspress weights). */
export function vertexWedges3d(poly, x) {
  const h = faceDistances(poly, x);
  return poly.vertices.map(({ faces: [a, b, c] }) =>
    Math.abs(det3(poly.planes[a].n, poly.planes[b].n, poly.planes[c].n)) / (h[a] * h[b] * h[c]));
}

/** Wachspress coordinates λ_v(x) of an interior point. */
export function wachspress3d(poly, x) {
  const w = vertexWedges3d(poly, x);
  const sum = w.reduce((s, v) => s + v, 0);
  return w.map((v) => v / sum);
}

/** Vertices of the polar dual about x: one per face, d_f = n_f / h_f(x). */
export function polarDual3d(poly, x) {
  const h = faceDistances(poly, x);
  return poly.planes.map((pl, f) => pl.n.map((c) => c / h[f]));
}

/* ---------- the example solids ---------- */

const unit = (v) => { const l = Math.hypot(...v); return v.map((c) => c / l); };
const C30 = Math.cos(Math.PI / 6);

export const SOLIDS = {
  tetrahedron: [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map((n) => ({ n: unit(n), d: 0.5 })),
  cube: [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].map((n) => ({ n, d: 0.8 })),
  prism: [
    { n: [0, 0, 1], d: 0.8 }, { n: [0, 0, -1], d: 0.8 },
    { n: [0, 1, 0], d: 0.55 }, { n: [-C30, -0.5, 0], d: 0.55 }, { n: [C30, -0.5, 0], d: 0.55 },
  ],
};
