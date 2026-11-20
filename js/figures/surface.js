/**
 * surface.js — Figure 3: the canonical function of a region as a 3D "bowl".
 *
 * Reproduces Figures 2–3 of the paper interactively: the graph of the
 * canonical function C over a positive geometry rises to +∞ along the
 * boundary. The graph is cut off at an adjustable height so it can be drawn.
 *
 * Rendering is a deliberately simple software renderer: a quad mesh,
 * orthographic projection, painter's algorithm (far quads first). No WebGL.
 */

import { Stage } from "../ui/stage.js";
import { sequential } from "../ui/ramp.js";
import { el, choiceGroup, slider } from "../ui/widgets.js";
import { regularPolygon } from "../math/polygon.js";
import { polygonCanonical, halfDiscCanonical, pizzaCanonical } from "../math/canonical.js";

/* ---------- the regions on offer ---------- */

/** Sample a closed polygon boundary with `m` points per edge. */
function samplePolygon(pts, m) {
  const out = [];
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length];
    for (let k = 0; k < m; k++) out.push([p[0] + ((q[0] - p[0]) * k) / m, p[1] + ((q[1] - p[1]) * k) / m]);
  });
  return out;
}

/** Circular arc of the unit circle from angle t0 to t1 (m points, end excluded). */
function sampleArc(t0, t1, m) {
  const out = [];
  for (let k = 0; k < m; k++) {
    const t = t0 + ((t1 - t0) * k) / m;
    out.push([Math.cos(t), Math.sin(t)]);
  }
  return out;
}

const polygonRegion = (pts, m) => ({
  boundary: samplePolygon(pts, m),
  C: (x) => polygonCanonical(pts, x),
});

const S3 = Math.sqrt(3);

/**
 * Each region: closed boundary polyline (CCW), canonical function C, a TeX
 * formula for the canonical form, and a one-line description.
 */
const REGIONS = {
  triangle: {
    label: "Triangle",
    ...polygonRegion([[0, 0], [1, 0], [0, 1]], 40),
    tex: String.raw`\Omega=\frac{dx\,dy}{x\,y\,(1-x-y)}`,
    note: "A simplex: three boundary lines, constant numerator.",
  },
  quad: {
    label: "Quadrilateral",
    ...polygonRegion([[0, 0], [2, 1], [1, 2], [0, 2]], 30),
    tex: String.raw`\Omega=\frac{(12-x-4y)\,dx\,dy}{x\,(2y-x)\,(3-x-y)\,(2-y)}`,
    note: "A polytope: the numerator (the adjoint) is no longer constant.",
  },
  pentagon: {
    label: "Pentagon",
    ...polygonRegion(regularPolygon(5, 1), 24),
    tex: String.raw`\Omega=\sum_{i}\frac{\det(\mathbf n_{i-1},\mathbf n_i)}{h_{i-1}(\mathbf x)\,h_i(\mathbf x)}\,dx\,dy`,
    note: "Any convex polygon: one term per vertex (explained in Section 5).",
  },
  halfdisc: {
    label: "Half disc",
    boundary: [...sampleArc(0, Math.PI, 80), ...samplePolygon([[-1, 0], [1, 0]], 40).slice(0, 40)],
    C: halfDiscCanonical,
    tex: String.raw`\Omega=\frac{2\,dx\,dy}{(1-x^2-y^2)\,y}`,
    note: "A generalised simplex bounded by a conic and a line.",
  },
  pizza: {
    label: "Pizza slice",
    boundary: [...sampleArc(Math.PI / 6, (5 * Math.PI) / 6, 60),
      ...samplePolygon([[-S3 / 2, 0.5], [0, 0], [S3 / 2, 0.5]], 30).slice(0, 60)],
    C: pizzaCanonical,
    tex: String.raw`\Omega=\frac{2\sqrt3\,(1+2y)\,dx\,dy}{(1-x^2-y^2)(\sqrt3\,y+x)(\sqrt3\,y-x)}`,
    note: "A polycon (two lines and a conic); its adjoint is the line 1 + 2y = 0.",
  },
};

/* ---------- mesh construction ---------- */

const RINGS = 16;

/**
 * Build the bowl mesh for a region, cut off at height `cap`.
 * Returns { rows, base, center, size } where rows[j][k] = [x, y, z] with z = C / cap ∈ (0, 1],
 * j runs around the boundary and k from the centre (k = 0) to the rim.
 */
function buildMesh(region, capFactor) {
  const B = region.boundary;
  // interior reference point: average of the boundary samples
  const c = B.reduce((s, p) => [s[0] + p[0] / B.length, s[1] + p[1] / B.length], [0, 0]);
  const cap = capFactor * region.C(c);
  const rows = B.map((b) => {
    const along = (t) => [c[0] + t * (b[0] - c[0]), c[1] + t * (b[1] - c[1])];
    // C is convex along the ray and → ∞ at the boundary: bisect for C = cap
    let lo = 0, hi = 1;
    for (let it = 0; it < 50; it++) {
      const mid = 0.5 * (lo + hi);
      if (region.C(along(mid)) < cap) lo = mid; else hi = mid;
    }
    const row = [];
    for (let k = 0; k <= RINGS; k++) {
      const u = k / RINGS;
      const p = along(lo * (1 - Math.pow(1 - u, 1.7))); // denser near the rim
      row.push([p[0], p[1], Math.min(1, region.C(p) / cap)]);
    }
    return row;
  });
  // normalisation: centre of the bounding box and half of its larger side
  const xs = B.map((p) => p[0]), ys = B.map((p) => p[1]);
  const center = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
  const size = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2;
  return { rows, base: B, center, size };
}

