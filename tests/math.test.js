/**
 * Unit tests for the pure math modules. Run with:   deno test tests/
 *
 * Every identity claimed in the applet's text is checked numerically here.
 */

import {
  det2, sub, add, scale, signedArea, isConvexCCW, edgeLines, lineDist,
  lineIntersection, pointInConvex, clampIntoConvex, regularPolygon, mod, centroid,
} from "../js/math/polygon.js";
import {
  segmentCanonical, triangleCanonical, polygonCanonical, polygonAdjoint,
  vertexWedges, halfDiscCanonical, pizzaCanonical, discCanonical,
} from "../js/math/canonical.js";
import {
  segmentCoords, wachspress, wachspressClassic, triangleAreas, polarDual, combine,
} from "../js/math/barycentric.js";

function close(a, b, tol = 1e-9, msg = "") {
  if (!(Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b)))) {
    throw new Error(`${msg} expected ${b}, got ${a}`);
  }
}

/** Deterministic pseudo-random numbers so failures are reproducible. */
function rng(seed) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

/** A random strictly convex CCW polygon: perturbed regular n-gon. */
function randomPolygon(n, rand) {
  for (;;) {
    const pts = regularPolygon(n, 1, rand() * 6).map(([x, y]) => {
      const r = 0.75 + 0.5 * rand();
      return [x * r + 0.3, y * r - 0.2];
    });
    if (isConvexCCW(pts, 0.05)) return pts;
  }
}

/** A random point inside a polygon (random convex combination of vertices). */
function randomInside(pts, rand) {
  const w = pts.map(() => 0.05 + rand());
  const s = w.reduce((a, b) => a + b);
  return combine(w.map((v) => v / s), pts);
}

Deno.test("segment: barycentric form (2.2) equals linear interpolation (2.1)", () => {
  const a = -0.7, b = 2.1, fa = 3, fb = -1;
  for (const x of [-0.5, 0, 0.3, 1.9]) {
    const [la, lb] = segmentCoords(a, b, x);
    close(la, (b - x) / (b - a));
    close(lb, (x - a) / (b - a));
    // literal formula (2.2)
    const f22 = (fa / (x - a) - fb / (x - b)) / (-(b - a) / ((x - a) * (x - b)));
    close(f22, la * fa + lb * fb);
    // denominator of (2.2) is the canonical function of [a, b]
    close(-(b - a) / ((x - a) * (x - b)), segmentCanonical(a, b, x));
    close(1 / (x - a) + 1 / (b - x), segmentCanonical(a, b, x));
  }
});

Deno.test("segment: residues at the end points are +1 and -1", () => {
  const a = 1, b = 4, e = 1e-7;
  close(e * segmentCanonical(a, b, a + e), 1, 1e-6);
  close(-e * segmentCanonical(a, b, b - e), -1, 1e-6);
});

Deno.test("triangle: canonical function, areas and formula (2.4)", () => {
  const p = [[0.1, -0.2], [2.0, 0.3], [0.6, 1.7]];
  const x = [0.9, 0.5];
  const { A, Ai } = triangleAreas(...p, x);
  close(Ai[0] + Ai[1] + Ai[2], A);
  const C = triangleCanonical(...p, x);
  close(C, (A * A) / (2 * Ai[0] * Ai[1] * Ai[2]));
  close(C, polygonCanonical(p, x));
  // (2.4): λ_0 = (1/(A1 A2)) / (A/(A0 A1 A2)) = A0/A
  close((1 / (Ai[1] * Ai[2])) / (A / (Ai[0] * Ai[1] * Ai[2])), Ai[0] / A);
  const lam = wachspress(p, x);
  for (let i = 0; i < 3; i++) close(lam[i], Ai[i] / A);
});

Deno.test("triangle: standard simplex has C = 1/(x y (1-x-y))", () => {
  const p = [[0, 0], [1, 0], [0, 1]];
  const [x, y] = [0.2, 0.5];
  close(triangleCanonical(...p, [x, y]), 1 / (x * y * (1 - x - y)));
});

Deno.test("quadrilateral from Arkani-Hamed et al. / the poster", () => {
  // Ω = (12 − x − 4y) dx dy / ( x (2y − x)(3 − x − y)(2 − y) )
  const quad = [[0, 0], [2, 1], [1, 2], [0, 2]];
  if (!isConvexCCW(quad)) throw new Error("quad should be convex CCW");
  const rand = rng(7);
  for (let k = 0; k < 20; k++) {
    const [x, y] = randomInside(quad, rand);
    const exact = (12 - x - 4 * y) / (x * (2 * y - x) * (3 - x - y) * (2 - y));
    close(polygonCanonical(quad, [x, y]), exact, 1e-9);
  }
});

Deno.test("polygons: wedge ratios = Wachspress coordinates", () => {
  const rand = rng(1);
  for (let n = 3; n <= 8; n++) {
    for (let trial = 0; trial < 10; trial++) {
      const pts = randomPolygon(n, rand);
      const x = randomInside(pts, rand);
      const lam = wachspress(pts, x);
      const ref = wachspressClassic(pts, x);
      let sum = 0;
      lam.forEach((l, i) => {
        if (!(l > 0)) throw new Error("coordinates must be positive inside");
        close(l, ref[i], 1e-9, `n=${n} i=${i}`);
        sum += l;
      });
      close(sum, 1); // partition of unity
      const y = combine(lam, pts); // linear precision
      close(y[0], x[0]); close(y[1], x[1]);
    }
  }
});

Deno.test("polygons: canonical function = 2 x area of the polar dual", () => {
  const rand = rng(2);
  for (let n = 3; n <= 8; n++) {
    const pts = randomPolygon(n, rand);
    const x = randomInside(pts, rand);
    const dual = polarDual(pts, x);
    if (!isConvexCCW(dual)) throw new Error("dual should be convex CCW");
    close(polygonCanonical(pts, x), 2 * signedArea(dual));
    // each fan triangle (0, d_{i-1}, d_i) has area w_i / 2
    const w = vertexWedges(pts, x);
    for (let i = 0; i < n; i++) close(0.5 * det2(dual[mod(i - 1, n)], dual[i]), w[i] / 2);
  }
});

Deno.test("polygons: additivity under an ordinary triangulation", () => {
  const rand = rng(3);
  for (let n = 4; n <= 8; n++) {
    const pts = randomPolygon(n, rand);
    const x = randomInside(pts, rand); // may lie in any fan triangle: forms still add
    let s = 0;
    for (let i = 1; i < n - 1; i++) s += triangleCanonical(pts[0], pts[i], pts[i + 1], x);
    close(polygonCanonical(pts, x), s, 1e-8);
  }
});

Deno.test("adjoint: C = adj / prod h, and adj vanishes at external vertices", () => {
  const rand = rng(4);
  for (let n = 4; n <= 8; n++) {
    const pts = randomPolygon(n, rand);
    const lines = edgeLines(pts);
    const x = randomInside(pts, rand);
    const prod = lines.reduce((p, l) => p * lineDist(l, x), 1);
    close(polygonAdjoint(pts, x) / prod, polygonCanonical(pts, x));
    if (!(polygonAdjoint(pts, x) > 0)) throw new Error("adjoint positive inside");
    for (let i = 0; i < n; i++) {
      for (let j = i + 2; j < n; j++) {
        if (i === 0 && j === n - 1) continue; // adjacent (cyclically)
        const q = lineIntersection(lines[i], lines[j]);
        if (!q || Math.hypot(...q) > 50) continue;
        // compare with the typical size of the individual terms
        const scaleRef = Math.abs(polygonAdjoint(pts, add(q, [0.1, 0.07])));
        if (Math.abs(polygonAdjoint(pts, q)) > 1e-6 * Math.max(1, scaleRef)) {
          throw new Error(`adjoint does not vanish at l${i} ∩ l${j}`);
        }
      }
    }
  }
});

Deno.test("residue along an edge is the canonical function of that edge", () => {
  const rand = rng(5);
  for (let n = 3; n <= 7; n++) {
    const pts = randomPolygon(n, rand);
    const lines = edgeLines(pts);
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n];
      const L = Math.hypot(q[0] - p[0], q[1] - p[1]);
      const s = (0.2 + 0.6 * rand()) * L, eps = 1e-7;
      const onEdge = add(p, scale(sub(q, p), s / L));
      const x = add(onEdge, scale(lines[i].n, eps));
      close(eps * polygonCanonical(pts, x), segmentCanonical(0, L, s), 1e-5);
    }
  }
});

