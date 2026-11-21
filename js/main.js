/**
 * main.js — entry point of the applet.
 *
 * 0. Activates the light / dark switch in the navigation bar (ui/theme.js) and
 *    builds the contents panel, heading links and cross-references (ui/nav.js).
 * 1. Typesets every element with class "tex" using KaTeX (if it loaded).
 * 2. Builds each interactive figure (the list of figures is in build.js,
 *    which this page shares with the slide version, slides.html).
 *
 * Project layout
 *   js/math/     pure mathematics (no DOM) — unit-tested in tests/
 *   js/ui/       canvas stage, colour ramp, DOM widgets, light / dark theme
 *   js/figures/  one module per figure
 *   js/build.js  the list of figures; shared with js/slides.js
 */

import { initThemeToggle } from "./ui/theme.js";
import { initNavigation, linkReferences, restoreHash } from "./ui/nav.js";
import { typesetMath, buildFigures } from "./build.js";

initThemeToggle(document.getElementById("theme-toggle"));
initNavigation();          // before the formulas are typeset: the contents list uses the plain heading texts
typesetMath();
buildFigures();
linkReferences();
restoreHash();