/* ---------- the figure ---------- */

const Z_SCALE = 1.15; // height of the cut-off plane, in units of the region's half-size

export function initSurface(root) {
  const state = { region: "pentagon", cap: 5, az: 0.5, elev: 0.5 };
  let mesh = buildMesh(REGIONS[state.region], state.cap);

  const stageBox = el("div");
  const formula = el("div", { class: "formula" });
  const note = el("p", { class: "readout" });

  /** Orthographic projection of the normalised 3D point (x, y, z) → {s: [X, Y], depth}. */
  function project(p) {
    const x = (p[0] - mesh.center[0]) / mesh.size, y = (p[1] - mesh.center[1]) / mesh.size;
    const z = p[2] * Z_SCALE;
    const ca = Math.cos(state.az), sa = Math.sin(state.az);
    const ce = Math.cos(state.elev), se = Math.sin(state.elev);
    const xr = x * ca - y * sa, yr = x * sa + y * ca;
    return { s: [xr, yr * se + z * ce], depth: -yr * ce + z * se };
  }

  const stage = new Stage(stageBox, {
    view: { xmin: -1.45, xmax: 1.45, ymin: -0.85, ymax: 1.5 }, aspect: 0.62, maxHeight: 440,
    label: "3D graph of the canonical function, rising to infinity along the boundary",
    draw(s) {
      // the region itself, lying in the plane z = 0 underneath the graph
      s.poly(mesh.base.map((p) => project([p[0], p[1], 0]).s),
        { fill: s.color("fill-soft"), stroke: s.color("ink-2"), width: 1.5 });
      // collect quads, sort far → near, paint
      const P = mesh.rows.map((row) => row.map(project));
      const J = P.length, quads = [];
      for (let j = 0; j < J; j++) {
        const jn = (j + 1) % J;
        for (let k = 0; k < RINGS; k++) {
          const a = P[j][k], b = P[j][k + 1], c = P[jn][k + 1], d = P[jn][k];
          const A = mesh.rows[j][k], Bq = mesh.rows[j][k + 1], D = mesh.rows[jn][k];
          // Lambert-type shading from the (unnormalised) surface normal
          const u = [(Bq[0] - A[0]) / mesh.size, (Bq[1] - A[1]) / mesh.size, (Bq[2] - A[2]) * Z_SCALE];
          const v = [(D[0] - A[0]) / mesh.size, (D[1] - A[1]) / mesh.size, (D[2] - A[2]) * Z_SCALE];
          const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
          const len = Math.hypot(...n) || 1;
          const light = Math.abs(n[0] * 0.35 + n[1] * -0.45 + n[2] * 0.82) / len;
          quads.push({
            pts: [a.s, b.s, c.s, d.s],
            depth: (a.depth + b.depth + c.depth + d.depth) / 4,
            color: sequential((A[2] + Bq[2]) / 2, 0.72 + 0.28 * light),
          });
        }
      }
      quads.sort((q1, q2) => q1.depth - q2.depth);
      for (const q of quads) s.poly(q.pts, { fill: q.color, stroke: q.color, width: 0.6 });
    },
  });

  // drag anywhere on the canvas to rotate (horizontal: azimuth, vertical: elevation)
  const cv = stage.canvas;
  cv.style.touchAction = "pan-y";
  cv.style.cursor = "grab";
  let last = null;
  cv.addEventListener("pointerdown", (e) => { last = [e.clientX, e.clientY]; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener("pointermove", (e) => {
    if (!last) return;
    state.az += (e.clientX - last[0]) * 0.01;
    state.elev = Math.max(0.15, Math.min(1.35, state.elev + (e.clientY - last[1]) * 0.01));
    last = [e.clientX, e.clientY];
    stage.redraw();
  });
  const stop = () => { last = null; };
  cv.addEventListener("pointerup", stop);
  cv.addEventListener("pointercancel", stop);

  function update() {
    const r = REGIONS[state.region];
    mesh = buildMesh(r, state.cap);
    if (window.katex) window.katex.render(r.tex, formula, { displayMode: true, throwOnError: false });
    else formula.textContent = r.tex;
    note.textContent = r.note;
    stage.redraw();
  }

  const shapes = choiceGroup("Region",
    Object.entries(REGIONS).map(([value, r]) => ({ value, label: r.label })),
    state.region, (v) => { state.region = v; update(); });
  const cap = slider("Cut-off height", { min: 2, max: 14, step: 0.5, value: state.cap },
    (v) => `${v} × the value at the centre`, (v) => { state.cap = v; update(); });

  root.append(el("div", { class: "controls" }, shapes.node, cap.node), stageBox,
    el("p", { class: "hint" }, "Drag the picture to rotate it."), formula, note);
  update();
}