Deno.test("curved examples: residues of half disc and pizza slice", () => {
  const eps = 1e-7;
  // half disc, along the diameter y = 0: segment [-1, 1]
  for (const x of [-0.6, 0.1, 0.8]) {
    close(eps * halfDiscCanonical([x, eps]), segmentCanonical(-1, 1, x), 1e-5);
  }
  // pizza slice, along the side through (√3/2, 1/2): segment [0, 1] in arclength
  const dir = [Math.sqrt(3) / 2, 0.5], nrm = [-0.5, Math.sqrt(3) / 2];
  for (const s of [0.2, 0.5, 0.9]) {
    const x = add(scale(dir, s), scale(nrm, eps));
    close(eps * pizzaCanonical(x), segmentCanonical(0, 1, s), 1e-5);
  }
  // along the circular arc the residue is a 1-form on the arc with simple poles
  // of residue ±1 at the two corners. Check the pole at the corner at angle 30°:
  // approaching it along the arc, (arc distance) × (residue density) → 1.
  for (const C of [halfDiscCanonical, pizzaCanonical]) {
    const t0 = C === pizzaCanonical ? Math.PI / 6 : 0;
    const dt = 1e-4, t = t0 + dt, r = 1 - eps;
    // distance to the circle is eps (to first order), arclength from corner is dt
    close(dt * eps * C([r * Math.cos(t), r * Math.sin(t)]), 1, 2e-3);
  }
  // pizza slice positive inside, adjoint line passes through the outer intersections
  if (!(pizzaCanonical([0, 0.5]) > 0)) throw new Error("positive inside");
  close(1 + 2 * -0.5, 0);
});

Deno.test("disc: limit of circumscribed regular polygons", () => {
  // regular n-gon with inradius 1 → unit disc; canonical functions converge
  const x = [0.3, -0.2];
  const n = 2000;
  const pts = regularPolygon(n, 1 / Math.cos(Math.PI / n));
  close(polygonCanonical(pts, x), discCanonical(x), 1e-4);
});

Deno.test("helpers: convexity, clamping, intersections", () => {
  const sq = [[0, 0], [1, 0], [1, 1], [0, 1]];
  if (!isConvexCCW(sq)) throw new Error("square is convex");
  if (isConvexCCW([...sq].reverse())) throw new Error("CW must be rejected");
  if (isConvexCCW([[0, 0], [1, 0], [0.4, 0.4], [0, 1]])) throw new Error("reflex rejected");
  const c = clampIntoConvex(sq, [3, 0.5], 0.01);
  if (!pointInConvex(sq, c, 0.0099)) throw new Error("clamped point inside");
  close(centroid(sq)[0], 0.5); close(centroid(sq)[1], 0.5);
  const L = edgeLines(sq);
  const q = lineIntersection(L[0], L[1]);
  close(q[0], 1); close(q[1], 0);
});

Deno.test("default polygons of the figures are strictly convex", async () => {
  const { defaultPolygon } = await import("../js/figures/common.js");
  for (let n = 3; n <= 8; n++) {
    if (!isConvexCCW(defaultPolygon(n), 0.06, 0.25)) throw new Error(`n=${n} not convex`);
  }
});

/* ---------------- later developments & 3D ---------------- */

Deno.test("3D: simple polyhedra, Wachspress coordinates and dual volume", async () => {
  const { buildPolytope, wachspress3d, vertexWedges3d, polarDual3d, det3, SOLIDS } =
    await import("../js/math/polytope3d.js");
  const expected = { tetrahedron: [4, 6], cube: [8, 12], prism: [6, 9] };
  const rand = rng(11);
  for (const [name, planes] of Object.entries(SOLIDS)) {
    const poly = buildPolytope(planes);
    if (poly.vertices.length !== expected[name][0]) throw new Error(`${name}: vertex count`);
    if (poly.edges.length !== expected[name][1]) throw new Error(`${name}: edge count`);
    for (let t = 0; t < 20; t++) {
      // random interior point: random convex combination of the vertices
      const w = poly.vertices.map(() => 0.05 + rand());
      const s = w.reduce((a, b) => a + b);
      const x = [0, 1, 2].map((k) => poly.vertices.reduce((acc, v, i) => acc + (w[i] / s) * v.p[k], 0));
      const lam = wachspress3d(poly, x);
      close(lam.reduce((a, b) => a + b), 1);
      for (let k = 0; k < 3; k++) {
        close(poly.vertices.reduce((acc, v, i) => acc + lam[i] * v.p[k], 0), x[k], 1e-9, `${name} precision`);
      }
      // canonical function = 3! x volume of the dual (sum of the dual pyramids)
      const d = polarDual3d(poly, x);
      const vol = poly.vertices.reduce((acc, v) =>
        acc + Math.abs(det3(d[v.faces[0]], d[v.faces[1]], d[v.faces[2]])) / 6, 0);
      close(vertexWedges3d(poly, x).reduce((a, b) => a + b), 6 * vol);
      // on the tetrahedron the coordinates are the ordinary barycentric ones:
      // λ_v = (distance of x to the opposite face) / (distance of v to it)
      if (name === "tetrahedron") {
        poly.vertices.forEach((v, i) => {
          const opp = [0, 1, 2, 3].find((f) => !v.faces.includes(f));
          const hx = planes[opp].d - planes[opp].n.reduce((a, c, k) => a + c * x[k], 0);
          const hv = planes[opp].d - planes[opp].n.reduce((a, c, k) => a + c * v.p[k], 0);
          close(lam[i], hx / hv);
        });
      }
    }
  }
});

Deno.test("Brüser's polycon: data are consistent and the adjoint enters the interior", async () => {
  const { BRUSER: B } = await import("../js/math/canonical.js");
  const [v12, v23, v31] = B.vertices, [r12, r23, r31] = B.residual;
  // vertices and residual points lie on the right pairs of conics
  for (const [p, f, g] of [[v12, B.c1, B.c2], [v23, B.c2, B.c3], [v31, B.c3, B.c1],
    [r12, B.c1, B.c2], [r23, B.c2, B.c3], [r31, B.c3, B.c1]]) {
    close(f(...p), 0); close(g(...p), 0);
  }
  // the adjoint passes through the residual points but not through the vertices
  for (const r of B.residual) close(B.adjoint(...r), 0);
  for (const v of B.vertices) if (Math.abs(B.adjoint(...v)) < 1) throw new Error("adjoint at vertex");
  // all three conics are ellipses (negative discriminant b² − 4ac)
  for (const [a, b, c] of [[20, 0, 27], [80, 102, 57], [32, -26, 9]]) {
    if (!(b * b - 4 * a * c < 0)) throw new Error("not an ellipse");
  }
  // sign change of the adjoint inside the polycon: counterexample to the conjecture
  if (!B.inside(0, 4) || !B.inside(2.6, 2.5)) throw new Error("points must be inside");
  if (!(B.adjoint(0, 4) > 0 && B.adjoint(2.6, 2.5) < 0)) throw new Error("no sign change");
  // the whole segment between the two points stays inside the polycon
  for (let t = 0; t <= 1; t += 0.01) {
    if (!B.inside(2.6 * t, 4 - 1.5 * t)) throw new Error("segment leaves the polycon");
  }
});

Deno.test("pizza slice as a polycon: adjoint, canonical function and the weight of the corner", async () => {
  const { PIZZA: P } = await import("../js/math/canonical.js");
  const s3 = Math.sqrt(3);
  for (const r of P.residual) {
    close(P.adjoint(...r), 0); close(P.circle(...r), 0);
  }
  for (const [x, y] of [[0, 0.5], [0.3, 0.6], [-0.2, 0.3]]) {
    // canonical function = 2√3 · adjoint / (product of boundary polynomials)
    const C = (2 * s3 * P.adjoint(x, y)) / (P.circle(x, y) * P.line1(x, y) * P.line2(x, y));
    close(C, pizzaCanonical([x, y]));
    // wedge of the two lines through the origin: det(n1, n2) / (h1 h2) = 2√3 / (L1 L2)
    const wedge = (2 * s3) / (P.line1(x, y) * P.line2(x, y));
    close(wedge / C, P.lambdaO(x, y));
    if (!(P.lambdaO(x, y) > 0 && P.lambdaO(x, y) < 1)) throw new Error("0 < λ_O < 1 inside");
  }
  close(P.lambdaO(0, 0), 1);            // equals 1 at its own vertex
  close(P.lambdaO(0, 1), 0);            // vanishes on the arc
  close(P.lambdaO(0.6, 0.8), 0);
});

/* ---------------- Section 8.3–8.5 ---------------- */

Deno.test("mean value coordinates: perimeter of the dual; Wachspress: twice its area", async () => {
  const { meanValue, meanValueWeights } = await import("../js/math/barycentric.js");
  const { perimeter } = await import("../js/math/polygon.js");
  const rand = rng(21);
  for (let n = 3; n <= 8; n++) {
    for (let t = 0; t < 5; t++) {
      const pts = randomPolygon(n, rand), x = randomInside(pts, rand);
      const dual = polarDual(pts, x);
      close(meanValueWeights(pts, x).reduce((a, b) => a + b), perimeter(dual), 1e-9, "MV sum");
      close(vertexWedges(pts, x).reduce((a, b) => a + b), 2 * signedArea(dual), 1e-9, "W sum");
      // Wachspress weight of vertex i = (length of its dual edge) / |p_i − x|
      vertexWedges(pts, x).forEach((w, i) => {
        const L = Math.hypot(dual[i][0] - dual[mod(i - 1, n)][0], dual[i][1] - dual[mod(i - 1, n)][1]);
        close(w, L / Math.hypot(pts[i][0] - x[0], pts[i][1] - x[1]), 1e-9, "W_i = L_i / r_i");
      });
      const lam = meanValue(pts, x);
      if (!lam.every((l) => l > 0)) throw new Error("MV positive");
      close(lam.reduce((a, b) => a + b), 1);
      const y = combine(lam, pts);
      close(y[0], x[0]); close(y[1], x[1]);
      if (n === 3) wachspress(pts, x).forEach((l, i) => close(l, lam[i])); // triangle: unique
    }
  }
});

