/**
 * main.js — entry point of the applet.
 *
 * 0. Activates the light / dark switch in the navigation bar (ui/theme.js).
 * 1. Typesets every element with class "tex" using KaTeX (if it loaded).
 * 2. Builds each interactive figure: an element
 *        <figure class="fig" data-figure="NAME">
 *    is handed to the init function registered under NAME below, which
 *    inserts its canvases and controls BEFORE the figure's <figcaption>.
 *
 * Project layout
 *   js/math/     pure mathematics (no DOM) — unit-tested in tests/
 *   js/ui/       canvas stage, colour ramp, DOM widgets, light / dark theme
 *   js/figures/  one module per figure
 */

import { initThemeToggle } from "./ui/theme.js";
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
import { initMeanValue } from "./figures/meanvalue.js";
import { initSmooth } from "./figures/smooth.js";
import { initQuad } from "./figures/quad.js";

const FIGURES = {
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
  momentcurve: initMomentCurve,
  hermite: initHermite,
  baryrational: initBaryRational,
  meanvalue: initMeanValue,
  smooth: initSmooth,
  quad: initQuad,
};

/** Replace the TeX source inside every .tex element by its typeset form. */
function typesetMath() {
  if (!window.katex) return; // offline: the TeX source stays readable
  for (const node of document.querySelectorAll(".tex")) {
    window.katex.render(node.textContent, node, {
      displayMode: node.classList.contains("block"),
      throwOnError: false,
    });
  }
}

function buildFigures() {
  for (const fig of document.querySelectorAll("figure[data-figure]")) {
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
}

initThemeToggle(document.getElementById("theme-toggle"));
typesetMath();
buildFigures();
