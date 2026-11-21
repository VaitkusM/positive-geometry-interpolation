/**
 * build.js — what the page (main.js) and the slides (slides.js) have in common:
 * the list of figures, and the two functions that typeset the formulas and
 * build the figures.
 *
 * A figure is an element
 *        <figure class="fig" data-figure="NAME">
 * It is handed to the init function registered under NAME below, which
 * inserts its canvases and controls BEFORE the figure's <figcaption>.
 */

import { initHero } from "./figures/hero.js";
import { initConceptMap } from "./figures/conceptmap.js";
import { initSegment } from "./figures/segment.js";
import { initTriangle } from "./figures/triangle.js";
import { initSurface } from "./figures/surface.js";
import { initResidue } from "./figures/residue.js";
import { initWachspress } from "./figures/wachspress.js";
import { initWheel } from "./figures/wheel.js";
import { initAdjoint } from "./figures/adjoint.js";
import { initLineSpace } from "./figures/linespace.js";
import { initDisc } from "./figures/disc.js";
import { initPolytope3d } from "./figures/polytope3d.js";
import { initPolycon } from "./figures/polycon.js";
import { initPizzaBasis } from "./figures/pizzabasis.js";
import { initDualMeasure } from "./figures/dualmeasure.js";
import { initConeCut } from "./figures/conecut.js";
import { initSplineDual } from "./figures/splinedual.js";
import { initSplineLadder } from "./figures/splineladder.js";
import { initBsplinePoles } from "./figures/bsplinepoles.js";
import { initFibre } from "./figures/fibre.js";
import { initReebPoint } from "./figures/reebpoint.js";
import { initMomentCurve } from "./figures/momentcurve.js";
import { initHermite } from "./figures/hermite.js";
import { initBaryRational } from "./figures/baryrational.js";
import { initResidueCircle } from "./figures/residuecircle.js";
import { initBaryPoles } from "./figures/barypoles.js";
import { initQuadContour } from "./figures/quadcontour.js";
import { initHodgeCubic } from "./figures/hodgecubic.js";
import { initCurveRank } from "./figures/curverank.js";
import { initMeanValue } from "./figures/meanvalue.js";
import { initSmooth } from "./figures/smooth.js";
import { initQuad } from "./figures/quad.js";

export const FIGURES = {
  hero: initHero,
  segment: initSegment,
  triangle: initTriangle,
  surface: initSurface,
  residue: initResidue,
  wachspress: initWachspress,
  wheel: initWheel,
  adjoint: initAdjoint,
  linespace: initLineSpace,
  disc: initDisc,
  polytope3d: initPolytope3d,
  polycon: initPolycon,
  pizzabasis: initPizzaBasis,
  dualmeasure: initDualMeasure,
  conecut: initConeCut,
  splinedual: initSplineDual,
  splineladder: initSplineLadder,
  bsplinepoles: initBsplinePoles,
  fibre: initFibre,
  reebpoint: initReebPoint,
  conceptmap: initConceptMap,
  momentcurve: initMomentCurve,
  hermite: initHermite,
  baryrational: initBaryRational,
  residuecircle: initResidueCircle,
  barypoles: initBaryPoles,
  quadcontour: initQuadContour,
  hodgecubic: initHodgeCubic,
  curverank: initCurveRank,
  meanvalue: initMeanValue,
  smooth: initSmooth,
  quad: initQuad,
};

/** Replace the TeX source inside every .tex element by its typeset form. */
export function typesetMath(root = document) {
  if (!window.katex) return; // offline: the TeX source stays readable
  for (const node of root.querySelectorAll(".tex")) {
    window.katex.render(node.textContent, node, {
      displayMode: node.classList.contains("block"),
      throwOnError: false,
    });
  }
}

/** Build one figure (once: a second call for the same element does nothing). */
export function buildFigure(fig) {
  if (fig.dataset.built) return;
  fig.dataset.built = "true";
  const init = FIGURES[fig.dataset.figure];
  const body = document.createElement("div");
  body.className = "fig-body";
  fig.prepend(body);
  try {
    init(body);
  } catch (err) {
    // one broken figure must not take the rest of the page down
    console.error(`Figure "${fig.dataset.figure}" failed:`, err);
    body.textContent = "This figure could not be loaded.";
  }
}

/** Build every figure below root. */
export function buildFigures(root = document) {
  root.querySelectorAll("figure[data-figure]").forEach(buildFigure);
}