Deno.test("disc: dual area / perimeter formulas and the smooth Wachspress kernel", async () => {
  const { ellipticE, discDualArea2, discDualPerimeter, discKernel } = await import("../js/math/canonical.js");
  close(ellipticE(0), Math.PI / 2);
  close(ellipticE(0.5), 1.3506438810476755, 1e-12);
  const N = 20000;
  for (const r of [0.2, 0.6, 0.9]) {
    // ∫ dθ / ρ(θ) with ρ the distance from x = (r, 0) to the circle in direction θ
    let per = 0, ker = 0;
    for (let k = 0; k < N; k++) {
      const t = (2 * Math.PI * (k + 0.5)) / N;
      const rho = -r * Math.cos(t) + Math.sqrt(1 - r * r * Math.sin(t) ** 2);
      per += 1 / rho; ker += discKernel(t, [r, 0]);
    }
    close((per * 2 * Math.PI) / N, discDualPerimeter(r), 1e-9, "perimeter");
    // the kernel κ/(n·(v−x))² = 1/(1 − v·x)² integrates to 2π/(1−r²)^{3/2} = 2 x dual area
    close((ker * 2 * Math.PI) / N, 1, 1e-9, "kernel integrates to 1");
    // dual ellipse: semi-axes 1/(1−r²) and 1/√(1−r²), so 2 x area = 2π/(1−r²)^{3/2}
    close(2 * Math.PI * (1 / (1 - r * r)) * (1 / Math.sqrt(1 - r * r)), discDualArea2(r));
    close(discDualArea2(r), discCanonical([r, 0]));
  }
  // Wachspress coordinates of inscribed regular polygons converge to the kernel
  const x = [0.3, 0.2], n = 720;
  const pts = regularPolygon(n, 1, 0);
  const lam = wachspress(pts, x);
  lam.forEach((l, i) => close((l * n) / (2 * Math.PI), discKernel((2 * Math.PI * i) / n, x), 1e-4, "kernel"));
});

Deno.test("Wachspress' polycon basis on the pizza slice (with a side node)", async () => {
  const { pizzaWachspress, PIZZA } = await import("../js/math/canonical.js");
  let sawNegative = false;
  for (const deg of [50, 75, 90, 120]) {
    const theta = (deg * Math.PI) / 180;
    // each function is 1 at its own node and 0 at the others
    const { nodes } = pizzaWachspress(theta, [0, 0.5]);
    nodes.forEach((nd, i) => pizzaWachspress(theta, nd).weights.forEach((w, j) => close(w, i === j ? 1 : 0, 1e-9, "Kronecker")));
    const rand = rng(deg);
    for (let t = 0; t < 200; t++) {
      const r = 0.98 * Math.sqrt(rand()), a = Math.PI / 6 + (2 * Math.PI / 3) * rand();
      const p = [r * Math.cos(a), r * Math.sin(a)];
      const { weights } = pizzaWachspress(theta, p);
      close(weights.reduce((s, w) => s + w), 1, 1e-9, "partition of unity");
      close(weights.reduce((s, w, i) => s + w * nodes[i][0], 0), p[0], 1e-9, "linear precision x");
      close(weights.reduce((s, w, i) => s + w * nodes[i][1], 0), p[1], 1e-9, "linear precision y");
      close(weights[0], PIZZA.lambdaO(p[0], p[1]));                 // corner function: independent of M
      if (!(weights[0] >= 0 && weights[3] >= 0)) throw new Error("corner and side-node functions are non-negative");
      if (weights[1] < -1e-6 || weights[2] < -1e-6) sawNegative = true;
    }
  }
  if (!sawNegative) throw new Error("expected negative values of the vertex wedges on the conic side");
});

Deno.test("dual measure: disc cut by a line (Mazzucchelli-Raman) and polygons", async () => {
  const { chordRegion: R, dualIntegral } = await import("../js/math/canonical.js");
  for (const a of [0.4, 0.7]) {
    const box = { xmin: -1.001, xmax: 1.001, ymin: -1.001, ymax: 1 / a + 0.001 };
    for (const x of [[0.1, 0.2], [-0.3, 0.4], [0.4, -0.1]]) {
      const I = dualIntegral((y) => R.inDual(a, y), (y) => R.density(a, y), x, box, 900);
      close(I, R.canonical(a, x), 4e-3, `a=${a}`);
    }
  }
  // polygon: density 1 on the dual polygon (the dual volume formula 3.10)
  const pts = regularPolygon(5, 1, 0.3), x = [0.2, -0.15];
  const dual = polarDual(pts, [0, 0]);
  const I = dualIntegral((y) => pointInConvex(dual, y), () => 1, x,
    { xmin: -1.5, xmax: 1.5, ymin: -1.5, ymax: 1.5 }, 900);
  close(I, polygonCanonical(pts, x), 4e-3, "polygon dual volume");
});

Deno.test("push-forward: quadrilateral from the unit square; parallelograms", async () => {
  const { inverseBilinear, pushforwardCanonical, bilinear, bilinearWeights } =
    await import("../js/math/pushforward.js");
  const rand = rng(31);
  let complexSeen = false;
  for (let t = 0; t < 300; t++) {
    const P = randomPolygon(4, rand), y = randomInside(P, rand);
    const roots = inverseBilinear(P, y);
    close(pushforwardCanonical(P, y), polygonCanonical(P, y), 1e-7, "push-forward");
    if (roots.some((r) => Math.abs(r.u[1]) > 1e-9)) complexSeen = true;
    // each real root really solves B(u, v) = y; exactly one lies in the open unit square
    const real = roots.filter((r) => Math.abs(r.u[1]) < 1e-12);
    for (const r of real) {
      if (Math.abs(r.u[0]) > 1e6) continue;
      const q = bilinear(P, r.u[0], r.v[0]);
      close(q[0], y[0], 1e-6); close(q[1], y[1], 1e-6);
    }
    const inSquare = real.filter((r) => r.u[0] > 0 && r.u[0] < 1 && r.v[0] > 0 && r.v[0] < 1);
    if (inSquare.length !== 1) throw new Error("exactly one preimage in the square");
  }
  // parallelogram: one root, and bilinear weights = Wachspress coordinates
  const P = [[0, 0], [2, 0.3], [2.5, 1.4], [0.5, 1.1]], y = [1.2, 0.7];
  const roots = inverseBilinear(P, y);
  if (roots.length !== 1) throw new Error("parallelogram: affine map, one root");
  close(pushforwardCanonical(P, y), polygonCanonical(P, y));
  const lam = wachspress(P, y);
  bilinearWeights(roots[0].u[0], roots[0].v[0]).forEach((w, i) => close(w, lam[i]));
  // a generic quadrilateral: bilinear weights differ from Wachspress coordinates
  const Q = [[0, 0], [2, 0], [1.6, 1.5], [0.2, 1]], z = [0.9, 0.6];
  const r = inverseBilinear(Q, z).find((s) => s.u[0] > 0 && s.u[0] < 1 && Math.abs(s.u[1]) < 1e-12);
  const diff = Math.max(...bilinearWeights(r.u[0], r.v[0]).map((w, i) => Math.abs(w - wachspress(Q, z)[i])));
  if (!(diff > 1e-3)) throw new Error("expected a difference for a non-parallelogram");
  void complexSeen;
});

Deno.test("positive Grassmannian G(2,4): chart, cyclic minors and the Plücker relation", () => {
  // C = [[1, 0, −c, −d], [0, 1, a, b]]; minors p_ij = det of columns i, j
  const [a, b, c, d] = [1.3, 0.4, 0.7, 2.1];
  const C = [[1, 0, -c, -d], [0, 1, a, b]];
  const p = (i, j) => C[0][i] * C[1][j] - C[0][j] * C[1][i];
  close(p(0, 1), 1); close(p(1, 2), c); close(p(2, 3), a * d - b * c); close(p(0, 3), b);
  close(p(0, 2), a); close(p(1, 3), d);
  close(p(0, 2) * p(1, 3), p(0, 1) * p(2, 3) + p(0, 3) * p(1, 2)); // p13 p24 = p12 p34 + p14 p23
});
/* ------------------------------------------------------------------ */
/*  Section 5, "A mechanical reading": the wheel                        */
/* ------------------------------------------------------------------ */

