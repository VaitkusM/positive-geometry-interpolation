/**
 * slides.js — entry point of the slide version (slides.html).
 *
 * The deck is a fixed 1280 × 720 "sheet" that is scaled as a whole to fit the
 * window, so every slide looks the same on every screen. Each slide is a
 *        <section class="slide" id="NAME" data-part="…" data-more="#anchor">
 * and shows the same interactive figures as the page (js/build.js). A figure
 * is built the first time its slide is shown.
 *
 * Keys     → ↓ Space PageDown : next        ← ↑ PageUp : previous
 *          Home / End : first / last        O : list of slides
 *          F : full screen                  D : light / dark
 * (Arrow keys and Space keep their usual meaning while a slider or a button of
 * a figure has the focus; PageDown / PageUp, which presenter remotes send,
 * always turn the slide.)
 *
 * slides.html#NAME opens that slide; slides.html?print lays all slides out
 * one below the other, one per page, for printing or saving as PDF.
 */

import { initThemeToggle, isDark, setTheme } from "./ui/theme.js";
import { setStageScale } from "./ui/stage.js";
import { typesetMath, buildFigures } from "./build.js";

const WIDTH = 1280, HEIGHT = 720;   // must match css/slides.css

const deck = document.getElementById("deck");
const slides = [...deck.querySelectorAll(".slide")];
const printing = new URLSearchParams(location.search).has("print");
let current = -1;

const $ = (id) => document.getElementById(id);
/** Plain-text title of a slide, without its badge (read before KaTeX replaces the formulas). */
const titles = slides.map((s) => {
  if (s.dataset.title) return s.dataset.title;
  const h = s.querySelector("h1, h2")?.cloneNode(true);
  h?.querySelectorAll(".badge").forEach((b) => b.remove());
  return h?.textContent.replace(/\s+/g, " ").trim() || s.id;
});

/* ---------------- fitting the sheet to the window ---------------- */

function fit() {
  const k = Math.min(window.innerWidth / WIDTH, window.innerHeight / HEIGHT);
  deck.style.setProperty("--k", k);
  setStageScale(k);
}

/* ---------------- figures on a slide ---------------- */

/**
 * On the page a figure is one tall card: controls, drawing, read-outs. A slide
 * is wide and low, so a slide may ask for parts of its figure to be shown
 * beside the drawing instead of below it:
 *        <section class="slide side" data-notes="readout bars">
 * moves the elements with these classes out of the figure, into a box at the
 * end of the slide's text column. (The figure keeps its references to the
 * moved elements, so they are updated as before.)
 */
function buildSlideFigures(slide) {
  for (const fig of slide.querySelectorAll("figure[data-figure]:not([data-built])")) {
    buildFigures(slide);
    const names = (slide.dataset.notes || "").split(" ").filter(Boolean);
    const column = slide.querySelector(".slide-text");
    if (!names.length || !column) continue;
    const box = document.createElement("div");
    box.className = "fig-notes";
    for (const node of fig.querySelectorAll(names.map((n) => "." + n).join(", "))) {
      if (!node.parentElement.closest(".fig-notes")) box.append(node);
    }
    if (box.children.length) column.append(box);
  }
}

/* ---------------- showing a slide ---------------- */

function show(i, { updateHash = true } = {}) {
  i = Math.max(0, Math.min(slides.length - 1, i));
  if (i === current) return;
  if (current >= 0) slides[current].classList.remove("active");
  current = i;
  const slide = slides[i];
  slide.classList.add("active");
  buildSlideFigures(slide);         // only now does the slide have a layout
  slide.querySelector(".slide-body")?.scrollTo(0, 0);

  $("slide-count").textContent = `${i + 1} / ${slides.length}`;
  $("slide-part").textContent = slide.dataset.part || "";
  $("slide-progress").style.width = `${(100 * (i + 1)) / slides.length}%`;
  $("slide-prev").disabled = i === 0;
  $("slide-next").disabled = i === slides.length - 1;
  const more = $("slide-more");
  more.href = "index.html" + (slide.dataset.more || "");
  document.title = `${titles[i]} — slides`;
  for (const a of $("overview-list").querySelectorAll("a")) {
    a.classList.toggle("current", a.dataset.index === String(i));
  }
  if (updateHash) history.replaceState(null, "", "#" + slide.id);
}

