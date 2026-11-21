/**
 * hermite.js — Figure 12l (added remark): Hermite's contour integral.
 *
 * Polynomial interpolation of
 *     f(t) = s² / ((t − a)² + s²),      poles at π = a + i s and its mirror image,
 * at n + 1 nodes in [−1, 1]. The error is a contour integral (math/interp.js),
 *     f(x) − p(x) = (1/2πi) ∮ ℓ(x) f(t) / (ℓ(t) (t − x)) dt,
 * and, moving the contour outwards, a sum over the two poles of f,
 *     f(x) − p(x) = Σ ρ ℓ(x) / (ℓ(π) (x − π)).
 * So the error at x is governed by |ℓ(x)| / |ℓ(π)|: it is small where the
 * "potential" log |ℓ| is lower at x than at the pole.
 *
 * Top:    the complex plane shaded by |ℓ|^(1/(n+1)), with the level curve
 *         through the pole and the contour of integration.
 * Bottom: f and its interpolant on [−1, 1]; the part of the interval where
 *         |ℓ(x)| < |ℓ(π)| is marked.
 */

import { Stage, seriesColor, withAlpha } from "../ui/stage.js";
import { sequentialRGB } from "../ui/ramp.js";
import { el, fmt, choiceGroup, slider } from "../ui/widgets.js";
import {
  equispaced, chebyshev, polynomialWeights, baryEval, nodePolynomial, nodePolynomialC, cabs,
  hermiteContour, hermiteResidues, bernsteinRho, discretePotential,
} from "../math/interp.js";

const PLANE = { xmin: -1.7, xmax: 1.7, ymin: -1.02, ymax: 1.02 };
const STEP = 3;                          // heat map: one sample per STEP css pixels
const U_RANGE = [-1.35, 0.45];           // range of the potential mapped to the colour ramp
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
/** Three significant digits, also for very small numbers. */
const sig = (v) => (Math.abs(v) >= 1e-3 && Math.abs(v) < 1e4 ? fmt(v) : v.toExponential(2).replace("-", "−"));