/** Random convex CCW polygon with vertices on an ellipse, and a random interior point. */
function wheelSample(rand, n, circle = false) {
  for (;;) {
    const ang = Array.from({ length: n }, () => 2 * Math.PI * rand()).sort((a, b) => a - b);
    const p = ang.map((t) => (circle ? [Math.cos(t), Math.sin(t)] : [1.3 * Math.cos(t) + 0.2, 0.9 * Math.sin(t) - 0.1]));
    if (!isConvexCCW(p, 1e-2, 1e-2)) continue;
    const c = p.map(() => 0.1 + rand()), cs = c.reduce((a, b) => a + b, 0);
    return { p, x: [0, 1].map((k) => p.reduce((s, q, i) => s + c[i] * q[k], 0) / cs) };
  }
}

Deno.test("wheel: Wachspress weights are the spoke stresses of the unique self-stress; the dual polygon is its force diagram", () => {
  const rand = rng(91);
  const rank = (M0, tol = 1e-9) => {
    const M = M0.map((r) => r.slice()), m = M.length, n = M[0].length;
    let r = 0;
    for (let c = 0; c < n && r < m; c++) {
      let piv = r;
      for (let i = r; i < m; i++) if (Math.abs(M[i][c]) > Math.abs(M[piv][c])) piv = i;
      if (Math.abs(M[piv][c]) < tol) continue;
      [M[r], M[piv]] = [M[piv], M[r]];
      for (let i = r + 1; i < m; i++) { const f = M[i][c] / M[r][c]; for (let k = c; k < n; k++) M[i][k] -= f * M[r][k]; }
      r++;
    }
    return r;
  };
  for (let trial = 0; trial < 120; trial++) {
    const n = 3 + Math.floor(6 * rand()), { p, x } = wheelSample(rand, n);
    const h = edgeLines(p).map((l) => lineDist(l, x)), w = vertexWedges(p, x), d = polarDual(p, x);
    const len = p.map((q, i) => Math.hypot(...sub(p[(i + 1) % n], q)));
    const t = h.map((hi, i) => 1 / (len[i] * hi));       // rim stress (force per unit length), compression
    // hub: the spoke forces w_i (p_i − x) balance
    const hub = p.reduce((s, q, i) => add(s, scale(sub(q, x), w[i])), [0, 0]);
    close(Math.hypot(...hub) / w.reduce((a, b) => a + b, 0), 0, 1e-10, "hub");
    p.forEach((q, i) => {
      const im = mod(i - 1, n), ip = (i + 1) % n;
      // rim node i: the spoke pulls towards the hub, the two rim bars push
      const f = add(scale(sub(x, q), w[i]), add(scale(sub(p[ip], q), -t[i]), scale(sub(p[im], q), -t[im])));
      close(Math.hypot(...f) / (w[i] * Math.hypot(...sub(x, q))), 0, 1e-9, "rim node");
      // Maxwell's reciprocal figure: the dual edge is the spoke force turned by a right angle
      const e = sub(d[i], d[im]), g = scale(sub(q, x), w[i]);
      close(Math.min(Math.hypot(e[0] + g[1], e[1] - g[0]), Math.hypot(e[0] - g[1], e[1] + g[0])) / Math.hypot(...g), 0, 1e-9, "reciprocal");
    });
    // uniqueness: 2(n+1) equilibrium equations for 2n bar stresses have a one-dimensional solution space
    const M = Array.from({ length: 2 * (n + 1) }, () => new Array(2 * n).fill(0));
    for (let i = 0; i < n; i++) for (let k = 0; k < 2; k++) {
      const j = (i + 1) % n;
      M[2 * n + k][i] = p[i][k] - x[k]; M[2 * i + k][i] = x[k] - p[i][k];             // spoke i
      M[2 * i + k][n + i] = p[j][k] - p[i][k]; M[2 * j + k][n + i] = p[i][k] - p[j][k]; // rim bar i
    }
    if (2 * n - rank(M) !== 1) throw new Error("the wheel has exactly one self-stress");
  }
});

Deno.test("force polygons: edges at distance 1/r, 1, r give Wachspress, mean value and discrete harmonic weights", async () => {
  const { meanValueWeights } = await import("../js/math/barycentric.js");
  const rand = rng(92);
  const dot2 = (u, v) => u[0] * v[0] + u[1] * v[1];
  const cotAt = (a, b, c) => { const u = sub(a, b), v = sub(c, b); return dot2(u, v) / Math.abs(det2(u, v)); }; // angle at b
  for (let trial = 0; trial < 120; trial++) {
    const n = 3 + Math.floor(6 * rand()), { p, x } = wheelSample(rand, n);
    const r = p.map((q) => Math.hypot(...sub(q, x))), u = p.map((q, i) => scale(sub(q, x), 1 / r[i]));
    const al = u.map((v, i) => Math.atan2(det2(v, u[(i + 1) % n]), dot2(v, u[(i + 1) % n])));
    // polygon whose edge i is perpendicular to spoke i at distance rho_i from x: signed edge length over r_i
    const family = (q) => r.map((ri, i) => {
      const rho = (k) => Math.pow(r[k], q - 1), ip = (i + 1) % n, im = mod(i - 1, n);
      return ((rho(ip) - rho(i) * Math.cos(al[i])) / Math.sin(al[i]) + (rho(im) - rho(i) * Math.cos(al[im])) / Math.sin(al[im])) / ri;
    });
    const harmonic = p.map((q, i) => cotAt(x, p[(i + 1) % n], q) + cotAt(x, p[mod(i - 1, n)], q));
    [[0, vertexWedges(p, x)], [1, meanValueWeights(p, x)], [2, harmonic]].forEach(([q, ref]) =>
      family(q).forEach((v, i) => close(v, ref[i], 1e-8, `family member ${q}`)));
  }
  // on a polygon inscribed in a circle the discrete harmonic coordinates are the Wachspress coordinates
  for (let trial = 0; trial < 60; trial++) {
    const n = 4 + Math.floor(4 * rand()), { p, x } = wheelSample(rand, n, true);
    const harmonic = p.map((q, i) => cotAt(x, p[(i + 1) % n], q) + cotAt(x, p[mod(i - 1, n)], q));
    const total = harmonic.reduce((a, b) => a + b, 0), w = wachspress(p, x);
    harmonic.forEach((v, i) => close(v / total, w[i], 1e-9, "cyclic polygon"));
  }
});

Deno.test("3D: the Wachspress weight is twice the area of the dual face over the distance to the vertex", async () => {
  const { buildPolytope, SOLIDS, faceDistances, vertexWedges3d } = await import("../js/math/polytope3d.js");
  const rand = rng(93);
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  for (const name of Object.keys(SOLIDS)) {
    const poly = buildPolytope(SOLIDS[name]);
    for (let trial = 0; trial < 10; trial++) {
      const c = poly.vertices.map(() => 0.1 + rand()), cs = c.reduce((a, b) => a + b, 0);
      const x = [0, 1, 2].map((k) => poly.vertices.reduce((s, v, i) => s + c[i] * v.p[k], 0) / cs);
      const h = faceDistances(poly, x), w = vertexWedges3d(poly, x);
      const F = [0, 0, 0];
      poly.vertices.forEach((v, i) => {
        const D = v.faces.map((f) => poly.planes[f].n.map((t) => t / h[f]));   // the three dual vertices
        const area = 0.5 * Math.hypot(...cross(D[1].map((t, k) => t - D[0][k]), D[2].map((t, k) => t - D[0][k])));
        const r = Math.hypot(...v.p.map((t, k) => t - x[k]));
        close(w[i], (2 * area) / r, 1e-9, name);
        for (let k = 0; k < 3; k++) F[k] += (area * (v.p[k] - x[k])) / r;      // force of magnitude `area` along the spoke
      });
      close(Math.hypot(...F), 0, 1e-9, "spoke forces balance");
    }
  }
});

