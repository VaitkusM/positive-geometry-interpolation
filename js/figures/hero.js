/**
 * hero.js — the teaser illustration at the top of the page and on the first slide.
 *
 * One picture for the whole argument: the canonical function of a pentagon,
 *        C(x) = Σ_i det(n_{i−1}, n_i) / (h_{i−1}(x) h_i(x)) = adj(x) / Π_i h_i(x),
 * drawn over the whole plane and not only inside the polygon.
 *   - It is infinite on the five edge lines (its poles) and changes sign there.
 *   - It vanishes on the adjoint conic, which passes through the five points
 *     where two non-adjacent edge lines cross.
 *   - Inside the pentagon it is positive.
 * The colour shows the sign (two hues) and the size (bands of log |C|).
 * On top: a point x of the pentagon and its Wachspress coordinates, drawn as
 * spokes whose widths are proportional to λ_i. The point can be dragged.
 *
 * The <figure> may carry data-aspect="…" (height / width of the canvas); the
 * slides use it for a squarer picture.
 */

import { Stage, cssColor } from "../ui/stage.js";
import { el } from "../ui/widgets.js";
import { edgeLines, lineIntersection, det2, mod, regularPolygon, clampIntoConvex } from "../math/polygon.js";
import { polygonAdjoint } from "../math/canonical.js";
import { wachspress } from "../math/barycentric.js";
import { zeroSet, strokeSegments } from "../ui/contour.js";

/** World rectangle that must be visible: the pentagon and its five outer crossing points. */
const VIEW = { xmin: -2.9, xmax: 3.0, ymin: -2.95, ymax: 3.1 };
const BANDS = 9;                 // number of colour bands per sign
const LOG_MIN = -0.9, LOG_MAX = 1.9; // log10 |C| at the faintest and the strongest band
const GRID = 260;                // marching-squares cells across the canvas for the conic

/** A slightly irregular pentagon: regular enough for the star, irregular enough to be generic. */
function heroPolygon() {
  return regularPolygon(5, 1, Math.PI / 2 + 0.12).map(([x, y], i) => {
    const r = 1 + 0.07 * Math.sin(2.3 * i + 0.7);
    return [x * r, y * r];
  });
}

/** "#rrggbb" → [r, g, b]. */
function rgb(hex) {
  const v = parseInt(hex.replace("#", ""), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

export function initHero(root) {
  const figure = root.closest("figure");
  const aspect = Number(figure && figure.dataset.aspect) || 0.46;
  const state = { pts: heroPolygon(), x: [0.22, -0.12] };
  const lines = edgeLines(state.pts), n = lines.length;
  const dets = lines.map((l, i) => det2(lines[mod(i - 1, n)].n, l.n));

  /** The canonical function at (x, y), anywhere in the plane (±Infinity on the edge lines). */
  const h = new Float64Array(n);
  function canonical(x, y) {
    for (let i = 0; i < n; i++) h[i] = lines[i].n[0] * (x - lines[i].p[0]) + lines[i].n[1] * (y - lines[i].p[1]);
    let s = 0;
    for (let i = 0; i < n; i++) s += dets[i] / (h[i === 0 ? n - 1 : i - 1] * h[i]);
    return s;
  }

  // outer crossing points: intersections of two non-adjacent edge lines
  const crossings = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const q = lineIntersection(lines[i], lines[j]);
      if (q) crossings.push(q);
    }
  }

  /* The coloured field is painted once per canvas size and colour scheme into
     an off-screen buffer; dragging x only redraws what lies on top of it. */
  const field = document.createElement("canvas");
  let fieldKey = "", conic = [];

  function paintField(s) {
    const scale = Math.min(2, s.canvas.width / s.width);   // buffer pixels per CSS pixel
    const w = Math.max(1, Math.round(s.width * scale)), ht = Math.max(1, Math.round(s.height * scale));
    const bg = cssColor("bg"), plus = cssColor("series-1"), minus = cssColor("series-2");
    const key = [w, ht, bg, plus, minus].join("|");
    if (key === fieldKey) return;
    fieldKey = key;
    field.width = w;
    field.height = ht;
    const ctx = field.getContext("2d"), img = ctx.createImageData(w, ht);
    const cBg = rgb(bg), cPlus = rgb(plus), cMinus = rgb(minus);
    // pixel → world is affine: one origin and one step per axis
    const o = s.toWorld([0, 0]), e = s.toWorld([1, 1]);
    const dx = (e[0] - o[0]) / scale, dy = (e[1] - o[1]) / scale;
    for (let py = 0; py < ht; py++) {
      const y = o[1] + (py + 0.5) * dy;
      for (let px = 0; px < w; px++) {
        const c = canonical(o[0] + (px + 0.5) * dx, y);
        let t = (Math.log10(Math.abs(c)) - LOG_MIN) / (LOG_MAX - LOG_MIN);
        t = !(t > 0) ? 0 : t >= 1 ? 1 : Math.ceil(t * BANDS) / BANDS;   // bands; NaN counts as 0
        const hue = c > 0 ? cPlus : cMinus, a = 0.9 * t, k = 4 * (py * w + px);
        img.data[k] = cBg[0] + a * (hue[0] - cBg[0]);
        img.data[k + 1] = cBg[1] + a * (hue[1] - cBg[1]);
        img.data[k + 2] = cBg[2] + a * (hue[2] - cBg[2]);
        img.data[k + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    // the adjoint conic, traced over everything that is visible
    const a = s.toWorld([0, s.height]), b = s.toWorld([s.width, 0]);
    conic = zeroSet((x, y) => polygonAdjoint(state.pts, [x, y]),
      { xmin: a[0], xmax: b[0], ymin: a[1], ymax: b[1] }, GRID);
  }

  const box = el("div", { class: "hero-canvas" });
  const stage = new Stage(box, {
    view: VIEW, aspect, maxHeight: 640,
    label: "The canonical function of a pentagon over the whole plane: infinite on the five edge lines, " +
      "zero on a conic through the five outer crossing points, positive inside the pentagon. " +
      "A point inside is joined to the vertices by spokes whose widths are its barycentric coordinates.",
    draw(s) {
      const { pts, x } = state, c = s.ctx;
      const ink = s.color("ink"), surface = s.color("surface");
      paintField(s);
      c.imageSmoothingEnabled = true;
      c.drawImage(field, 0, 0, s.width, s.height);

      // the five pole lines and the conic of zeros
      lines.forEach((l) => s.fullLine(l, { stroke: ink, width: 1 }));
      strokeSegments(s, conic, surface, 4.5);
      strokeSegments(s, conic, ink, 1.75);
      for (const q of crossings) { s.dot(q, { r: 6, fill: surface }); s.dot(q, { r: 3.5, fill: ink }); }

      // the pentagon, the point x and its coordinates
      s.poly(pts, { stroke: surface, width: 5.5 });
      s.poly(pts, { stroke: ink, width: 2.5 });
      const lambda = wachspress(pts, x);
      pts.forEach((p, i) => s.line(x, p, { stroke: surface, width: 3 + 22 * lambda[i] }));
      pts.forEach((p, i) => s.line(x, p, { stroke: ink, width: 1 + 22 * lambda[i] }));
      pts.forEach((p, i) => s.knob(p, ink, 4 + 9 * Math.sqrt(lambda[i])));
      s.knob(x, surface, 8);
      s.dot(x, { r: 4, fill: ink });
    },
  });

  stage.handles = () => [{
    pos: () => state.x,
    drag: (q) => { state.x = clampIntoConvex(state.pts, q, 0.06); },
  }];

  root.append(box);
}
