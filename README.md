# Positive Geometries for Barycentric Interpolation — interactive applet

**Live page: <https://vaitkusm.github.io/positive-geometry-interpolation/>**

An interactive, self-contained introduction to the ideas of

> M. Vaitkus, *Positive Geometries for Barycentric Interpolation*, poster paper, IGS 2019.

The thesis of the paper: linear interpolation on a segment, barycentric
coordinates on a triangle and Wachspress coordinates on a convex polygon are
all **ratios of canonical forms of positive geometries** — rational functions
with poles on the boundary of the domain.

The page is written for a mixed audience (geometric modelling people who have
not met positive geometries, and mathematicians / physicists who have not met
barycentric coordinates) and contains eight interactive figures:

| # | Figure | Shows |
|---|--------|-------|
| 1 | Segment | linear interpolation as a ratio of two poles (Shepard form) |
| 2 | Triangle | area coordinates = ratio-of-poles form |
| 3 | Canonical function | 3D graph over polygons and regions with curved sides |
| 4 | Residues | the residue along an edge is the canonical function of the edge |
| 5 | Coordinates from forms | wedge / whole-shape ratio, and the polar dual polygon |
| 6 | Adjoint | the adjoint curve through the external intersection points |
| 7 | Line space | tetrahedral line complex and the octahedron (hypersimplex) |
| 8 | Disc | simple pole (polygons) versus branch point (disc) |

## Running locally

No build step and no dependencies to install: plain HTML, CSS and JavaScript
(ES modules). Modules need to be served over HTTP, so from the repository root:

```sh
python3 -m http.server 8000     # then open http://localhost:8000
```

Formulas are typeset with [KaTeX](https://katex.org), loaded from a CDN (if it
is unreachable, the raw TeX is shown instead and everything else still works).

## Tests

All identities stated on the page are checked numerically (partition of unity,
linear precision, wedge ratios = classic Wachspress formula, canonical function
= 2 × dual area, residues, adjoint zeros, the published formulas of
Arkani-Hamed–Bai–Lam, …):

```sh
deno test tests/
```

## Code map

```
index.html            all text; each figure is <figure data-figure="NAME">
css/style.css         design tokens (light + dark theme), layout, components
js/main.js            typesets formulas, starts every figure
js/math/              pure mathematics, no DOM — the part worth reusing
  polygon.js            conventions (CCW polygons, edge lines {n, p}), helpers
  canonical.js          canonical functions: segment, triangle, wedge, polygon,
                        adjoint, half disc, pizza slice, disc
  barycentric.js        coordinates as ratios of forms, classic formulas, polar dual
js/ui/
  stage.js              canvas wrapper: world coordinates, hi-DPI, draggable handles
  ramp.js               sequential colour ramp (heat map, 3D surface)
  widgets.js            buttons, sliders, bar chart, number formatting
js/figures/           one module per figure, each exporting init…(rootElement)
  common.js             default polygons, convexity-preserving vertex dragging
tests/math.test.js    unit tests for js/math
```

### Conventions (read `js/math/polygon.js` first)

- Points are `[x, y]`; polygons are counter-clockwise arrays of points.
- Edge `i` joins `p_i` and `p_{i+1}`; vertex `i` lies between edges `i−1` and `i`.
- An edge line is `{ n, p }` with inward unit normal `n`; `h_i(x) = n·(x − p)`.
- The canonical form is written `Ω = C(x, y) dx dy` in an affine chart. With this
  normalisation `C = 2 × area of the polar dual`; the paper's `Ω = C·ω` differs by
  a constant factor that cancels in all ratios.
- Wedge (Wachspress) weight of vertex `i`: `w_i = det(n_{i−1}, n_i) / (h_{i−1} h_i)`,
  canonical function of the polygon: `C_P = Σ w_i`, coordinates: `λ_i = w_i / C_P`.

### Adding a figure

1. Create `js/figures/myfigure.js` exporting `initMyFigure(root)`; build the DOM
   inside `root` (use `Stage` for canvases, `widgets.js` for controls).
2. Register it in the `FIGURES` table of `js/main.js`.
3. Put `<figure class="fig" data-figure="myfigure"><figcaption>…</figcaption></figure>`
   in `index.html`.

Colours come from CSS custom properties in `css/style.css`; never hard-code a
colour in a figure, or it will not follow the dark theme.
