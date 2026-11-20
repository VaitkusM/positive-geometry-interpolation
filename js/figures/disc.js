/**
 * disc.js — Figure 8: why a disc is not a positive geometry (open problem 5.2).
 *
 * Log–log plot of the canonical function against the distance h to the
 * boundary, for
 *   - a regular n-gon circumscribed about the unit circle (approaching the
 *     middle of an edge): a SIMPLE POLE, C ~ 1/h, slope −1;
 *   - the unit disc, C = 2π / (1 − r²)^{3/2}: a BRANCH POINT, C ~ h^{−3/2}.
 * As n grows the polygon curve follows the disc curve further and further,
 * but always bends back to slope −1 close enough to the boundary.
 */

import { Stage, seriesColor } from "../ui/stage.js";
import { el, fmt, slider } from "../ui/widgets.js";
import { regularPolygon } from "../math/polygon.js";
import { polygonCanonical, discCanonical } from "../math/canonical.js";

const N_VALUES = [3, 4, 6, 10, 20, 50, 100, 300];
const LOG_H = [-4, 0];     // range of log10(h)
const LOG_C = [0.5, 7];    // range of log10(C)

export function initDisc(root) {
  const state = { idx: 2, hover: null };
  const box = el("div");
  const readout = el("p", { class: "readout", "aria-live": "polite" });

  /** Canonical function of the circumscribed regular n-gon at distance h from an edge midpoint. */
  function polygonCurve(n) {
    const phase = 0.3;
    const pts = regularPolygon(n, 1 / Math.cos(Math.PI / n), phase);
    const t = phase + Math.PI / n; // direction of the midpoint of edge 0
    return (h) => polygonCanonical(pts, [(1 - h) * Math.cos(t), (1 - h) * Math.sin(t)]);
  }
  const discCurve = (h) => discCanonical([1 - h, 0]);

  const stage = new Stage(box, {
    view: { xmin: LOG_H[0], xmax: LOG_H[1], ymin: LOG_C[0], ymax: LOG_C[1] },
    equal: false, aspect: 0.5, maxHeight: 380, pad: { l: 46, r: 14, t: 24, b: 40 },
    label: "Log-log plot: canonical function of a regular polygon and of the disc versus distance to the boundary",
    draw(s) {
      const f = polygonCurve(N_VALUES[state.idx]);
      s.axes({
        xticks: [-4, -3, -2, -1, 0].map((v) => [v, v === 0 ? "1" : `10${sup(v)}`]),
        yticks: [1, 2, 3, 4, 5, 6, 7].map((v) => [v, `10${sup(v)}`]),
        xlabel: "distance h to the boundary (h = 1 is the centre)",
        ylabel: "canonical function C",
      });
      const sample = (g) => {
        const pts = [];
        for (let k = 0; k <= 240; k++) {
          const lh = LOG_H[0] + ((LOG_H[1] - LOG_H[0]) * k) / 240;
          pts.push([lh, Math.log10(g(Math.pow(10, lh)))]);
        }
        return pts;
      };
      s.clipped(() => {
        s.poly(sample(discCurve), { stroke: seriesColor(1), width: 2, open: true });
        s.poly(sample(f), { stroke: seriesColor(0), width: 2, open: true });
        if (state.hover != null) {
          s.line([state.hover, LOG_C[0]], [state.hover, LOG_C[1]], { stroke: s.color("ink-2"), width: 1 });
        }
      });
      // direct labels: the curves fall to the right, so a label that starts on
      // the curve and sits above it (or ends on it and sits below) never crosses it
      const xd = -3.3, xp = -1.5;
      s.text([xd, Math.log10(discCurve(Math.pow(10, xd)))], "disc: slope −3/2 (branch point)",
        { align: "left", dx: 6, dy: -12, size: 12 });
      s.text([xp, Math.log10(f(Math.pow(10, xp)))], "polygon: slope −1 (simple pole)",
        { align: "right", dx: -6, dy: 14, size: 12 });
    },
  });
  stage.onHover = (w) => {
    state.hover = w && w[0] > LOG_H[0] && w[0] < LOG_H[1] ? w[0] : null;
    update();
  };

  function update() {
    const n = N_VALUES[state.idx];
    if (state.hover != null) {
      const h = Math.pow(10, state.hover);
      readout.innerHTML = `At h = ${fmt(h)}: &nbsp; regular ${n}-gon C = <b>${fmt(polygonCurve(n)(h), 2)}</b>, ` +
        `&nbsp; disc C = <b>${fmt(discCurve(h), 2)}</b>.`;
    } else {
      readout.textContent = "Hover over the plot to read off values.";
    }
    stage.redraw();
  }

  const nSlider = slider("Polygon", { min: 0, max: N_VALUES.length - 1, step: 1, value: state.idx },
    (i) => `regular ${N_VALUES[i]}-gon`, (i) => { state.idx = i; update(); });

  root.append(el("div", { class: "controls" }, nSlider.node),
    el("div", { class: "legend" },
      el("span", { class: "key" }, el("i", { style: "background:var(--series-1)" }),
        "regular n-gon circumscribed about the unit circle"),
      el("span", { class: "key" }, el("i", { style: "background:var(--series-2)" }), "unit disc")),
    box, readout);
  update();
}

/** Superscript integer for tick labels: sup(-3) → "⁻³". */
function sup(v) {
  const digits = "⁰¹²³⁴⁵⁶⁷⁸⁹";
  return (v < 0 ? "⁻" : "") + String(Math.abs(v)).split("").map((d) => digits[+d]).join("");
}
