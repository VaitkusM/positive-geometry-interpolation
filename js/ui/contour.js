/**
 * contour.js — implicit curves { f(x, y) = 0 } for the canvas figures.
 *
 *   zeroSet(f, view, nx)        marching squares → list of line segments
 *   strokeSegments(stage, …)    draw such a list on a Stage
 */

/**
 * Marching squares: line segments approximating { f = 0 } inside `view`.
 * Returns an array of [[x0, y0], [x1, y1]] world-space segments.
 */
export function zeroSet(f, view, nx) {
  const dx = (view.xmax - view.xmin) / nx;
  const ny = Math.round((view.ymax - view.ymin) / dx), dy = (view.ymax - view.ymin) / ny;
  const val = [];
  for (let j = 0; j <= ny; j++) {
    const row = new Float64Array(nx + 1);
    for (let i = 0; i <= nx; i++) row[i] = f(view.xmin + i * dx, view.ymin + j * dy);
    val.push(row);
  }
  const segs = [];
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const x0 = view.xmin + i * dx, y0 = view.ymin + j * dy;
      // corner values, counter-clockwise from the lower-left corner
      const v = [val[j][i], val[j][i + 1], val[j + 1][i + 1], val[j + 1][i]];
      const c = [[x0, y0], [x0 + dx, y0], [x0 + dx, y0 + dy], [x0, y0 + dy]];
      const cross = [];
      for (let e = 0; e < 4; e++) {
        const a = v[e], b = v[(e + 1) % 4];
        if ((a < 0) !== (b < 0)) {
          const t = a / (a - b), p = c[e], q = c[(e + 1) % 4];
          cross.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
        }
      }
      if (cross.length === 2) segs.push([cross[0], cross[1]]);
      else if (cross.length === 4) {
        // saddle cell: use the centre value to decide how to pair the crossings
        const centre = f(x0 + dx / 2, y0 + dy / 2);
        if ((centre < 0) === (v[0] < 0)) segs.push([cross[0], cross[1]], [cross[2], cross[3]]);
        else segs.push([cross[3], cross[0]], [cross[1], cross[2]]);
      }
    }
  }
  return segs;
}

/** Stroke a list of world-space segments [[p, q], …] on a stage. */
export function strokeSegments(stage, segs, color, width = 2, dash = []) {
  const c = stage.ctx;
  c.beginPath();
  for (const [a, b] of segs) {
    const p = stage.toScreen(a), q = stage.toScreen(b);
    c.moveTo(p[0], p[1]);
    c.lineTo(q[0], q[1]);
  }
  c.lineWidth = width;
  c.strokeStyle = color;
  c.setLineDash(dash);
  c.stroke();
  c.setLineDash([]);
}