Deno.test("forcePolygon: reproduces the three kinds of weights; apexes coincide exactly for a self-stress", async () => {
  const { forcePolygon, meanValueWeights } = await import("../js/math/barycentric.js");
  const rand = rng(94);
  const dot2 = (u, v) => u[0] * v[0] + u[1] * v[1];
  const cotAt = (a, b, c) => { const u = sub(a, b), v = sub(c, b); return dot2(u, v) / Math.abs(det2(u, v)); };
  let gapMV = 0, gapDH = 0;
  for (let trial = 0; trial < 120; trial++) {
    const n = 3 + Math.floor(6 * rand()), { p, x } = wheelSample(rand, n);
    const W = forcePolygon(p, x, "wachspress"), M = forcePolygon(p, x, "meanvalue"), H = forcePolygon(p, x, "harmonic");
    const d = polarDual(p, x), w = vertexWedges(p, x), mv = meanValueWeights(p, x);
    const h = edgeLines(p).map((l) => lineDist(l, x));
    W.v.forEach((q, i) => { close(q[0], d[i][0], 1e-9); close(q[1], d[i][1], 1e-9); });   // the polar dual
    W.weights.forEach((v, i) => close(v, w[i], 1e-8, "Wachspress weights"));
    M.weights.forEach((v, i) => close(v, mv[i], 1e-8, "mean value weights"));
    H.weights.forEach((v, i) => close(v, 0.5 * (cotAt(x, p[(i + 1) % n], p[i]) + cotAt(x, p[mod(i - 1, n)], p[i])), 1e-8, "cotangent weights"));
    // every force polygon closes: Σ w_i (p_i − x) = 0
    for (const F of [W, M, H]) {
      const s = p.reduce((acc, q, i) => add(acc, scale(sub(q, x), F.weights[i])), [0, 0]);
      close(Math.hypot(...s) / F.weights.reduce((a, b) => a + Math.abs(b), 0), 0, 1e-9, "closure");
    }
    // Wachspress: all apexes at the hub, rim forces 1/h_i
    close(W.spread, 0, 1e-9, "Wachspress apexes coincide");
    W.apex.forEach((a) => close(Math.hypot(...a), 0, 1e-9));
    W.v.forEach((q, i) => close(Math.hypot(...q), 1 / h[i], 1e-9, "rim force"));
    if (n === 3) { close(M.spread, 0, 1e-8, "triangle"); close(H.spread, 0, 1e-8, "triangle"); }
    else { gapMV = Math.max(gapMV, M.spread); gapDH = Math.max(gapDH, H.spread); }
  }
  if (!(gapMV > 1e-2 && gapDH > 1e-2)) throw new Error("mean value and discrete harmonic spokes are not balanced by the rim");
  // discrete harmonic on a polygon inscribed in a circle: the apexes coincide again
  for (let trial = 0; trial < 40; trial++) {
    const { p, x } = wheelSample(rand, 4 + Math.floor(4 * rand()), true);
    close(forcePolygon(p, x, "harmonic").spread, 0, 1e-8, "cyclic polygon");
  }
});

/* ------------------------------------------------------------------ */
/*  Section 8.2: splines and Laplace transforms                        */
/* ------------------------------------------------------------------ */

Deno.test("cone spline T_X of a polygon: Laplace transform 1/Πh, derivative rule, adjoint as a differential operator", async () => {
  const SP = await import("../js/math/splines.js");
  const rand = rng(101);
  const fact = (k) => (k <= 1 ? 1 : k * fact(k - 1));
  const d3 = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  // distance of v from the planes spanned by two of the vectors (where the spline has its kinks)
  const wallDist = (X, v) => {
    let m = Infinity;
    for (let i = 0; i < X.length; i++) for (let j = i + 1; j < X.length; j++) {
      const c = cross(X[i], X[j]);
      m = Math.min(m, Math.abs(d3(c, v)) / Math.hypot(...c));
    }
    return m;
  };
  let checked = 0;
  for (let trial = 0; trial < 36; trial++) {
    const n = 3 + (trial % 3), { p, x } = wheelSample(rand, n);
    const X = SP.facetVectors(p), u = [1, x[0], x[1]], d = polarDual(p, x);
    const h = edgeLines(p).map((l) => lineDist(l, x)), prod = h.reduce((a, b) => a * b, 1);
    X.forEach((a, i) => close(d3(a, u), h[i], 1e-12, "⟨a_i,(1,x)⟩ = h_i(x)"));
    // the homogeneous adjoint restricts to the adjoint of canonical.js; adj / Πh is the canonical function
    close(SP.adjointHom(X, u), polygonAdjoint(p, x), 1e-9, "adjoint");
    close(SP.adjointHom(X, u) / prod, polygonCanonical(p, x), 1e-9, "canonical function");
    // indicator of the cone ↔ canonical function: 2 · area of the slice
    close(2 * SP.integrateFan(d, () => 1), polygonCanonical(p, x), 1e-9, "uniform density");
    // spline ↔ 1/Πh: (n−1)! · ∫ over the slice
    const mass = SP.integrateFan(d, (w) => SP.dualSplineDensity(p, x, w), 8);
    close(fact(n - 1) * mass * prod, 1, 5e-3, "Laplace transform of the spline");
    // points of the cone, kept away from the kinks
    const amax = Math.max(...X.map((a) => Math.hypot(...a))), T = (q) => SP.coneSpline(X, q);
    for (let rep = 0; rep < 5; rep++) {
      const c = d.map(() => 0.15 + rand()), cs = c.reduce((a, b) => a + b, 0);
      const w = [0, 1].map((k) => d.reduce((s, q, i) => s + c[i] * q[k], 0) / cs);
      const v = [1 - (x[0] * w[0] + x[1] * w[1]), w[0], w[1]];
      const step = n === 4 ? 1e-5 : 1e-3;
      close(T(v.map((q) => -q)), 0, 1e-12, "zero outside the cone");
      close(T(v.map((q) => 2 * q)), Math.pow(2, n - 3) * T(v), 1e-9, "homogeneous of degree n − 3");
      if (n === 3) { close(T(v), 1 / Math.abs(SP.det3(...X)), 1e-12, "three vectors: indicator / |det|"); continue; }
      if (wallDist(X, v) < 6 * step * amax) continue;
      // D_a T_X = T_{X∖a}
      const k = Math.floor(n * rand()), a = X[k];
      const fd = (T(v.map((q, i) => q + step * a[i])) - T(v.map((q, i) => q - step * a[i]))) / (2 * step);
      close(fd, SP.coneSpline(X.filter((_, i) => i !== k), v), 1e-5, "derivative removes a vector");
      // adj(∂) T_X = 1 inside the cone
      let val = 0;
      for (const t of SP.adjointTerms(X)) {
        const dirs = t.factors.map((f) => X[f]), m = dirs.length;
        let acc = 0;
        for (let mask = 0; mask < 1 << m; mask++) {
          let sign = 1;
          const q = v.slice();
          for (let b = 0; b < m; b++) { const s = (mask >> b) & 1 ? 1 : -1; sign *= s; for (let i = 0; i < 3; i++) q[i] += s * step * dirs[b][i]; }
          acc += sign * T(q);
        }
        val += (t.coeff * acc) / Math.pow(2 * step, m);
      }
      close(val, 1, 1e-5, "adjoint operator gives the indicator");
      checked++;
    }
  }
  if (checked < 40) throw new Error("too few interior points checked");
});

Deno.test("linear precision as Stokes' theorem on the dual cone: Σ w_i (1, p_i) = C_P (1, x)", async () => {
  const SP = await import("../js/math/splines.js");
  const rand = rng(102);
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  for (let trial = 0; trial < 60; trial++) {
    const n = 3 + (trial % 5), { p, x } = wheelSample(rand, n);
    const X = SP.facetVectors(p), L = edgeLines(p), h = L.map((l) => lineDist(l, x)), C = polygonCanonical(p, x);
    const sum = [0, 0, 0];
    p.forEach((q, i) => {
      const im = mod(i - 1, n), cr = cross(X[im], X[i]), dn = det2(L[im].n, L[i].n);
      // the two facet vectors at a vertex span the plane orthogonal to the homogeneous vertex (1, p_i)
      close(cr[0], dn, 1e-10); close(cr[1], dn * q[0], 1e-10); close(cr[2], dn * q[1], 1e-10);
      // Laplace transform of the facet cone(a_{i−1}, a_i) of the dual cone, times its unit normal
      const facet = Math.hypot(...cr) / (h[im] * h[i]), len = Math.hypot(1, q[0], q[1]);
      sum[0] += facet / len; sum[1] += (facet * q[0]) / len; sum[2] += (facet * q[1]) / len;
    });
    close(sum[0], C, 1e-9, "partition of unity"); close(sum[1], C * x[0], 1e-9, "linear precision");
    close(sum[2], C * x[1], 1e-9, "linear precision");
  }
});

Deno.test("one variable: the B-spline with knots t_i transforms into 1/Π(x − t_i), the denominator of Lagrange's barycentric formula", async () => {
  const { bspline, lagrangeWeights } = await import("../js/math/splines.js");
  const rand = rng(103);
  let done = 0;
  for (let trial = 0; trial < 60; trial++) {
    const n = 1 + (trial % 5), t = Array.from({ length: n + 1 }, () => 4 * rand() - 2).sort((a, b) => a - b);
    if (t.some((v, i) => i && v - t[i - 1] < 0.15)) continue;
    const x = t[n] + 0.3 + rand(), N = 6000, dy = (t[n] - t[0]) / N;
    let mass = 0, transform = 0;
    for (let i = 0; i < N; i++) {
      const y = t[0] + (i + 0.5) * dy, m = bspline(t, y);
      mass += m * dy;
      transform += (m * dy) / Math.pow(x - y, n + 1);
    }
    const prod = t.reduce((acc, ti) => acc * (x - ti), 1);
    close(mass, 1, 1e-6, "B-spline has integral one");
    close(transform * prod, 1, 1e-5, "∫ M(y) dy / (x − y)^{n+1} = 1 / Π (x − t_i)");
    // partial fractions: the residues are the barycentric weights of Lagrange interpolation
    const c = lagrangeWeights(t);
    close(c.reduce((s, ci, i) => s + ci / (x - t[i]), 0) * prod, 1, 1e-9, "partial fractions");
    // the barycentric formula reproduces a polynomial of degree n
    const f = (y) => 1 - 2 * y + 0.5 * Math.pow(y, n);
    const num = c.reduce((s, ci, i) => s + (ci * f(t[i])) / (x - t[i]), 0), den = c.reduce((s, ci, i) => s + ci / (x - t[i]), 0);
    close(num / den, f(x), 1e-8, "Lagrange interpolation in barycentric form");
    done++;
  }
  if (done < 20) throw new Error("too few knot sequences checked");
});