/** The slide named by the address: #NAME, or #12 for the twelfth slide. */
function slideFromHash() {
  const stay = Math.max(0, current);            // unknown address: stay where we are
  const h = decodeURIComponent(location.hash.slice(1));
  if (!h) return stay;
  const byId = slides.findIndex((s) => s.id === h);
  if (byId >= 0) return byId;
  return /^\d+$/.test(h) ? Number(h) - 1 : stay;
}

/* ---------------- list of slides ---------------- */

function buildOverview() {
  const list = $("overview-list");
  let part = null, ol = null;
  slides.forEach((s, i) => {
    if (s.dataset.part !== part || !ol) {
      part = s.dataset.part;
      const h = document.createElement("h3");
      h.textContent = part || "";
      ol = document.createElement("ol");
      list.append(h, ol);
    }
    const li = document.createElement("li");
    li.value = i + 1;
    const a = document.createElement("a");
    a.href = "#" + s.id;
    a.dataset.index = String(i);
    a.textContent = titles[i];
    li.append(a);
    ol.append(li);
  });
  list.addEventListener("click", (e) => {
    const a = e.target.closest("a[data-index]");
    if (!a) return;
    e.preventDefault();
    show(Number(a.dataset.index));
    setOverview(false);
  });
}

function setOverview(open) {
  const panel = $("overview");
  panel.hidden = !open;
  $("slide-list").setAttribute("aria-expanded", String(open));
  if (open) (panel.querySelector("a.current") || panel.querySelector("a"))?.focus();
  else $("slide-list").focus();
}

/* ---------------- controls ---------------- */

function toggleFullScreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.().catch(() => { /* not allowed: stay windowed */ });
}

function onKey(e) {
  if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
  const overviewOpen = !$("overview").hidden;
  if (e.key === "Escape") { if (overviewOpen) { setOverview(false); e.preventDefault(); } return; }

  // PageDown / PageUp always turn the slide
  if (e.key === "PageDown") { show(current + 1); e.preventDefault(); return; }
  if (e.key === "PageUp") { show(current - 1); e.preventDefault(); return; }

  // other keys belong to a focused control of a figure, or to the list of slides
  const t = e.target;
  const tag = t && t.tagName;
  if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
  const activates = e.key === " " || e.key === "Enter";
  if (activates && (tag === "BUTTON" || tag === "A" || tag === "SUMMARY")) return;
  if (overviewOpen && e.key.toLowerCase() !== "o") return;

  switch (e.key) {
    case "ArrowRight": case "ArrowDown": case " ": case "Enter": show(current + 1); break;
    case "ArrowLeft": case "ArrowUp": case "Backspace": show(current - 1); break;
    case "Home": show(0); break;
    case "End": show(slides.length - 1); break;
    case "o": case "O": setOverview(!overviewOpen); break;
    case "f": case "F": toggleFullScreen(); break;
    case "d": case "D": setTheme(isDark() ? "light" : "dark"); break;
    default: return;
  }
  e.preventDefault();
}

/**
 * Links inside the figures point to sections of the page ("#coordinates").
 * Here they open the page itself, in a new tab.
 */
function redirectPageLinks() {
  deck.addEventListener("click", (e) => {
    const a = e.target.closest("a[href^='#']");
    if (!a || e.defaultPrevented || !a.closest(".fig, .fig-notes")) return;
    e.preventDefault();
    window.open("index.html" + a.getAttribute("href"), "_blank", "noopener");
  });
}

/* ---------------- start ---------------- */

buildOverview();                    // before the formulas are typeset: it uses the plain titles
typesetMath();
initThemeToggle($("theme-toggle"));
redirectPageLinks();

if (printing) {
  // every slide below the other, at its natural size; the browser's print
  // dialog (page size 1280 × 720 px, set in css/slides.css) does the rest
  document.body.classList.add("print");
  slides.forEach((s, i) => { s.dataset.number = String(i + 1); });
  slides.forEach(buildSlideFigures);
} else {
  fit();
  window.addEventListener("resize", fit);
  show(slideFromHash(), { updateHash: false });
  window.addEventListener("hashchange", () => show(slideFromHash(), { updateHash: false }));
  document.addEventListener("keydown", onKey);
  $("slide-prev").addEventListener("click", () => show(current - 1));
  $("slide-next").addEventListener("click", () => show(current + 1));
  $("slide-list").addEventListener("click", () => setOverview($("overview").hidden));
  $("overview-close").addEventListener("click", () => setOverview(false));
  $("slide-full").addEventListener("click", toggleFullScreen);
  $("slide-full").hidden = !document.documentElement.requestFullscreen;
}
