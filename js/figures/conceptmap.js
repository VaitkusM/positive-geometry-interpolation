/**
 * conceptmap.js — the map of topics at the top of the page.
 *
 * A node-link diagram (SVG): sixteen topics on a grid, joined where the page
 * relates them. Selecting a box shows what the topic is, where it is treated
 * and, for every line that leaves the box, the relation in one sentence.
 *
 * The data are the two tables below. To add a topic, give it a free grid
 * cell; to add a relation, add a line to RELATIONS (neighbouring cells keep
 * the drawing free of crossings).
 */

import { el } from "../ui/widgets.js";

const SVG_NS = "http://www.w3.org/2000/svg";
function svg(tag, attrs = {}, text) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text != null) node.textContent = text;
  return node;
}

/**
 * kind: "core"  the paper's own line of argument (Sections 1–6)
 *       "open"  one of the paper's three open problems
 *       "later" later developments and added remarks
 * at: [column, row] on the grid; name: the topic in the text below the map;
 * title, sub: the two lines in the box; where: [label, id of the target on the page].
 */
const TOPICS = {
  segment: { at: [1, 1], kind: "core", name: "Segment", title: "Segment", sub: "linear interpolation",
    where: [["Section 1", "segment"]],
    text: "Linear interpolation between two points, rewritten so that each weight has a pole at its own end point." },
  triangle: { at: [2, 1], kind: "core", name: "Triangle", title: "Triangle", sub: "area coordinates",
    where: [["Section 2", "triangle"]],
    text: "Barycentric coordinates of a triangle as ratios of areas, with poles on the sides." },
  polygon: { at: [3, 1], kind: "core", name: "Convex polygons", title: "Convex polygons", sub: "Wachspress coordinates",
    where: [["Section 3", "polygon"]],
    text: "Rational coordinates for a convex polygon: the classical construction that the paper explains." },
  polypols: { at: [4, 1], kind: "later", name: "Curved boundaries", title: "Curved boundaries", sub: "polypols and polycons",
    where: [["Section 8.1", "later-polypols"]],
    text: "Regions bounded by arcs of curves. They have canonical forms and adjoint curves too, but not all properties of polygons survive." },
  onevar: { at: [1, 2], kind: "later", name: "More nodes on a line", title: "More nodes on a line", sub: "residues and contours",
    where: [["Section 8.2", "later-contour"]],
    text: "Polynomial and rational interpolation in barycentric form, the residue theorem, and Hermite’s contour integral for the error." },
  forms: { at: [2, 2], kind: "core", name: "Canonical forms", title: "Positive geometries", sub: "canonical forms",
    where: [["Section 4", "positive"]],
    text: "A region with boundary carries one distinguished rational form, with simple poles on the boundary, defined by a recursion over the boundary pieces." },
  ratios: { at: [3, 2], kind: "core", name: "Coordinates as ratios of canonical forms", title: "Coordinates as ratios", sub: "of canonical forms",
    where: [["Section 5", "coordinates"]],
    text: "The central statement of the paper: barycentric coordinates are canonical functions of wedges divided by the canonical function of the polygon." },
  adjoint: { at: [4, 2], kind: "core", name: "Adjoint polynomial", title: "Adjoint polynomial", sub: "the common numerator",
    where: [["Section 6", "adjoint"]],
    text: "The polynomial that remains when the canonical function is put over the product of all edge functions; it vanishes at the intersection points of the edge lines outside the polygon." },
  push: { at: [5, 2], kind: "later", name: "Push-forwards", title: "Push-forwards", sub: "bilinear patches",
    where: [["Section 8.4", "later-pushforward"]],
    text: "A second way to compute a canonical form: carry the form of a simple region along a map onto a complicated one, as the bilinear patch does from a square to a quadrilateral." },
  splines: { at: [1, 3], kind: "open", name: "Splines", title: "Splines", sub: "and integral geometry",
    where: [["Section 7", "open"], ["Section 8.2", "later-splines"]],
    text: "Piecewise polynomials obtained as shadows of simplices and cones. The paper’s third open problem asks how they relate to canonical forms." },
  laplace: { at: [2, 3], kind: "later", name: "Laplace transforms", title: "Laplace transforms", sub: "of dual cones",
    where: [["Section 8.2", "later-transforms"]],
    text: "Canonical functions as Laplace transforms of functions on the dual cone, which also covers regions whose canonical form is not rational." },
  dual: { at: [3, 3], kind: "core", name: "Polar dual", title: "Polar dual", sub: "dual volumes",
    where: [["Section 5", "coordinates"], ["Section 8.2", "later-transforms"]],
    text: "Replace every edge line by a point. The canonical function of a polygon is twice the area of the resulting dual polygon." },
  lines: { at: [4, 3], kind: "open", name: "Line space", title: "Line space", sub: "positive Grassmannian",
    where: [["Section 7", "open"], ["Section 8.5", "later-lines"]],
    text: "The lines of space form a curved four-dimensional space; its positive part is a positive geometry. The paper’s first open problem asks for barycentric coordinates there." },
  toric: { at: [2, 4], kind: "later", name: "Toric and symplectic geometry", title: "Toric and symplectic", sub: "moment maps, volumes",
    where: [["Section 8.2", "later-toric"]],
    text: "The polygon as the diagram of a toric variety: the functions on the dual cone become Duistermaat–Heckman measures, and the canonical function a volume." },
  meanvalue: { at: [3, 4], kind: "open", name: "Mean value coordinates", title: "Mean value", sub: "coordinates",
    where: [["Section 7", "open"], ["Section 8.3", "later-meanvalue"]],
    text: "The other widely used coordinates on polygons; they are not rational. The paper’s second open problem asks whether they fit the same scheme." },
  statics: { at: [4, 4], kind: "later", name: "Statics", title: "Statics", sub: "the wheel, force diagrams",
    where: [["Section 5", "wheel"], ["Section 8.3", "later-meanvalue"]],
    text: "Barycentric weights as forces in the spokes of a wheel that is in equilibrium." },
};