export function initHermite(root) {
  const state = { kind: "equispaced", n: 10, pole: [0, 0.2], x: 0.85 };
  const top = el("div"), bottom = el("div");
  const readout = el("div", { class: "readout", "aria-live": "polite" });
  const buffer = document.createElement("canvas");

  let nodes, weights, values;
  const f = (x) => { const [a, s] = state.pole; return (s * s) / ((x - a) * (x - a) + s * s); };
  /** f at a complex point: s² / ((z − a)² + s²). */
  const fC = (z) => {
    const [a, s] = state.pole, d = [z[0] - a, z[1]];
    const den = [d[0] * d[0] - d[1] * d[1] + s * s, 2 * d[0] * d[1]], m = den[0] * den[0] + den[1] * den[1];
    return [(s * s * den[0]) / m, (-s * s * den[1]) / m];
  };
  /** The two poles of f with their residues ∓ i s / 2. */
  const poles = () => {
    const [a, s] = state.pole;
    return [{ at: [a, s], residue: [0, -s / 2] }, { at: [a, -s], residue: [0, s / 2] }];
  };
  /** The contour: an ellipse with foci ±1 that passes between the interval and the poles. */
  const contourRho = () => 1 + 0.6 * (bernsteinRho(state.pole) - 1);

  function rebuild() {
    nodes = state.kind === "chebyshev" ? chebyshev(state.n) : equispaced(state.n);
    weights = polynomialWeights(nodes);
    values = nodes.map(f);
  }
  rebuild();

  const plane = new Stage(top, {
    view: PLANE, aspect: 0.6, maxHeight: 400,
    label: "The complex plane with the interpolation nodes, the poles of the function, a level curve and the contour of integration",
    draw(s) {
      const w = Math.ceil(s.width / STEP), h = Math.ceil(s.height / STEP);
      const u = new Float64Array(w * h), level = discretePotential(nodes, state.pole);
      buffer.width = w; buffer.height = h;
      const bctx = buffer.getContext("2d"), img = bctx.createImageData(w, h);
      for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
        const q = s.toWorld([(px + 0.5) * STEP, (py + 0.5) * STEP]), k = py * w + px;
        u[k] = discretePotential(nodes, q);
        const t = clamp((u[k] - U_RANGE[0]) / (U_RANGE[1] - U_RANGE[0]), 0, 1);
        const rgb = sequentialRGB(0.04 + 0.9 * t);
        img.data[4 * k] = rgb[0]; img.data[4 * k + 1] = rgb[1]; img.data[4 * k + 2] = rgb[2]; img.data[4 * k + 3] = 255;
      }
      bctx.putImageData(img, 0, 0);
      s.ctx.imageSmoothingEnabled = false;
      s.ctx.drawImage(buffer, 0, 0, w * STEP, h * STEP);

      // level curve through the pole, by marching squares on the sample grid
      const c = s.ctx;
      c.beginPath();
      const at = (px, py) => u[py * w + px] - level;
      const cut = (x0, y0, v0, x1, y1, v1) => {
        const t = v0 / (v0 - v1);
        return [(x0 + 0.5 + t * (x1 - x0)) * STEP, (y0 + 0.5 + t * (y1 - y0)) * STEP];
      };
      for (let py = 0; py < h - 1; py++) for (let px = 0; px < w - 1; px++) {
        const v = [at(px, py), at(px + 1, py), at(px + 1, py + 1), at(px, py + 1)];
        const corner = [[px, py], [px + 1, py], [px + 1, py + 1], [px, py + 1]], pts = [];
        for (let e = 0; e < 4; e++) {
          const a = e, b = (e + 1) % 4;
          if ((v[a] < 0) !== (v[b] < 0)) pts.push(cut(corner[a][0], corner[a][1], v[a], corner[b][0], corner[b][1], v[b]));
        }
        for (let k = 0; k + 1 < pts.length; k += 2) { c.moveTo(pts[k][0], pts[k][1]); c.lineTo(pts[k + 1][0], pts[k + 1][1]); }
      }
      c.lineWidth = 2; c.strokeStyle = seriesColor(1); c.setLineDash([]); c.stroke();

      // the contour of integration
      const rho = contourRho(), A = (rho + 1 / rho) / 2, B = (rho - 1 / rho) / 2, ell = [];
      for (let k = 0; k <= 160; k++) { const th = (2 * Math.PI * k) / 160; ell.push([A * Math.cos(th), B * Math.sin(th)]); }
      s.poly(ell, { stroke: s.color("ink"), width: 1.5, dash: [5, 4] });
      s.text([0, -B], "Γ", { dy: 12, size: 13 });

      s.line([PLANE.xmin, 0], [PLANE.xmax, 0], { stroke: withAlpha(s.color("ink"), 0.35), width: 1 });
      nodes.forEach((t) => s.dot([t, 0], { r: 3, fill: s.color("ink"), stroke: s.color("surface"), width: 1 }));
      const [a, im] = state.pole;
      s.dot([a, -im], { r: 6, fill: seriesColor(1), stroke: s.color("surface"), width: 2 });
      s.knob([a, im], seriesColor(1), 6);
      s.text([a, im], "pole of f", { dy: -16, size: 12 });
      s.knob([state.x, 0], s.color("ink"), 6);
      s.text([state.x, 0], "x", { dy: 16, size: 13 });
    },
  });
  plane.handles = () => [
    { pos: () => state.pole,
      drag: (q) => { state.pole = [clamp(q[0], -1.5, 1.5), clamp(Math.abs(q[1]), 0.06, 0.95)]; rebuild(); update(); } },
    { pos: () => [state.x, 0], drag: (q) => { state.x = clamp(q[0], -0.995, 0.995); update(); } },
  ];

  const plot = new Stage(bottom, {
    view: { xmin: -1.04, xmax: 1.04, ymin: -0.6, ymax: 1.6 },
    equal: false, aspect: 0.36, maxHeight: 250, pad: { l: 34, r: 12, t: 12, b: 26 },
    label: "The function and its polynomial interpolant on the interval from minus one to one",
    draw(s) {
      const v = s.view, level = discretePotential(nodes, state.pole);
      s.axes({ xticks: [-1, -0.5, 0, 0.5, 1].map((u) => [u, String(u)]), yticks: [-0.5, 0, 0.5, 1, 1.5].map((u) => [u, String(u)]) });
      s.clipped(() => {
        // where |ℓ(x)| < |ℓ(π)|: a band along the bottom of the plot
        const N = 520;
        for (let k = 0; k < N; k++) {
          const x0 = -1 + (2 * k) / N, x1 = -1 + (2 * (k + 1)) / N;
          if (discretePotential(nodes, [(x0 + x1) / 2, 0]) < level) {
            s.poly([[x0, v.ymin], [x1, v.ymin], [x1, v.ymin + 0.09], [x0, v.ymin + 0.09]], { fill: seriesColor(1) });
          }
        }
        const fp = [], pp = [];
        for (let k = 0; k <= N; k++) {
          const x = -1 + (2 * k) / N;
          fp.push([x, f(x)]);
          pp.push([x, clamp(baryEval(nodes, weights, values, x), -50, 50)]);
        }
        s.poly(fp, { stroke: s.color("ink"), width: 2, open: true });
        s.poly(pp, { stroke: seriesColor(0), width: 2, open: true });
        s.line([state.x, v.ymin], [state.x, v.ymax], { stroke: s.color("ink-2"), width: 1 });
        nodes.forEach((t, j) => s.dot([t, values[j]], { r: 3.5, fill: s.color("ink"), stroke: s.color("surface"), width: 1 }));
      });
      s.knob([state.x, v.ymin], s.color("ink"), 5);
    },
  });
  plot.handles = () => [{ pos: () => [state.x, plot.view.ymin], drag: (q) => { state.x = clamp(q[0], -0.995, 0.995); update(); } }];

  function update() {
    const { x } = state;
    const direct = f(x) - baryEval(nodes, weights, values, x);
    const res = hermiteResidues(nodes, poles(), x)[0];
    const con = hermiteContour(nodes, fC, x, contourRho(), 3000)[0];
    const ratio = Math.abs(nodePolynomial(nodes, x)) / cabs(nodePolynomialC(nodes, state.pole));
    let worst = 0;
    for (let k = 0; k <= 800; k++) { const u = -1 + k / 400; worst = Math.max(worst, Math.abs(f(u) - baryEval(nodes, weights, values, u))); }
    readout.innerHTML =
      `<table><thead><tr><th>error f(x) − p(x) at x = ${fmt(x, 2)}</th><th>value</th></tr></thead><tbody>` +
      `<tr><td>directly, from the barycentric formula</td><td><b>${sig(direct)}</b></td></tr>` +
      `<tr><td>contour integral over Γ (numerical)</td><td><b>${sig(con)}</b></td></tr>` +
      `<tr><td>sum over the two poles of f</td><td><b>${sig(res)}</b></td></tr></tbody></table>` +
      `<p>|ℓ(x)| / |ℓ(pole)| = <b>${sig(ratio)}</b>; &nbsp; largest error on [−1, 1]: <b>${sig(worst)}</b> ` +
      `(${state.n + 1} nodes, pole at ${fmt(state.pole[0], 2)} ± ${fmt(state.pole[1], 2)} i).</p>`;
    plane.redraw();
    plot.redraw();
  }

  const kind = choiceGroup("Nodes",
    [{ value: "equispaced", label: "Equally spaced" }, { value: "chebyshev", label: "Chebyshev" }], state.kind,
    (v) => { state.kind = v; rebuild(); update(); });
  const count = slider("Number of nodes", { min: 3, max: 31, step: 1, value: state.n + 1 }, (v) => String(v),
    (v) => { state.n = v - 1; rebuild(); update(); });

  root.append(el("div", { class: "controls" }, kind.node, count.node),
    el("div", { class: "plot-title" }, "The complex plane: size of the node polynomial ℓ"), top,
    el("div", { class: "legend" },
      el("span", { class: "key" }, el("i", { class: "ramp" }), "|ℓ|, from small to large (logarithmic)"),
      el("span", { class: "key" }, el("i", { style: "background:var(--series-2)" }), "level curve of |ℓ| through the pole"),
      el("span", { class: "key" }, el("i", { style: "background:var(--ink)" }), "contour Γ (dashed)")),
    el("div", { class: "plot-title" }, "On the interval: the function and its interpolant"), bottom,
    el("div", { class: "legend" },
      el("span", { class: "key" }, el("i", { style: "background:var(--ink)" }), "f"),
      el("span", { class: "key" }, el("i", { style: "background:var(--series-1)" }), "interpolating polynomial p"),
      el("span", { class: "key" }, el("i", { style: "background:var(--series-2); height:6px" }), "where |ℓ(x)| < |ℓ(pole)|")),
    el("p", { class: "hint" }, "Drag the pole in the upper half plane, or the point x on the real axis."),
    readout);
  update();
}
