/**
 * dualmeasure.js — Figure 12 (later developments): the canonical function as
 * an integral over the dual, with a density.
 *
 *     C(x) = 2 ∫_dual  μ(y) dy / (1 + x·y)³
 *
 * For a polygon μ ≡ 1 on the dual polygon: this is the dual-volume formula
 * (3.10) of the paper. For a disc cut by a line, Mazzucchelli & Raman (2025)
 * show that the same formula holds with a density that is 1 outside the dual
 * disc and an arctangent inside it — a non-negative measure in place of a
 * volume.
 * Left: the region and the point x. Right: the dual region shaded by μ.
 * The read-out compares the closed formula with a numerical integral.
 */

import { Stage, seriesColor } from "../ui/stage.js";
import { sequentialRGB } from "../ui/ramp.js";
import { el, fmt, choiceGroup, slider } from "../ui/widgets.js";
import { regularPolygon, pointInConvex, clampIntoConvex } from "../math/polygon.js";
import { polygonCanonical, chordRegion, dualIntegral } from "../math/canonical.js";
import { polarDual } from "../math/barycentric.js";

const PENTAGON = regularPolygon(5, 1, Math.PI / 2 + 0.3);
const PENTAGON_DUAL = polarDual(PENTAGON, [0, 0]);
const DUAL_VIEW = { xmin: -2.4, xmax: 2.4, ymin: -1.5, ymax: 3.1 };
const STEP = 2;

