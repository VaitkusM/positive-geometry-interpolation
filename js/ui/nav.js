/**
 * nav.js — finding one's way around the page.
 *
 * Everything here is generated from the page itself, so nothing needs to be
 * kept in step by hand when sections are added or renumbered:
 *
 *   1. Contents panel   every heading (h2, h3, h4) of <main>, as a list of links.
 *                       On wide screens it stays open beside the text; otherwise
 *                       the "Contents" button of the navigation bar opens it.
 *   2. Position         the heading being read is marked in the panel and in the
 *                       navigation bar while the page scrolls.
 *   3. Heading links    every heading gets an id and a "#" link for sharing.
 *   4. Cross-references "Figure 12e" and "Section 8.2" in the running text become
 *                       links to that figure or section (linkReferences).
 *   5. Back to top      a button that appears after scrolling down.
 *
 * Without JavaScript the page keeps the static links of the navigation bar.
 */

import { el } from "./widgets.js";

/** Text of a heading without its badges and its "#" link. */
function headingText(h) {
  const copy = h.cloneNode(true);
  copy.querySelectorAll(".badge, .anchor").forEach((n) => n.remove());
  return copy.textContent.replace(/\s+/g, " ").trim();
}

/** "8.2 Dual volumes, Laplace…" → "8-2-dual-volumes-laplace". */
function slug(text) {
  return text.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "part";
}

/**
 * The headings of the page in reading order: [{ level, id, text, node, section }].
 * `id` is the link target: for the title of a <section id="…"> the section
 * itself, otherwise the heading (which receives an id if it has none).
 */
function collectHeadings(main) {
  const used = new Set([...document.querySelectorAll("[id]")].map((n) => n.id));
  const out = [];
  for (const h of main.querySelectorAll("h2, h3, h4")) {
    if (h.closest("figure, .aside, details")) continue;
    const text = headingText(h), section = h.closest("section");
    let id = h.id;
    if (!id && h.tagName === "H2" && section && section.id && section.querySelector("h2") === h) id = section.id;
    if (!id) {
      let base = slug(text), k = 2;
      id = base;
      while (used.has(id)) id = `${base}-${k++}`;
      used.add(id);
      h.id = id;
    }
    out.push({ level: +h.tagName[1], id, text, node: h, section: section && section.id ? section.id : null });
  }
  return out;
}

/** A "#" link at the end of every heading. */
function addAnchors(headings) {
  for (const h of headings) {
    h.node.append(" ", el("a", { class: "anchor", href: "#" + h.id, "aria-label": `Link to “${h.text}”` }, "#"));
  }
}

