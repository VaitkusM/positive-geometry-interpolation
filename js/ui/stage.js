/**
 * stage.js — a small 2D drawing surface on top of <canvas>.
 *
 * A Stage owns one canvas and provides:
 *   - a world → screen coordinate mapping (`view`), either with equal scales
 *     on both axes (geometry figures) or independent scales (function plots);
 *   - crisp rendering on high-DPI screens and automatic resizing;
 *   - draggable "handles" (points the user can move with mouse or touch);
 *   - a few drawing helpers that take WORLD coordinates and theme colours.
 *
 * Usage:
 *     const stage = new Stage(containerEl, {
 *       view: { xmin: 0, xmax: 4, ymin: 0, ymax: 3 },
 *       draw: (s) => { s.poly(points, { fill: s.color("fill-soft") }); },
 *     });
 *     stage.handles = () => [{ pos: () => p, drag: (q) => { p = q; } }];
 *     stage.redraw();          // call after changing any state
 *
 * Colours are read from CSS custom properties (see css/style.css), so figures
 * follow the light / dark theme automatically (see ui/theme.js).
 */

import { onThemeChange } from "./theme.js";

const allStages = new Set();

/** Cache of resolved CSS custom properties; cleared when the theme changes. */
let colorCache = {};
export function cssColor(name) {
  if (!(name in colorCache)) {
    colorCache[name] = getComputedStyle(document.documentElement)
      .getPropertyValue("--" + name).trim();
  }
  return colorCache[name];
}

// the colours changed (system setting or the switch in the navigation bar): redraw everything
onThemeChange(() => {
  colorCache = {};
  allStages.forEach((s) => s.redraw());
});

/**
 * The slide version (js/slides.js) shows the figures inside a container that is
 * scaled with a CSS transform. It reports the scale here, so that the canvases
 * are rendered with as many pixels as they cover on the screen.
 */
let pixelScale = 1;
export function setStageScale(k) {
  pixelScale = k > 0 ? k : 1;
  allStages.forEach((s) => s._resize());
}
/** Canvas pixels per CSS pixel (capped: very large canvases are slow). */
const density = () => Math.min(4, (window.devicePixelRatio || 1) * pixelScale);

/** Colour of vertex / series number i (0-based); the palette has 8 slots. */
export const seriesColor = (i) => cssColor("series-" + ((i % 8) + 1));

