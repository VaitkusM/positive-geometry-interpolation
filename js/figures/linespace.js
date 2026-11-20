/**
 * linespace.js — Figure 7: the tetrahedral line complex (open problem 5.1).
 *
 * The six edge lines l_ij of a tetrahedron p0 p1 p2 p3 are the vertices of an
 * octahedron (the hypersimplex Δ(2,4)) that describes the boundary structure
 * of the "simplex" of 3D line space G(2,4). Its eight triangular faces come
 * in two kinds:
 *   - lines through a vertex p_i      ↔ face { l_ij, l_ik, l_il }
 *   - lines in a face p_i p_j p_k     ↔ face { l_ij, l_jk, l_ik }
 * Choosing an item highlights the matching pieces of both drawings (SVG).
 */

import { el, sub } from "../ui/widgets.js";

const SVG_NS = "http://www.w3.org/2000/svg";
function svg(tag, attrs = {}, text) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text != null) node.textContent = text;
  return node;
}

/** Tetrahedron vertices in drawing coordinates (viewBox 0 0 260 220). */
const TET = [[34, 186], [206, 186], [160, 104], [46, 30]];
const TET_LABEL_OFFSET = [[-12, 12], [12, 12], [14, -4], [-12, -8]];

/** The six index pairs; l_ij is the line through p_i and p_j. */
const PAIRS = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];
const key = (i, j) => (i < j ? `${i}${j}` : `${j}${i}`);

/** Octahedron: opposite vertices are the pairs of DISJOINT (skew) edges. */
const OCT_3D = { "01": [1, 0, 0], "23": [-1, 0, 0], "02": [0, 1, 0], "13": [0, -1, 0], "03": [0, 0, 1], "12": [0, 0, -1] };
const octPoint = (k) => {
  const [x, y, z] = OCT_3D[k];
  return [130 + 82 * (x - 0.5 * y), 110 - 82 * (z + 0.25 * x + 0.3 * y)];
};
const OCT_LABEL_OFFSET = { "01": [16, 2], "23": [-16, 2], "02": [-14, -8], "13": [15, 10], "03": [0, -10], "12": [0, 16] };

/** The 8 selectable items: 4 vertices and 4 faces of the tetrahedron. */
const ITEMS = [
  ...[0, 1, 2, 3].map((i) => ({
    kind: "vertex", vertex: i,
    label: `lines through ${sub("p", i)}`,
    edges: [0, 1, 2, 3].filter((j) => j !== i).map((j) => key(i, j)),
  })),
  ...[[0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3]].map((f) => ({
    kind: "face", face: f,
    label: `lines in the face ${f.map((i) => sub("p", i)).join("")}`,
    edges: [key(f[0], f[1]), key(f[1], f[2]), key(f[0], f[2])],
  })),
];

export function initLineSpace(root) {
  const tet = svg("svg", { viewBox: "0 0 260 220", role: "img", class: "diagram",
    "aria-label": "Tetrahedron with vertices p0 to p3" });
  const oct = svg("svg", { viewBox: "0 0 260 220", role: "img", class: "diagram",
    "aria-label": "Octahedron whose six vertices are the edge lines of the tetrahedron" });

  // --- tetrahedron: highlight layer, edges, vertices ---
  const tetFace = svg("polygon", { class: "hl-fill", points: "" });
  tet.append(tetFace);
  const tetEdges = {};
  for (const [i, j] of PAIRS) {
    const line = svg("line", { x1: TET[i][0], y1: TET[i][1], x2: TET[j][0], y2: TET[j][1],
      class: "edge" + (key(i, j) === "02" ? " hidden-edge" : "") });
    tetEdges[key(i, j)] = line;
    tet.append(line);
  }
  const tetDots = TET.map((p, i) => {
    const dot = svg("circle", { cx: p[0], cy: p[1], r: 4.5, class: "node" });
    tet.append(dot, svg("text", { x: p[0] + TET_LABEL_OFFSET[i][0], y: p[1] + TET_LABEL_OFFSET[i][1],
      class: "lbl" }, sub("p", i)));
    return dot;
  });

  // --- octahedron: highlight layer, edges (two l's sharing an index), vertices ---
  const octFace = svg("polygon", { class: "hl-fill", points: "" });
  oct.append(octFace);
  const keys = PAIRS.map(([i, j]) => key(i, j));
  for (let a = 0; a < keys.length; a++) {
    for (let b = a + 1; b < keys.length; b++) {
      const shared = [...keys[a]].some((ch) => keys[b].includes(ch));
      if (!shared) continue; // disjoint index pairs are opposite vertices: no edge
      const p = octPoint(keys[a]), q = octPoint(keys[b]);
      oct.append(svg("line", { x1: p[0], y1: p[1], x2: q[0], y2: q[1], class: "edge" }));
    }
  }
  const octDots = {};
  for (const k of keys) {
    const p = octPoint(k);
    octDots[k] = svg("circle", { cx: p[0], cy: p[1], r: 4.5, class: "node" });
    oct.append(octDots[k], svg("text", { x: p[0] + OCT_LABEL_OFFSET[k][0], y: p[1] + OCT_LABEL_OFFSET[k][1],
      class: "lbl" }, sub("l", k)));
  }

  const caption = el("p", { class: "readout", "aria-live": "polite" });
  const buttons = ITEMS.map((item, idx) =>
    el("button", { type: "button", class: "choice", "aria-pressed": "false",
      onclick: () => select(idx), onmouseenter: () => select(idx), onfocus: () => select(idx) }, item.label));

  function select(idx) {
    const item = ITEMS[idx];
    buttons.forEach((b, k) => b.setAttribute("aria-pressed", String(k === idx)));
    for (const k of keys) {
      const on = item.edges.includes(k);
      tetEdges[k].classList.toggle("hl", on);
      octDots[k].classList.toggle("hl", on);
    }
    tetDots.forEach((d, i) => d.classList.toggle("hl", item.kind === "vertex" && item.vertex === i));
    tetFace.setAttribute("points",
      item.kind === "face" ? item.face.map((i) => TET[i].join(",")).join(" ") : "");
    octFace.setAttribute("points", item.edges.map((k) => octPoint(k).join(",")).join(" "));
    const names = item.edges.map((k) => sub("l", k)).join(", ");
    caption.textContent = item.kind === "vertex"
      ? `The three edge lines ${names} pass through ${sub("p", item.vertex)}: they span one face of the octahedron.`
      : `The three edge lines ${names} lie in the plane ${item.face.map((i) => sub("p", i)).join("")}: ` +
        `they span the opposite kind of face.`;
  }

  root.append(
    el("div", { class: "choices wrap", role: "group", "aria-label": "Family of lines" }, buttons),
    el("div", { class: "fig-pair" },
      el("div", {}, el("div", { class: "plot-title" }, "Tetrahedron in 3D space"), tet),
      el("div", {}, el("div", { class: "plot-title" }, "Hypersimplex (octahedron) in line space"), oct)),
    caption);
  select(0);
}