/** [topic, topic, relation in one sentence]. */
const RELATIONS = [
  ["segment", "triangle", "The same step one dimension up: divide by the product of the areas, and the weights get poles on the sides."],
  ["triangle", "polygon", "A polygon has more edges than a triangle; Wachspress’ weights keep poles only on the two edges that meet at the vertex."],
  ["polygon", "polypols", "Wachspress also treated regions with curved sides, the polycons."],
  ["segment", "onevar", "From two nodes to many: the same formula, with a pole at every node."],
  ["segment", "forms", "The sum of the two pole weights is the canonical function of the segment."],
  ["triangle", "forms", "The denominator of the triangle formula is the canonical function of the triangle, the basic positive geometry."],
  ["onevar", "forms", "Partition of unity follows from the residue theorem, as for canonical forms; for Berrut’s weights the denominator is the canonical form of a union of intervals."],
  ["forms", "ratios", "The denominator of the coordinates is the canonical function of the polygon; each numerator is the canonical function of a wedge."],
  ["polygon", "ratios", "Wachspress coordinates are exactly these ratios."],
  ["ratios", "adjoint", "Over a common denominator, the sum of the wedge functions has the adjoint as its numerator."],
  ["polypols", "adjoint", "For curved sides the adjoint curve can enter the region; for a polygon it cannot."],
  ["adjoint", "push", "For a parallelogram the adjoint is constant, the bilinear map is affine and the coordinates are polynomials."],
  ["onevar", "splines", "The B-spline is the real kernel that corresponds to the kernel of the contour integral."],
  ["forms", "laplace", "The canonical function is the Laplace transform of the indicator function of the dual cone."],
  ["splines", "laplace", "The reciprocal of the product of the edge functions is the Laplace transform of a spline; the adjoint, as a differential operator, turns the spline into the indicator function."],
  ["laplace", "dual", "Cut the dual cone by a plane: the Laplace transform becomes the volume of the polar dual."],
  ["ratios", "dual", "Each wedge weight is twice the area of one triangle of the dual polygon, so the weights sum to the canonical function."],
  ["ratios", "lines", "First open problem: can coordinates for lines be defined as ratios of canonical forms?"],
  ["adjoint", "lines", "A first adjoint in line space has been found, for the positive Grassmannian cut by one more hyperplane."],
  ["push", "lines", "The octahedron of line space is the image of the positive Grassmannian under a moment map."],
  ["splines", "toric", "The spline is a Duistermaat–Heckman measure: its value is the volume of a polytope in the fibre of a moment map."],
  ["laplace", "toric", "The transform is the volume of the base of a toric cone, the function minimised by Martelli, Sparks and Yau."],
  ["dual", "toric", "That volume is smallest at the Santaló point, where the dual polygon has its centroid at the origin."],
  ["dual", "meanvalue", "Wachspress weights add up to twice the area of the dual polygon, mean value weights to its perimeter."],
  ["dual", "statics", "The dual polygon is the force diagram of the wheel whose spoke forces are the Wachspress weights."],
  ["meanvalue", "statics", "Force polygons with edges at distance 1/r, 1 or r from the hub give Wachspress, mean value or discrete harmonic weights."],
];

const KINDS = {
  core: "The paper’s argument (Sections 1–6)",
  open: "The paper’s open problems",
  later: "Later developments and added remarks",
};