/** "#rrggbb" → "rgba(r,g,b,a)". */
export function withAlpha(hex, a) {
  const v = parseInt(hex.replace("#", ""), 16);
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${a})`;
}

export class Stage {
  /**
   * @param {HTMLElement} container  element that receives the canvas
   * @param {object} o
   * @param {{xmin,xmax,ymin,ymax}} o.view   world rectangle that must be visible
   * @param {boolean} [o.equal=true]         same scale on both axes?
   * @param {number}  [o.aspect=0.75]        canvas height / width
   * @param {number}  [o.maxHeight=520]      cap for the canvas height (CSS px)
   * @param {{l,r,t,b}} [o.pad]              inner padding in CSS px
   * @param {(s:Stage)=>void} o.draw         paints the figure
   * @param {string} [o.label]               accessible description
   */
  constructor(container, o) {
    this.view = { ...o.view };
    this.equal = o.equal !== false;
    this.aspect = o.aspect ?? 0.75;
    this.maxHeight = o.maxHeight ?? 520;
    this.pad = { l: 0, r: 0, t: 0, b: 0, ...(o.pad || {}) };
    this.drawFn = o.draw;
    /** Function returning the current list of handles (see class comment). */
    this.handles = () => [];
    /** Optional callbacks: world-space click / hover that did not hit a handle. */
    this.onClick = null;
    this.onHover = null;

    this.canvas = document.createElement("canvas");
    this.canvas.className = "stage";
    if (o.label) {
      this.canvas.setAttribute("role", "img");
      this.canvas.setAttribute("aria-label", o.label);
    }
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d");
    this.width = 300;
    this.height = 200;
    this._active = null; // handle being dragged
    this._pending = false;

    // (deferred by a frame: resizing the canvas inside the observer callback
    // would itself trigger the observer again)
    new ResizeObserver(() => requestAnimationFrame(() => this._resize())).observe(container);
    this._bindPointer();
    allStages.add(this);
    this._resize();
  }

  /* ---------------- coordinate mapping ---------------- */

  /** Change the visible world rectangle (does not redraw by itself). */
  setView(v) { this.view = { ...v }; }

  _map() {
    const { xmin, xmax, ymin, ymax } = this.view;
    const w = this.width - this.pad.l - this.pad.r;
    const h = this.height - this.pad.t - this.pad.b;
    let sx = w / (xmax - xmin), sy = h / (ymax - ymin);
    let ox = this.pad.l, oy = this.pad.t;
    if (this.equal) {
      const s = Math.min(sx, sy);
      ox += (w - s * (xmax - xmin)) / 2;
      oy += (h - s * (ymax - ymin)) / 2;
      sx = sy = s;
    }
    return { sx, sy, ox, oy, xmin, ymax };
  }

  /** World point → CSS-pixel position on the canvas (y axis points up). */
  toScreen(p) {
    const m = this._map();
    return [m.ox + (p[0] - m.xmin) * m.sx, m.oy + (m.ymax - p[1]) * m.sy];
  }

  /** CSS-pixel position → world point. */
  toWorld(q) {
    const m = this._map();
    return [m.xmin + (q[0] - m.ox) / m.sx, m.ymax - (q[1] - m.oy) / m.sy];
  }

  /** Length of one CSS pixel in world units (equal-scale stages). */
  get pixel() { return 1 / this._map().sx; }

  /* ---------------- rendering ---------------- */

  _resize() {
    const cssW = Math.max(120, this.canvas.parentElement.clientWidth);
    const cssH = Math.min(this.maxHeight, Math.round(cssW * this.aspect));
    const dpr = density();
    // nothing to do if neither the layout width nor the pixel density changed
    if (cssW === this.width && cssH === this.height && this._dpr === dpr) return;
    this._dpr = dpr;
    this.width = cssW;
    this.height = cssH;
    this.canvas.style.height = cssH + "px";
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this._draw();
  }

  /** Schedule a repaint (coalesced to one per animation frame). */
  redraw() {
    if (this._pending) return;
    this._pending = true;
    requestAnimationFrame(() => { this._pending = false; this._draw(); });
  }

  _draw() {
    const dpr = this._dpr;
    const c = this.ctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, this.width, this.height);
    c.lineJoin = "round";
    c.lineCap = "round";
    this.drawFn(this);
  }

  /* ---------------- pointer interaction ---------------- */

  _eventPos(e) {
    const r = this.canvas.getBoundingClientRect();
    // r is measured on the screen; inside a scaled container (the slides) it
    // differs from the layout size by the scale factor k
    const k = r.width > 0 ? this.width / r.width : 1;
    return [(e.clientX - r.left) * k, (e.clientY - r.top) * k];
  }

  /** Nearest handle within `radius` CSS px of the screen point q, or null. */
  _hit(q, radius) {
    let best = null, bestD = radius;
    for (const h of this.handles()) {
      const s = this.toScreen(h.pos());
      const d = Math.hypot(s[0] - q[0], s[1] - q[1]);
      if (d <= bestD) { best = h; bestD = d; }
    }
    return best;
  }

  _bindPointer() {
    const cv = this.canvas;
    cv.addEventListener("pointerdown", (e) => {
      const q = this._eventPos(e);
      const h = this._hit(q, e.pointerType === "mouse" ? 14 : 26);
      if (h) {
        this._active = h;
        cv.setPointerCapture(e.pointerId);
        if (h.select) h.select();
        cv.style.cursor = "grabbing";
        this.redraw();
        e.preventDefault();
      } else if (this.onClick) {
        this.onClick(this.toWorld(q));
      }
    });
    cv.addEventListener("pointermove", (e) => {
      const q = this._eventPos(e);
      if (this._active) {
        this._active.drag(this.toWorld(q));
        this.redraw();
      } else {
        cv.style.cursor = this._hit(q, 14) ? "grab" : "";
        if (this.onHover) this.onHover(this.toWorld(q));
      }
    });
    const end = () => { this._active = null; cv.style.cursor = ""; };
    cv.addEventListener("pointerup", end);
    cv.addEventListener("pointercancel", end);
    cv.addEventListener("pointerleave", () => { if (this.onHover) this.onHover(null); });
    // On touch screens, keep the page from scrolling only while a handle is
    // being grabbed; everywhere else on the canvas scrolling works normally.
    cv.addEventListener("touchstart", (e) => {
      if (this._hit(this._eventPos(e.touches[0]), 26)) e.preventDefault();
    }, { passive: false });
  }

  /* ---------------- drawing helpers (world coordinates) ---------------- */

  /** Resolve a theme colour name ("ink", "grid", …) to a CSS colour. */
  color(name) { return cssColor(name); }

  _style(o) {
    const c = this.ctx;
    c.lineWidth = o.width ?? 1.5;
    c.setLineDash(o.dash || []);
    if (o.fill) { c.fillStyle = o.fill; c.fill(); }
    if (o.stroke) { c.strokeStyle = o.stroke; c.stroke(); }
    c.setLineDash([]);
  }

  /** Polygon or polyline through world points. o: {fill, stroke, width, dash, open}. */
  poly(pts, o = {}) {
    if (pts.length < 2) return;
    const c = this.ctx;
    c.beginPath();
    pts.forEach((p, i) => {
      const s = this.toScreen(p);
      if (i === 0) c.moveTo(s[0], s[1]); else c.lineTo(s[0], s[1]);
    });
    if (!o.open) c.closePath();
    this._style(o);
  }

  /** Straight segment from a to b. */
  line(a, b, o = {}) { this.poly([a, b], { stroke: this.color("ink"), ...o, open: true }); }

  /** A full line {n, p} (see polygon.js), drawn across the whole canvas. */
  fullLine(l, o = {}) {
    const t = [-l.n[1], l.n[0]];
    const { xmin, xmax, ymin, ymax } = this.view;
    const far = 4 * (Math.abs(xmax - xmin) + Math.abs(ymax - ymin)) +
      Math.hypot(l.p[0] - (xmin + xmax) / 2, l.p[1] - (ymin + ymax) / 2);
    this.line([l.p[0] - far * t[0], l.p[1] - far * t[1]],
              [l.p[0] + far * t[0], l.p[1] + far * t[1]], o);
  }

  /** Filled disc of radius r CSS px at world point p. o: {fill, stroke, width, r}. */
  dot(p, o = {}) {
    const c = this.ctx, s = this.toScreen(p);
    c.beginPath();
    c.arc(s[0], s[1], o.r ?? 5, 0, 2 * Math.PI);
    this._style({ fill: this.color("ink"), ...o });
  }

  /**
   * A draggable-looking point: coloured disc with a ring in the surface colour
   * so that it stays legible on top of fills and lines.
   */
  knob(p, fill, r = 7) {
    this.dot(p, { r: r + 2, fill: this.color("surface") });
    this.dot(p, { r, fill });
  }

  /**
   * Text at world point p. o: {dx, dy (CSS px offsets), align, baseline, color,
   * size, weight, halo (paint a surface-coloured outline behind the text)}.
   */
  text(p, str, o = {}) {
    const c = this.ctx, s = this.toScreen(p);
    c.font = `${o.weight || 500} ${o.size || 13}px ${cssColor("font-ui")}`;
    c.textAlign = o.align || "center";
    c.textBaseline = o.baseline || "middle";
    const x = s[0] + (o.dx || 0), y = s[1] + (o.dy || 0);
    if (o.halo !== false) {
      c.lineWidth = 3;
      c.strokeStyle = this.color("surface");
      c.strokeText(str, x, y);
    }
    c.fillStyle = o.color || this.color("ink");
    c.fillText(str, x, y);
  }

  /** Run `fn` with drawing clipped to the inner (padded) plot rectangle. */
  clipped(fn) {
    const c = this.ctx;
    c.save();
    c.beginPath();
    c.rect(this.pad.l, this.pad.t, this.width - this.pad.l - this.pad.r,
           this.height - this.pad.t - this.pad.b);
    c.clip();
    fn();
    c.restore();
  }

  /**
   * Axes box for function plots (equal=false stages): light grid lines and
   * tick labels. xticks / yticks are arrays of [worldValue, labelString].
   */
  axes({ xticks = [], yticks = [], xlabel, ylabel }) {
    const c = this.ctx, v = this.view;
    c.lineWidth = 1;
    for (const [x, lab] of xticks) {
      this.line([x, v.ymin], [x, v.ymax], { stroke: this.color("grid"), width: 1 });
      this.text([x, v.ymin], lab, { dy: 12, color: this.color("ink-2"), size: 12, halo: false });
    }
    for (const [y, lab] of yticks) {
      this.line([v.xmin, y], [v.xmax, y], { stroke: this.color("grid"), width: 1 });
      this.text([v.xmin, y], lab, { dx: -8, align: "right", color: this.color("ink-2"), size: 12, halo: false });
    }
    this.line([v.xmin, v.ymin], [v.xmax, v.ymin], { stroke: this.color("axis"), width: 1 });
    if (xlabel) {
      this.text([(v.xmin + v.xmax) / 2, v.ymin], xlabel,
        { dy: 30, color: this.color("ink-2"), size: 12, halo: false });
    }
    if (ylabel) {
      this.text([v.xmin, v.ymax], ylabel,
        { dx: 6 - this.pad.l, dy: -12, align: "left", color: this.color("ink-2"), size: 12, halo: false });
    }
  }
}