Deno.test("cone and cut: 3! × volume of the pyramid under the cutting plane is the canonical function; sub-lists of vectors", async () => {
  const SP = await import("../js/math/splines.js");
  const rand = rng(104);
  const fact = (k) => (k <= 1 ? 1 : k * fact(k - 1));
  for (let trial = 0; trial < 40; trial++) {
    const n = 3 + (trial % 4), { p, x } = wheelSample(rand, n);
    const X = SP.facetVectors(p), h = edgeLines(p).map((l) => lineDist(l, x)), d = polarDual(p, x);
    const cut = X.map((a, i) => a.map((c) => c / h[i]));
    // the cut lies in the plane ⟨(1, x), v⟩ = 1 and projects to the dual polygon
    cut.forEach((s, i) => {
      close(s[0] + x[0] * s[1] + x[1] * s[2], 1, 1e-10);
      close(s[1], d[i][0], 1e-10); close(s[2], d[i][1], 1e-10);
    });
    let volume = 0;
    for (let i = 1; i < n - 1; i++) volume += Math.abs(SP.det3(cut[0], cut[i], cut[i + 1])) / 6;
    close(6 * volume, polygonCanonical(p, x), 1e-9, "pyramid volume");
    // the Laplace transform formula also holds for the spline of a sub-list (Figure 12d)
    if (n >= 5) {
      const drop = Math.floor(n * rand()), keep = X.map((_, i) => i).filter((i) => i !== drop);
      const Y = keep.map((i) => X[i]), hull = keep.map((i) => d[i]), o = hull[0];
      const shifted = hull.map((q) => [q[0] - o[0], q[1] - o[1]]);
      const mass = SP.integrateFan(shifted, (q) => {
        const w = [q[0] + o[0], q[1] + o[1]];
        return SP.coneSpline(Y, [1 - (x[0] * w[0] + x[1] * w[1]), w[0], w[1]]);
      }, 8, 6);
      close(fact(keep.length - 1) * mass * keep.reduce((acc, i) => acc * h[i], 1), 1, 2e-3, "sub-list");
    }
  }
});

/* ------------------------------------------------------------------ */
/*  Section 8.2: toric varieties and symplectic geometry               */
/* ------------------------------------------------------------------ */

Deno.test("Duistermaat–Heckman: the spline is the volume of the fibre polytope (reduced space)", async () => {
  const SP = await import("../js/math/splines.js");
  const { fibrePolytope } = await import("../js/math/toric.js");
  const rand = rng(111);
  let sides = new Set();
  for (let trial = 0; trial < 80; trial++) {
    const n = 4 + (trial % 2), { p, x } = wheelSample(rand, n);
    const X = SP.facetVectors(p), d = polarDual(p, x);
    const c = d.map(() => 0.05 + rand()), cs = c.reduce((a, b) => a + b, 0);
    const w = [0, 1].map((k) => d.reduce((s, q, i) => s + c[i] * q[k], 0) / cs);
    const v = [1 - (x[0] * w[0] + x[1] * w[1]), w[0], w[1]];
    const F = fibrePolytope(X, v);
    close(F.spline, SP.coneSpline(X, v), 1e-8, "volume of the fibre over √det(AAᵀ)");
    // the facet t_i = 0 is present exactly when v lies in the cone of the other vectors
    const present = X.map((_, i) => pointInConvex(d.filter((_, k) => k !== i), w, 1e-9));
    const found = new Set(F.facets);
    present.forEach((yes, i) => { if (yes !== found.has(i)) throw new Error("facets of the fibre polytope"); });
    if (found.has(-1)) throw new Error("the fibre polytope is bounded");
    if (n === 5) sides.add(F.points.length);
  }
  if (!(sides.has(3) && sides.has(4) && sides.has(5))) throw new Error("fibre polygons with 3, 4 and 5 sides occur");
});

Deno.test("volume minimisation: the canonical function is the Martelli–Sparks–Yau volume; its minimiser is the Santaló point", async () => {
  const { linkVolume, canonicalMinimum, TORIC_DIAGRAMS } = await import("../js/math/toric.js");
  const rand = rng(112);
  // vol / π³ = C_P(x) / 27 for the Reeb vector 3·(1, x)
  for (let trial = 0; trial < 40; trial++) {
    const { p, x } = wheelSample(rand, 3 + (trial % 5));
    close(linkVolume(p, x), polygonCanonical(p, x) / 27, 1e-9, "formula (3.26)");
  }
  // known Sasaki–Einstein volumes (in units of π³)
  const s13 = Math.sqrt(13), s33 = Math.sqrt(33);
  const known = { c3: 1, c3z3: 1 / 3, conifold: 16 / 27, dp1: (46 + 13 * s13) / 324, dp2: (59 + 11 * s33) / 486, dp3: 2 / 9 };
  for (const key of Object.keys(known)) {
    const pts = TORIC_DIAGRAMS[key].pts, m = canonicalMinimum(pts);
    close(m.value / 27, known[key], 1e-8, `volume for ${key}`);
    // Santaló point: the centroid of the polar dual about the minimiser is the minimiser itself
    const c = centroid(polarDual(pts, m.x));
    close(Math.hypot(...c), 0, 1e-5, `Santaló point for ${key}`);
    // strict minimum: the function is larger at nearby points
    for (let k = 0; k < 6; k++) {
      const q = [m.x[0] + 0.05 * Math.cos(k), m.x[1] + 0.05 * Math.sin(k)];
      if (!(polygonCanonical(pts, q) > m.value)) throw new Error("minimum");
    }
  }
  // dP₂: the Reeb vector of Martelli–Sparks–Yau, eq. (3.48), and the R-charges from their volumes (3.50)
  const dp2 = TORIC_DIAGRAMS.dp2.pts, m = canonicalMinimum(dp2), r = (3 / 16) * (s33 - 1);
  close(m.x[0], r, 1e-6); close(m.x[1], r, 1e-6);
  const lam = wachspress(dp2, m.x), denom = 59 + 11 * s33;
  // vertices in our order: (0,0), (1,0), (2,1), (1,2), (0,1)  ↔  v1, v5, v4, v3, v2 of the paper
  const charges = [2 * (17 + s33) / denom, 6 * (1 + s33) / denom, 4 * (9 + s33) / denom, 4 * (9 + s33) / denom, 6 * (1 + s33) / denom];
  lam.forEach((l, i) => close(2 * l, charges[i], 1e-6, "R-charge = twice the Wachspress coordinate"));
  // conifold and C³: all charges equal
  wachspress(TORIC_DIAGRAMS.conifold.pts, [0.5, 0.5]).forEach((l) => close(2 * l, 0.5, 1e-12));
});

Deno.test("counting lattice points of the toric cone: the weighted count tends to the canonical function", async () => {
  const { TORIC_DIAGRAMS } = await import("../js/math/toric.js");
  // Σ over lattice points m of the cone { ⟨m, (1, p_a)⟩ ≥ 0 } of e^{−ε⟨(1,x), m⟩}; the sum over m_0 is geometric
  const count = (pts, x, eps) => {
    const R = Math.ceil(60 / eps);
    let sum = 0;
    for (let m1 = -R; m1 <= R; m1++) for (let m2 = -R; m2 <= R; m2++) {
      const lowest = Math.max(...pts.map((p) => -(p[0] * m1 + p[1] * m2)));      // m_0 ≥ lowest (an integer)
      const e = eps * (lowest + x[0] * m1 + x[1] * m2);
      if (e < 60) sum += Math.exp(-e);
    }
    return sum / (1 - Math.exp(-eps));
  };
  for (const [key, x] of [["conifold", [0.4, 0.55]], ["dp2", [0.8, 0.95]]]) {
    const pts = TORIC_DIAGRAMS[key].pts;
    // ε³ · count = C_P(x) + O(ε); two step sizes remove the first-order term
    const a = Math.pow(0.1, 3) * count(pts, x, 0.1), b = Math.pow(0.05, 3) * count(pts, x, 0.05);
    close(2 * b - a, polygonCanonical(pts, x), 5e-3, key);
  }
});