// drawing constants (viewBox units)
const W = 1000, H = 452, BOX_W = 176, BOX_H = 66;
const centre = ([c, r]) => [100 + 200 * (c - 1), 48 + 118 * (r - 1)];

/** The point where the segment from the centre of a box towards q leaves the box. */
function exitPoint(p, q) {
  const dx = q[0] - p[0], dy = q[1] - p[1];
  const t = Math.min(dx ? BOX_W / 2 / Math.abs(dx) : Infinity, dy ? BOX_H / 2 / Math.abs(dy) : Infinity);
  return [p[0] + t * dx, p[1] + t * dy];
}

export function initConceptMap(root) {
  let selected = "ratios";
  const detail = el("div", { class: "cmap-detail", "aria-live": "polite" });
  const map = svg("svg", { class: "cmap", viewBox: `0 0 ${W} ${H}`, role: "group",
    "aria-label": "Map of the topics of this page and the relations between them" });

  const edges = RELATIONS.map(([a, b]) => {
    const p = centre(TOPICS[a].at), q = centre(TOPICS[b].at), s = exitPoint(p, q), t = exitPoint(q, p);
    const line = svg("line", { class: "edge", x1: s[0], y1: s[1], x2: t[0], y2: t[1] });
    map.append(line);
    return { a, b, line };
  });

  const boxes = {};
  for (const [key, topic] of Object.entries(TOPICS)) {
    const [x, y] = centre(topic.at);
    const g = svg("g", { class: `node ${topic.kind}`, tabindex: "0", role: "button", "aria-pressed": "false",
      "aria-label": `${topic.title} ${topic.sub}. ${topic.where.map((w) => w[0]).join(", ")}` });
    g.append(
      svg("rect", { class: "box", x: x - BOX_W / 2, y: y - BOX_H / 2, width: BOX_W, height: BOX_H, rx: 9 }),
      svg("text", { class: "t1", x, y: y - 13 }, topic.title),
      svg("text", { class: "t2", x, y: y + 5 }, topic.sub),
      svg("text", { class: "t3", x, y: y + 22 }, topic.where.map((w) => w[0].replace("Section ", "§ ")).join(" · ")));
    g.addEventListener("click", () => select(key));
    g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(key); } });
    map.append(g);
    boxes[key] = g;
  }

  // legend, in the free cells on the right
  Object.entries(KINDS).forEach(([kind, label], i) => {
    const x = 812, y = 300 + 46 * i, g = svg("g", { class: `legend-item ${kind}` });
    g.append(svg("rect", { class: "box", x, y: y - 11, width: 30, height: 22, rx: 5 }));
    const words = label.split(" "), half = Math.ceil(words.length / 2);
    g.append(svg("text", { class: "t3 left", x: x + 40, y: y - 6 }, words.slice(0, half).join(" ")),
      svg("text", { class: "t3 left", x: x + 40, y: y + 9 }, words.slice(half).join(" ")));
    map.append(g);
  });

  function select(key) {
    selected = key;
    const topic = TOPICS[key];
    const mine = edges.filter((e) => e.a === key || e.b === key);
    const near = new Set(mine.map((e) => (e.a === key ? e.b : e.a)));
    edges.forEach((e) => {
      e.line.classList.toggle("hl", mine.includes(e));
      e.line.classList.toggle("dim", !mine.includes(e));
    });
    Object.entries(boxes).forEach(([k, g]) => {
      g.classList.toggle("sel", k === key);
      g.classList.toggle("near", near.has(k));
      g.setAttribute("aria-pressed", String(k === key));
    });
    detail.replaceChildren(
      el("p", { class: "cmap-title" }, el("strong", {}, topic.name),
        el("span", { class: "cmap-kind" }, KINDS[topic.kind])),
      el("p", {}, topic.text, " ", el("span", { class: "cmap-where" }, "Read it in ",
        ...topic.where.flatMap(([label, id], i) => [i ? " and " : "", el("a", { href: "#" + id }, label)]), ".")),
      el("p", { class: "cmap-rel-head" }, "How it relates to its neighbours on the map:"),
      el("ul", { class: "cmap-rel" }, mine.map((e) => {
        const other = e.a === key ? e.b : e.a, sentence = RELATIONS[edges.indexOf(e)][2];
        return el("li", {},
          el("button", { type: "button", class: "cmap-jump", onclick: () => { select(other); boxes[other].focus({ preventScroll: true }); } },
            TOPICS[other].name),
          " — ", sentence);
      })));
  }

  root.append(el("div", { class: "cmap-scroll" }, map),
    el("p", { class: "hint" }, "Select a box (click, tap, or Tab and Enter) to see its relations. On a narrow screen the map scrolls sideways."),
    detail);
  select(selected);
}
