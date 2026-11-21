# Positive Geometries for Barycentric Interpolation — interactive applet

**Live page: <https://vaitkusm.github.io/positive-geometry-interpolation/>**

An interactive, self-contained introduction to the ideas of

> M. Vaitkus, *Positive Geometries for Barycentric Interpolation*, poster paper, IGS 2019.
> [arXiv:2101.08589](https://arxiv.org/abs/2101.08589)

The thesis of the paper: linear interpolation on a segment, barycentric
coordinates on a triangle and Wachspress coordinates on a convex polygon are
all **ratios of canonical forms of positive geometries** — rational functions
with poles on the boundary of the domain.

The page is written for a mixed audience (geometric modelling people who have
not met positive geometries, and mathematicians / physicists who have not met
barycentric coordinates) and contains more than twenty interactive figures. Sections 1–7 follow
the 2019 paper; material published since then is collected in Section 8 and marked
"Later development" on the page, and figures that go beyond the paper's own are
marked "Added illustration".

| # | Figure | Shows |
|---|--------|-------|
| Map | Map of the topics | sixteen topics of the page and the relations between them; select a box for details |
| 1 | Segment | linear interpolation as a ratio of two poles (Shepard form) |
| 2 | Triangle | area coordinates = ratio-of-poles form |
| 3 | Canonical function | 3D graph over polygons and regions with curved sides |
| 4 | Residues | the residue along an edge is the canonical function of the edge |
| 5 | Coordinates from forms | wedge / whole-shape ratio, and the polar dual polygon |
| 5b | The wheel *(added remark)* | Wachspress weights as the spoke stresses of a wheel in equilibrium; the dual polygon as Maxwell's force diagram; comparison with mean value and discrete harmonic weights |
| 6 | Polyhedra *(added illustration)* | the same construction in 3D, with the dual polyhedron and its pyramids |
| 7 | Adjoint | the adjoint curve through the external intersection points |
| 8 | Line space | tetrahedral line complex and the octahedron (hypersimplex) |
| 9 | Disc | simple pole (polygons) versus branch point (disc) |
| 10 | Polycons *(later development)* | adjoint curves of regions with curved sides; Brüser's 2026 counterexample to Wachspress' conjecture |
| 11 | Polycon basis *(later development)* | Wachspress' own basis on the pizza slice, with a movable side node; not positive |
| 12 | Dual measure *(later development)* | canonical function as an integral over the dual with a density (Mazzucchelli–Raman) |
| 12b | Cone and cut *(added remark)* | 3D view: the cone of the edge normals is fixed, the point x chooses the cutting plane; the cut is the dual polygon |
| 12c | Spline on the dual *(added remark)* | the multivariate spline of the edge normals on the dual polygon; its Laplace transform is 1/Πh, the adjoint is the ratio to the uniform density |
| 12d | Removing vectors *(added remark)* | a derivative along an edge normal removes it from the spline; three vectors left give a flat triangle |
| 12e | One variable *(added remark)* | B-spline as the shadow of a simplex; 1/Π(x − tᵢ), its partial fractions and Lagrange's barycentric weights |
| 12f | Fibre polytope *(added remark)* | Duistermaat–Heckman: the spline value is the volume of the fibre polytope (reduced space); sides disappear across the diagonals |
| 12g | Volume minimisation *(added remark)* | the canonical function as the Martelli–Sparks–Yau volume of a toric cone; its minimum is the Santaló point; R-charges as Wachspress coordinates |
| 12h | Moment curve *(added remark)* | quadratic Lagrange basis as the coordinates of a point of a parabola in a triangle on that parabola |
| 12i | Residue theorem *(added remark)* | poles of the barycentric kernel with their residues and a movable circle: the integral is the sum of the enclosed residues |
| 12j | Rational barycentric interpolation *(added remark)* | polynomial, Berrut and Floater–Hormann weights: degree of precision, denominator, Lebesgue function |
| 12k | Poles of the interpolant *(added remark)* | zeros of the denominator in the complex plane for polynomial, Berrut, Floater–Hormann and equal weights; draggable nodes |
| 12l | Hermite's formula *(added remark)* | interpolation error as a contour integral and as a sum over poles; level curves of the node polynomial, Runge phenomenon |
| 12m | Triangulations from a contour *(added remark)* | canonical function of a quadrilateral as an integral with four poles; closing the contour above or below gives its two triangulations |
| 13 | Area vs perimeter *(later development)* | Wachspress and mean value normalisers as area and perimeter of the dual polygon |
| 14 | Smooth limit *(later development)* | inscribed polygons → the kernel of Warren et al. for the circle |
| 15 | Push-forward *(later development)* | quadrilateral from the unit square via the bilinear patch; parallelogram case |

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
Arkani-Hamed–Bai–Lam, 3D linear precision, Brüser's counterexample, …):

```sh
deno test tests/
```

## Code map

```
index.html            all text; each figure is <figure data-figure="NAME">
css/style.css         design tokens (light + dark theme), layout, components
js/main.js            typesets formulas, starts every figure, activates the theme switch
js/math/              pure mathematics, no DOM — the part worth reusing
  polygon.js            conventions (CCW polygons, edge lines {n, p}), helpers
  canonical.js          canonical functions: segment, triangle, wedge, polygon,
                        adjoint, half disc, pizza slice, disc; polycon data
                        (pizza slice, Brüser's counterexample)
  barycentric.js        coordinates as ratios of forms, classic formulas, polar dual,
                        mean value coordinates
  polytope3d.js         simple polyhedra from face planes, 3D Wachspress, 3D dual
  pushforward.js        inverse bilinear map (complex roots), push-forward of the square's form
  splines.js            multivariate (cone) splines of a polygon, adjoint as an operator, B-splines
  toric.js              fibre polytopes (Duistermaat–Heckman), link volume and its minimiser (Santaló point)
  interp.js             one variable: barycentric formula for any weights, Hermite contour integral, potentials, moment curve, residues, poles of rational interpolants
  contour.js            canonical function of a quadrilateral as a contour integral with four poles
js/ui/
  stage.js              canvas wrapper: world coordinates, hi-DPI, draggable handles
  ramp.js               sequential colour ramp (heat map, 3D surface)
  theme.js              light / dark switch: follows the system until the reader chooses
  nav.js                contents panel, heading links, scroll tracking, links for "Figure N" / "Section N", back to top
  contour.js            marching squares for implicit curves
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

Navigation is generated from the page (`js/ui/nav.js`): the contents panel lists every
`h2`–`h4`, and "Figure 5" or "Section 8.2" in the text becomes a link automatically, so
new sections and figures need no extra markup beyond a caption that starts with
`<strong>Figure N.</strong>`. The map of topics is the pair of tables at the top of
`js/figures/conceptmap.js`.

Colours come from CSS custom properties in `css/style.css`; never hard-code a
colour in a figure, or it will not follow the theme. The page follows the system's
light or dark setting until the reader uses the switch in the navigation bar; the
choice is kept in `localStorage`. In the DOM use `var(--name)`; on a canvas use
`s.color("name")` inside `draw`, which is called again when the theme changes.