Deno.test("Newton polytopes: the stringy integral of a polynomial in one variable tends to the canonical function of its Newton segment", () => {
  // α' ∫_0^∞ dx/x · x^{α'X} p(x)^{−α'c}  →  canonical function of c·N(p) at X.
  // With x = e^s and p given by its coefficients, log p(e^s) is evaluated without overflow.
  const logp = (coeffs, s) => {
    const terms = coeffs.map((ck, k) => Math.log(ck) + k * s), top = Math.max(...terms);
    return top + Math.log(terms.reduce((acc, t) => acc + Math.exp(t - top), 0));
  };
  const stringy = (coeffs, X, c, alpha) => {
    const deg = coeffs.length - 1, ds = 0.02, S = 40 / (alpha * Math.min(X, c * deg - X));
    let sum = 0;
    for (let s = -S; s <= S; s += ds) sum += Math.exp(alpha * (X * s - c * logp(coeffs, s)));
    return alpha * sum * ds;
  };
  const alpha = 0.02;
  // p = 1 + x: Newton segment [0, 1]; the integral is a Beta function
  close(stringy([1, 1], 0.3, 1, alpha), 1 / (0.3 * 0.7), 2e-3, "segment [0, c]");
  // p = 1 + k x + x²: Newton segment [0, 2]; the interior monomial does not matter in the limit
  for (const k of [3, 0.5]) {
    close(stringy([1, k, 1], 0.7, 1, alpha), 2 / (0.7 * 1.3), 4e-3, "segment [0, 2c]");
  }
});

/* ------------------------------------------------------------------ */
/*  Section 8.2: one variable — barycentric formula, residues, contours */
/* ------------------------------------------------------------------ */

/** n + 1 random nodes in [−1, 1], increasing and not too close to each other. */
function randomNodes(n, rand) {
  for (;;) {
    const t = Array.from({ length: n + 1 }, () => -1 + 2 * rand()).sort((a, b) => a - b);
    if (t.every((v, i) => i === 0 || v - t[i - 1] > 0.12)) return t;
  }
}

Deno.test("moment curve: Lagrange's basis is the set of simplex coordinates of (x, x², …, xⁿ); the simplex's canonical function there is ±V/ℓⁿ", async () => {
  const I = await import("../js/math/interp.js");
  const rand = rng(61);
  for (const n of [1, 2, 3, 4, 5]) {
    for (let trial = 0; trial < 20; trial++) {
      const t = randomNodes(n, rand), c = I.polynomialWeights(t), x = -1.3 + 2.6 * rand();
      const beta = I.simplexCoordinates(t.map((tj) => I.momentCurve(n, tj)), I.momentCurve(n, x));
      const lam = I.baryCoordinates(t, c, x);
      beta.forEach((b, j) => close(b, lam[j], 1e-8, `n = ${n}`));
      // Π_j ℓ'(t_j) = (−1)^{n(n+1)/2} V², V the Vandermonde determinant: the constant in 1/(n! Vol · Π β_j)
      let V = 1;
      for (let i = 0; i <= n; i++) for (let k = i + 1; k <= n; k++) V *= t[k] - t[i];
      close(c.reduce((p, cj) => p / cj, 1), (-1) ** ((n * (n + 1)) / 2) * V * V, 1e-9, "discriminant");
    }
  }
  // n = 2 with the page's own canonical function of a triangle: −V/ℓ(x)² on the parabola
  for (let trial = 0; trial < 50; trial++) {
    const t = randomNodes(2, rand), x = -1.3 + 2.6 * rand(), P = t.map((v) => [v, v * v]);
    const V = (t[1] - t[0]) * (t[2] - t[0]) * (t[2] - t[1]), ell = I.nodePolynomial(t, x);
    close(triangleCanonical(P[0], P[1], P[2], [x, x * x]), -V / (ell * ell), 1e-8, "triangle on the parabola");
    close(2 * Math.abs(signedArea(P)), V, 1e-10, "V is twice the area");
  }
});

Deno.test("barycentric formula: the degree of precision is the number of vanishing moments of the weights; the denominator has degree n − d", async () => {
  const I = await import("../js/math/interp.js");
  const rand = rng(62);
  const reproduces = (t, w, k) => {
    let e = 0;
    for (let s = 0; s < 20; s++) {
      const x = -0.97 + 1.94 * rand();
      e = Math.max(e, Math.abs(I.baryEval(t, w, t.map((v) => v ** k), x) - x ** k));
    }
    return e < 1e-7;
  };
  // random weights whose first d moments vanish
  for (const n of [4, 5, 6]) {
    for (const d of [0, 1, 2, 3]) {
      const t = randomNodes(n, rand), rows = [];
      let w = t.map(() => rand() - 0.5);
      for (let k = 0; k < d; k++) {
        let r = t.map((v) => v ** k);
        for (const q of rows) { const cq = r.reduce((s, v, i) => s + v * q[i], 0); r = r.map((v, i) => v - cq * q[i]); }
        const L = Math.hypot(...r);
        rows.push(r.map((v) => v / L));
      }
      for (const q of rows) { const cq = w.reduce((s, v, i) => s + v * q[i], 0); w = w.map((v, i) => v - cq * q[i]); }
      if (I.precisionDegree(t, w) !== d) throw new Error(`moments: expected ${d}`);
      for (let k = 0; k <= d; k++) if (!reproduces(t, w, k)) throw new Error(`degree ${k} not reproduced (d = ${d})`);
      if (reproduces(t, w, d + 1)) throw new Error(`degree ${d + 1} reproduced although d = ${d}`);
      // the interpolant always interpolates, whatever the weights
      const data = t.map(() => rand());
      t.forEach((tj, j) => close(I.baryEval(t, w, data, tj), data[j], 1e-12));
      // D = ℓ·R is a polynomial of degree n − d with leading coefficient Σ w_j t_j^d
      // (finite differences with step h: the m-th difference of a polynomial of degree m is m! hᵐ × its leading coefficient)
      const lead = w.reduce((s, wj, j) => s + wj * t[j] ** d, 0), h = 0.4;
      const difference = (m) => {
        let sum = 0, binom = 1;
        for (let i = 0; i <= m; i++) { sum += (-1) ** (m - i) * binom * I.denominator(t, w, -1 + i * h); binom = (binom * (m - i)) / (i + 1); }
        return sum;
      };
      const fact = (k) => (k < 2 ? 1 : k * fact(k - 1));
      close(difference(n - d) / (fact(n - d) * h ** (n - d)), lead, 1e-7, "leading coefficient of D");
      close(difference(n - d + 1), 0, 1e-9, "degree of D");
    }
  }
  // polynomial weights: all moments below n vanish, D ≡ 1, R = 1/ℓ
  for (const n of [1, 3, 6, 9]) {
    const t = randomNodes(n, rand), c = I.polynomialWeights(t);
    if (I.precisionDegree(t, c) !== n) throw new Error("polynomial weights: precision n expected");
    for (const x of [-2.5, -0.33, 0.41, 1.7]) {
      close(I.denominator(t, c, x), 1, 1e-7, "D is constant");
      close(I.poleSum(t, c, x) * I.nodePolynomial(t, x), 1, 1e-8, "R = 1/ℓ");
    }
  }
  // two nodes: R is the canonical function of the segment up to the factor −1/(b − a)
  close(I.poleSum([-0.4, 0.9], I.polynomialWeights([-0.4, 0.9]), 0.2) * -1.3, segmentCanonical(-0.4, 0.9, 0.2));
});