/** The contents panel and its button; returns the links by heading id. */
function buildContents(headings, toggle) {
  const links = new Map();
  const list = el("ol", {}, headings.map((h) => {
    const a = el("a", { href: "#" + h.id }, h.text);
    links.set(h.id, a);
    return el("li", { class: "lvl" + h.level }, a);
  }));
  const close = el("button", { type: "button", class: "contents-close", "aria-label": "Close the contents" }, "×");
  const panel = el("aside", { class: "contents", id: "contents", "aria-label": "Contents" },
    el("div", { class: "contents-head" }, el("strong", {}, "Contents"), close), list);
  document.body.append(panel);

  const setOpen = (open) => {
    document.body.classList.toggle("contents-open", open);
    if (toggle) toggle.setAttribute("aria-expanded", String(open));
  };
  if (toggle) {
    toggle.hidden = false;
    toggle.addEventListener("click", () => {
      const open = !document.body.classList.contains("contents-open");
      setOpen(open);
      if (open) (panel.querySelector('a[aria-current]') || panel.querySelector("a")).focus({ preventScroll: true });
    });
  }
  close.addEventListener("click", () => { setOpen(false); if (toggle) toggle.focus(); });
  // choosing an entry, pressing Escape or clicking outside closes the drawer
  list.addEventListener("click", (e) => { if (e.target.closest("a")) setOpen(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });
  document.addEventListener("click", (e) => {
    if (document.body.classList.contains("contents-open") && !e.target.closest(".contents, .contents-toggle")) setOpen(false);
  });
  return { panel, links };
}

/** Mark the heading that is being read, in the contents panel and in the navigation bar. */
function followScroll(headings, panel, links) {
  const bar = document.querySelector(".toc");
  const barLinks = bar ? [...bar.querySelectorAll('a[href^="#"]')] : [];
  let current = null, pending = false;
  function update() {
    pending = false;
    const limit = (bar ? bar.getBoundingClientRect().bottom : 0) + 32;
    let active = null;
    for (const h of headings) {
      if (h.node.getBoundingClientRect().top <= limit) active = h; else break;
    }
    if (active === current) return;
    current = active;
    links.forEach((a, id) => {
      if (active && id === active.id) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current");
    });
    barLinks.forEach((a) => a.classList.toggle("current", !!active && a.getAttribute("href") === "#" + active.section));
    // keep the marked entry in view inside the panel (without moving the page)
    const a = active && links.get(active.id);
    if (a) {
      const top = a.offsetTop, bottom = top + a.offsetHeight;
      if (top < panel.scrollTop + 48) panel.scrollTop = Math.max(0, top - 48);
      else if (bottom > panel.scrollTop + panel.clientHeight - 16) panel.scrollTop = bottom - panel.clientHeight + 16;
    }
  }
  const request = () => { if (!pending) { pending = true; requestAnimationFrame(update); } };
  window.addEventListener("scroll", request, { passive: true });
  window.addEventListener("resize", request);
  update();
}

/** A button that returns to the top; shown after one screen of scrolling. */
function backToTop() {
  const button = el("button", { type: "button", class: "to-top", "aria-label": "Back to the top of the page", hidden: "" }, "↑ Top");
  button.addEventListener("click", () => window.scrollTo({ top: 0 }));
  document.body.append(button);
  const update = () => { button.hidden = window.scrollY < window.innerHeight; };
  window.addEventListener("scroll", update, { passive: true });
  update();
}

/** Tell the style sheet how tall the sticky navigation bar is (it wraps on medium widths). */
function trackBarHeight() {
  const bar = document.querySelector(".toc");
  if (!bar || typeof ResizeObserver === "undefined") return;
  const set = () => document.documentElement.style.setProperty("--nav-h", bar.offsetHeight + "px");
  new ResizeObserver(set).observe(bar);
  set();
}

/** Build the contents panel, heading links, scroll tracking and the back-to-top button. */
export function initNavigation() {
  const main = document.querySelector("main");
  if (!main) return;
  trackBarHeight();
  const headings = collectHeadings(main);
  const { panel, links } = buildContents(headings, document.getElementById("contents-toggle"));
  addAnchors(headings);
  followScroll(headings, panel, links);
  backToTop();
}

/* ------------------------------------------------------------------ */
/*  Cross-references                                                    */
/* ------------------------------------------------------------------ */

/** Where "Figure N" and "Section N" point: { figures: Map, sections: Map } of label → id. */
function referenceTargets(main) {
  const figures = new Map(), sections = new Map();
  for (const fig of main.querySelectorAll("figure")) {
    const label = fig.querySelector("figcaption > strong");
    const m = label && /^Figure\s+(\d+[a-z]?)\./.exec(label.textContent.trim());
    if (!m) continue;
    if (!fig.id) fig.id = "fig-" + m[1];
    figures.set(m[1], fig.id);
  }
  for (const num of main.querySelectorAll("section[id] > h2 .num")) {
    sections.set(num.textContent.trim(), num.closest("section").id);
  }
  for (const h of main.querySelectorAll("h3[id]")) {
    const m = /^(\d+\.\d+)\s/.exec(headingText(h));
    if (m) sections.set(m[1], h.id);
  }
  return { figures, sections };
}

const KEYWORD = /\b(Figures?|Sections?)\s+(?=\d)/g;
const NUMBER = /^\d+(?:\.\d+)?[a-z]?/;
const SEPARATOR = /^(\s*(?:,|–|-|and|or|to)\s*)(?=\d)/;

/**
 * Turn "Figure 5", "Figures 12b and 12c", "Section 8.2", "Sections 1–7" in the
 * text of `main` into links. Text inside links, headings, formulas and the
 * interactive parts of figures is left alone, and so is a number that has no
 * target on this page.
 */
export function linkReferences(main = document.querySelector("main")) {
  if (!main) return;
  const { figures, sections } = referenceTargets(main);
  const skip = "a, button, h1, h2, h3, h4, .tex, .katex, .fig-body, nav, script, style, svg, .contents";
  const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
  const nodes = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const p = n.parentElement;
    if (!p || p.closest(skip)) continue;
    if (p.matches("figcaption > strong:first-child")) continue;      // a figure's own label
    if (/\b(Figure|Section)s?\s+\d/.test(n.nodeValue)) nodes.push(n);
  }
  for (const node of nodes) {
    const text = node.nodeValue, parts = [];
    let done = 0;
    KEYWORD.lastIndex = 0;
    for (let m = KEYWORD.exec(text); m; m = KEYWORD.exec(text)) {
      const targets = m[1].startsWith("Figure") ? figures : sections;
      let pos = m.index + m[0].length, start = m.index;                // `start`: where the next link text begins
      for (;;) {
        const num = NUMBER.exec(text.slice(pos));
        if (!num) break;
        const end = pos + num[0].length;
        if (/^\.\d/.test(text.slice(end))) break;                       // "7.3.5": a section of some other work
        const id = targets.get(num[0]);
        if (id) {
          parts.push(text.slice(done, start), el("a", { href: "#" + id, class: "xref" }, text.slice(start, end)));
          done = end;
        }
        const sep = SEPARATOR.exec(text.slice(end));
        if (!sep) { pos = end; break; }
        pos = start = end + sep[1].length;
      }
      KEYWORD.lastIndex = Math.max(pos, m.index + 1);
    }
    if (!parts.length) continue;
    parts.push(text.slice(done));
    node.replaceWith(...parts.filter((p) => p !== ""));
  }
}

/**
 * Ids are created while the page is built, and the figures change the layout as
 * they appear, so go to the address's #target once more at the end — and again
 * shortly afterwards, unless the reader has scrolled in the meantime.
 */
export function restoreHash() {
  if (location.hash.length < 2) return;
  let target = null;
  try { target = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch { /* malformed address */ }
  if (!target) return;
  let expected = null;
  const go = () => {
    if (expected !== null && Math.abs(window.scrollY - expected) > 2) return;   // the reader moved: leave the page alone
    target.scrollIntoView({ behavior: "instant", block: "start" });
    expected = window.scrollY;
  };
  requestAnimationFrame(go);
  for (const delay of [250, 700, 1500]) setTimeout(go, delay);
}