export function initDualMeasure(root) {
  const state = { shape: "chord", a: 0.5, x: [0.2, 0.15] };
  const left = el("div"), right = el("div");
  const readout = el("p", { class: "readout", "aria-live": "polite" });
  const buffer = document.createElement("canvas");

  /** The current region: membership, dual membership, density, closed-form canonical function. */
  function region() {
    if (state.shape === "pentagon") {
      return {
        inside: (p) => pointInConvex(PENTAGON, p, 0.03),
        inDual: (y) => pointInConvex(PENTAGON_DUAL, y),
        density: () => 1,
        canonical: (x) => polygonCanonical(PENTAGON, x),
      };
    }
    const a = state.a;
    return {
      inside: (p) => p[0] * p[0] + p[1] * p[1] < 0.94 && p[1] > -a + 0.03,
      inDual: (y) => chordRegion.inDual(a, y),
      density: (y) => chordRegion.density(a, y),
      canonical: (x) => chordRegion.canonical(a, x),
    };
  }

  const primal = new Stage(left, {
    view: { xmin: -1.3, xmax: 1.3, ymin: -1.3, ymax: 1.3 }, aspect: 0.96, maxHeight: 400,
    label: "The region and the evaluation point x",
    draw(s) {
      if (state.shape === "pentagon") {
        s.poly(PENTAGON, { fill: s.color("fill-soft"), stroke: s.color("ink"), width: 2 });
      } else {
        // arc from the right end of the chord, over the top, to its left end; then the chord
        const a = state.a, t0 = -Math.asin(a), t1 = Math.PI + Math.asin(a), pts = [];
        for (let k = 0; k <= 120; k++) {
          const t = t0 + ((t1 - t0) * k) / 120;
          pts.push([Math.cos(t), Math.sin(t)]);
        }
        s.poly(pts, { fill: s.color("fill-soft"), stroke: s.color("ink"), width: 2 });
      }
      s.dot([0, 0], { r: 3, fill: s.color("axis") });
      s.text([0, 0], "0", { dx: -10, dy: 10, size: 12, color: s.color("ink-2") });
      s.knob(state.x, s.color("ink"), 6);
      s.text(state.x, "x", { dx: 12, dy: -12, size: 14 });
    },
  });
  primal.handles = () => [{
    pos: () => state.x,
    drag: (q) => { if (region().inside(q)) { state.x = q; update(); } },
  }];

  const dual = new Stage(right, {
    view: DUAL_VIEW, aspect: 0.96, maxHeight: 400,
    label: "The dual region, shaded by the density of the representing measure",
    draw(s) {
      const R = region();
      const w = Math.ceil(s.width / STEP), h = Math.ceil(s.height / STEP);
      buffer.width = w; buffer.height = h;
      const bctx = buffer.getContext("2d"), img = bctx.createImageData(w, h);
      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          const y = s.toWorld([(px + 0.5) * STEP, (py + 0.5) * STEP]);
          if (!R.inDual(y)) continue;
          // keep the lightest tone visible against the card: map μ ∈ [0,1] to [0.08, 1]
          const rgb = sequentialRGB(0.08 + 0.92 * R.density(y));
          const o = 4 * (py * w + px);
          img.data[o] = rgb[0]; img.data[o + 1] = rgb[1]; img.data[o + 2] = rgb[2]; img.data[o + 3] = 255;
        }
      }
      bctx.putImageData(img, 0, 0);
      s.ctx.imageSmoothingEnabled = false;
      s.ctx.drawImage(buffer, 0, 0, w * STEP, h * STEP);
      if (state.shape === "pentagon") {
        s.poly(PENTAGON_DUAL, { stroke: s.color("ink"), width: 1.5 });
      } else {
        const a = state.a, sq = Math.sqrt(1 - a * a), circle = [];
        for (let k = 0; k < 180; k++) circle.push([Math.cos((2 * Math.PI * k) / 180), Math.sin((2 * Math.PI * k) / 180)]);
        s.poly(circle, { stroke: s.color("ink"), width: 1.25 });
        s.line([sq, a], [0, 1 / a], { stroke: s.color("ink"), width: 1.25 });
        s.line([-sq, a], [0, 1 / a], { stroke: s.color("ink"), width: 1.25 });
        s.dot([0, 1 / a], { r: 4, fill: s.color("ink") });
        s.text([0, 1 / a], "dual of the cutting line", { dy: -14, size: 12 });
        s.text([0, (a + 1 / a) / 2], "μ = 1", { size: 12 });
      }
      s.dot([0, 0], { r: 3, fill: s.color("axis") });
    },
  });

  function update() {
    const R = region();
    if (!R.inside(state.x)) state.x = state.shape === "pentagon" ? clampIntoConvex(PENTAGON, state.x, 0.05) : [0, 0.2];
    const exact = R.canonical(state.x);
    const numeric = dualIntegral(R.inDual, R.density, state.x, DUAL_VIEW, 600);
    readout.innerHTML = `Closed formula: C(x) = <b>${fmt(exact, 2)}</b>. &nbsp; ` +
      `Numerical integral 2∫ μ(y) dy / (1 + x·y)³ over the dual ≈ <b>${fmt(numeric, 2)}</b>.`;
    primal.redraw();
    dual.redraw();
  }

  const aSlider = slider("Position of the cutting line", { min: 0.35, max: 0.9, step: 0.01, value: state.a },
    (v) => `y = −${fmt(v, 2)}`, (v) => { state.a = v; update(); });
  const choice = choiceGroup("Region",
    [{ value: "chord", label: "Disc cut by a line" }, { value: "pentagon", label: "Pentagon" }],
    state.shape, (v) => {
      state.shape = v;
      aSlider.node.style.visibility = v === "chord" ? "visible" : "hidden";
      update();
    });

  root.append(el("div", { class: "controls" }, choice.node, aSlider.node),
    el("div", { class: "fig-pair" },
      el("div", {}, el("div", { class: "plot-title" }, "Region and evaluation point x"), left),
      el("div", {}, el("div", { class: "plot-title" }, "Dual region, shaded by the density μ"), right)),
    el("div", { class: "legend" },
      el("span", { class: "key" }, el("i", { class: "ramp" }), "density μ from 0 to 1")),
    el("p", { class: "hint" }, "Drag the point x; move the cutting line with the slider."), readout);
  update();
}