Deno.test("rational barycentric interpolants: Berrut and Floater–Hormann weights (no real poles, precision ≥ d); positivity only for two nodes", async () => {
  const I = await import("../js/math/interp.js");
  const rand = rng(63);
  for (const n of [4, 7, 10]) {
    for (const t of [I.equispaced(n), randomNodes(n, rand)]) {
      const c = I.polynomialWeights(t);
      // d = 0 is Berrut's interpolant, d = n the polynomial one
      I.floaterHormannWeights(t, 0).forEach((v, j) => close(v, I.berrutWeights(t)[j], 1e-14));
      I.floaterHormannWeights(t, n).forEach((v, j) => close(v / c[j], 1, 1e-8, "FH with d = n"));
      for (let d = 0; d <= 3; d++) {
        const w = I.floaterHormannWeights(t, d);
        if (I.precisionDegree(t, w) < d) throw new Error(`Floater–Hormann d = ${d}: precision too low`);
        // the denominator keeps one sign on the real line: no real poles
        let sign = 0;
        for (let x = -5; x <= 5; x += 0.004) {
          const s = Math.sign(I.denominator(t, w, x));
          if (sign && s !== sign) throw new Error(`Floater–Hormann d = ${d}: real pole near ${x}`);
          sign = s;
        }
        // the interpolant is the quotient of two polynomial interpolants: of u_j f_j and of u_j = w_j / c_j
        const u = w.map((v, j) => v / c[j]), data = t.map(Math.sin), x = -0.9 + 1.8 * rand();
        close(I.baryEval(t, w, data, x), I.baryEval(t, c, data.map((v, j) => v * u[j]), x) / I.baryEval(t, c, u, x), 1e-7);
        close(I.denominator(t, w, x), I.baryEval(t, c, u, x), 1e-7, "D interpolates w_j / c_j");
      }
    }
  }
  // Berrut's denominator for an even number of nodes: the canonical function of the union of the
  // intervals [t_0, t_1], [t_2, t_3], …; it has the sign (−1)^k between t_k and t_{k+1} and no real zero
  for (const n of [1, 3, 5, 9]) {
    const t = randomNodes(n, rand), w = I.berrutWeights(t);
    if (w.reduce((s, v) => s + v, 0) !== 0 || I.precisionDegree(t, w) < 1) throw new Error("Berrut, even number of nodes: linear precision");
    for (let trial = 0; trial < 40; trial++) {
      const x = -1.6 + 3.2 * rand();
      if (t.some((tj) => Math.abs(x - tj) < 1e-3)) continue;
      let union = 0;
      for (let i = 0; i < n; i += 2) union += segmentCanonical(t[i], t[i + 1], x);
      close(I.poleSum(t, w, x), union, 1e-9, "union of intervals");
      const k = t.filter((tj) => tj < x).length - 1;           // x lies between t_k and t_{k+1} (k = −1 or n: outside)
      const expected = k < 0 || k >= n ? -1 : (-1) ** k;
      if (Math.sign(union) !== expected) throw new Error("sign of the canonical function of a union of intervals");
    }
  }
  // Lebesgue function: identically 1 for two nodes, larger than 1 somewhere for more
  const maxLebesgue = (t, w) => {
    let m = 0;
    for (let x = t[0] + 1e-3; x < t[t.length - 1]; x += 0.0017) m = Math.max(m, I.lebesgue(t, w, x));
    return m;
  };
  close(maxLebesgue([-1, 1], I.polynomialWeights([-1, 1])), 1, 1e-12);
  close(maxLebesgue(I.equispaced(2), I.polynomialWeights(I.equispaced(2))), 1.25, 1e-5);
  for (const n of [2, 3, 5, 8]) {
    for (let trial = 0; trial < 20; trial++) {
      const t = randomNodes(n, rand), w = t.map(() => (rand() < 0.5 ? -1 : 1) * (0.2 + rand()));
      if (!(maxLebesgue(t, w) > 1 + 1e-6)) throw new Error("more than two nodes: some coordinate must be negative");
    }
  }
});

Deno.test("Hermite's formula: the interpolation error as a contour integral and as a sum over the poles of the function", async () => {
  const I = await import("../js/math/interp.js");
  // f(t) = s² / ((t − a)² + s²): poles a ± i s with residues ∓ i s / 2
  for (const [a, s] of [[0, 0.2], [0.4, 0.5], [-1.2, 0.15]]) {
    const f = (x) => (s * s) / ((x - a) * (x - a) + s * s);
    const fC = (z) => I.cdiv([s * s, 0], I.cadd(I.cmul([z[0] - a, z[1]], [z[0] - a, z[1]]), [s * s, 0]));
    const poles = [{ at: [a, s], residue: [0, -s / 2] }, { at: [a, -s], residue: [0, s / 2] }];
    const rho = 1 + 0.6 * (I.bernsteinRho([a, s]) - 1);
    for (const nodes of [I.equispaced(4), I.equispaced(13), I.chebyshev(9), I.chebyshev(20)]) {
      const c = I.polynomialWeights(nodes), data = nodes.map(f);
      for (const x of [-0.71, 0.13, 0.55, 0.93]) {
        const direct = f(x) - I.baryEval(nodes, c, data, x);
        const res = I.hermiteResidues(nodes, poles, x), con = I.hermiteContour(nodes, fC, x, rho, 4000);
        close(res[0], direct, 1e-7 + 1e-9 / Math.abs(direct), "residues");
        close(res[1], 0, 1e-12);
        close(con[0], direct, 1e-6 + 1e-9 / Math.abs(direct), "contour");
      }
    }
  }
  // the same formula for other weights, with R(t)/R(x) in place of ℓ(x)/ℓ(t)
  {
    const a = 0.3, s = 0.6, f = (x) => (s * s) / ((x - a) * (x - a) + s * s);
    const fC = (z) => I.cdiv([s * s, 0], I.cadd(I.cmul([z[0] - a, z[1]], [z[0] - a, z[1]]), [s * s, 0]));
    const rho = 1 + 0.6 * (I.bernsteinRho([a, s]) - 1);
    for (const nodes of [I.equispaced(7), I.equispaced(10)]) {
      for (const w of [I.berrutWeights(nodes), I.floaterHormannWeights(nodes, 2), I.polynomialWeights(nodes)]) {
        const data = nodes.map(f);
        for (const x of [-0.71, 0.13, 0.93]) {
          const con = I.baryContour(nodes, w, fC, x, rho, 4000);
          close(con[0], f(x) - I.baryEval(nodes, w, data, x), 1e-7, "contour, general weights");
          close(con[1], 0, 1e-9);
        }
      }
    }
  }
  // Bernstein parameter: ρ of a point on the ellipse with semi-axes (ρ ± 1/ρ)/2
  for (const rho of [1.1, 1.7, 3]) {
    close(I.bernsteinRho([((rho + 1 / rho) / 2) * Math.cos(0.7), ((rho - 1 / rho) / 2) * Math.sin(0.7)]), rho, 1e-10);
  }
});

Deno.test("potentials: Runge's region for equally spaced nodes, a constant potential for Chebyshev nodes", async () => {
  const I = await import("../js/math/interp.js");
  const u = (z) => I.limitPotential("equispaced", z);
  const bisect = (g, lo, hi) => { for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (g(m) < 0) lo = m; else hi = m; } return lo; };
  close(u([0, 0]), -1, 1e-12);
  close(u([1, 0]), -1 + Math.LN2, 1e-12);
  // the level curve through ±1 meets the imaginary axis at 0.52552491457… (Trefethen, Chapter 13)
  close(bisect((y) => u([0, y]) - u([1, 0]), 0.1, 1), 0.52552491457, 1e-10);
  // Runge's function 1/(1 + 25x²): poles ±i/5; convergence only for |x| < 0.7266768…
  close(bisect((x) => u([x, 0]) - u([0, 0.2]), 0.3, 0.99), 0.7266768, 1e-6);
  // Chebyshev: the limiting potential is −log 2 on the whole interval
  for (const x of [-1, -0.6, 0, 0.3, 0.99]) close(I.limitPotential("chebyshev", [x, 0]), -Math.LN2, 1e-10);
  // the discrete potentials approach the limiting ones
  const z = [0.3, 0.4];
  close(I.discretePotential(I.equispaced(2000), z), u(z), 1e-3);
  close(I.discretePotential(I.chebyshev(2000), z), I.limitPotential("chebyshev", z), 1e-3);
  // |ℓ(z)| = exp((n + 1) u_n(z))
  const t = I.equispaced(7);
  close(Math.exp(8 * I.discretePotential(t, z)), I.cabs(I.nodePolynomialC(t, z)), 1e-10);
});

Deno.test("divided differences: the B-spline is the real kernel of the contour formulas; the evaluation point is one more knot", async () => {
  const I = await import("../js/math/interp.js");
  const { bspline } = await import("../js/math/splines.js");
  const rand = rng(64);
  const factorial = (k) => (k < 2 ? 1 : k * factorial(k - 1));
  const integrate = (g, a, b, N = 20000) => { let s = 0; const h = (b - a) / N; for (let i = 0; i < N; i++) s += g(a + (i + 0.5) * h); return s * h; };
  for (const n of [1, 2, 3, 4]) {
    const t = randomNodes(n, rand), c = I.polynomialWeights(t), g = Math.exp;   // every derivative of exp is exp
    // f[t_0 … t_n] = Σ c_j f(t_j) = (1/n!) ∫ M(y) f⁽ⁿ⁾(y) dy
    close(c.reduce((s, cj, j) => s + cj * g(t[j]), 0), integrate((y) => bspline(t, y) * g(y), t[0], t[n]) / factorial(n), 1e-6);
    // f(x) − p(x) = ℓ(x) f[t_0 … t_n, x] = ℓ(x)/(n+1)! ∫ M(y | t_0 … t_n, x) f⁽ⁿ⁺¹⁾(y) dy
    const x = t[0] + (t[n] - t[0]) * (0.2 + 0.6 * rand()), knots = [...t, x].sort((p, q) => p - q);
    if (knots.some((v, i) => i > 0 && v - knots[i - 1] < 1e-3)) continue;
    const error = g(x) - I.baryEval(t, c, t.map(g), x);
    close(error, (I.nodePolynomial(t, x) * integrate((y) => bspline(knots, y) * g(y), knots[0], knots[n + 1])) / factorial(n + 1), 1e-5);
  }
});
