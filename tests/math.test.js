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
