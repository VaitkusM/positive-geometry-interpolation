/**
 * slides.test.js — consistency of the slide version with the page.
 *
 * Reads slides.html, index.html, js/build.js and css/style.css as text, so it
 * needs read permission:  deno test --allow-read tests/
 * (without it these checks are skipped).
 */

const root = new URL("../", import.meta.url);
const canRead = Deno.permissions.querySync({ name: "read", path: root }).state === "granted";
/** A file as text; HTML comments are removed (they contain placeholders such as data-figure="NAME"). */
const read = (name) => Deno.readTextFileSync(new URL(name, root)).replace(/<!--[\s\S]*?-->/g, "");
const all = (text, re) => [...text.matchAll(re)].map((m) => m[1]);
const duplicates = (list) => list.filter((x, i) => list.indexOf(x) !== i);

function assert(cond, msg) { if (!cond) throw new Error(msg); }

/** Names registered in the FIGURES table of js/build.js. */
function registeredFigures() {
  const src = read("js/build.js");
  const table = src.slice(src.indexOf("export const FIGURES = {"), src.indexOf("};", src.indexOf("export const FIGURES = {")));
  return new Set(all(table, /^\s*(\w+):\s*init\w+,/gm));
}

Deno.test({
  name: "every figure used on the page and on the slides is registered",
  ignore: !canRead,
  fn() {
    const figures = registeredFigures();
    assert(figures.size >= 20, "the table of figures was not found");
    for (const file of ["index.html", "slides.html"]) {
      const used = all(read(file), /data-figure="([^"]+)"/g);
      assert(used.length > 0, `${file}: no figures found`);
      for (const name of used) assert(figures.has(name), `${file}: figure "${name}" is not registered in js/build.js`);
    }
    // the slides leave no figure of the page out
    const onSlides = new Set(all(read("slides.html"), /data-figure="([^"]+)"/g));
    for (const name of all(read("index.html"), /data-figure="([^"]+)"/g)) {
      assert(onSlides.has(name), `figure "${name}" of the page is missing from the slides`);
    }
  },
});

Deno.test({
  name: "slides: unique ids, a part and a title for each, links into the page that exist",
  ignore: !canRead,
  fn() {
    const html = read("slides.html"), page = read("index.html"), css = read("css/style.css");
    const tags = all(html, /(<section class="slide[^>]*>)/g);
    assert(tags.length >= 30, "slides not found");
    const ids = tags.map((t) => (t.match(/ id="([^"]+)"/) || [])[1]);
    assert(ids.every(Boolean), "a slide has no id");
    assert(duplicates(all(html, / id="([^"]+)"/g)).length === 0, "duplicate ids: " + duplicates(all(html, / id="([^"]+)"/g)));
    for (const tag of tags) {
      assert(/ data-part="[^"]+"/.test(tag), `no data-part: ${tag}`);
      const more = (tag.match(/ data-more="#([^"]+)"/) || [])[1];
      if (more) assert(page.includes(`id="${more}"`), `data-more="#${more}" has no target in index.html`);
      const layouts = (tag.match(/class="slide ([^"]+)"/) || [])[1].split(" ");
      assert(["title", "divider", "text", "side", "stack"].some((l) => layouts.includes(l)), `no layout: ${tag}`);
    }
    // an id that css/style.css styles (such as #later) would pull page styles onto a slide
    for (const id of ids) assert(!new RegExp(`#${id}[\\s,{.:]`).test(css), `slide id "${id}" is styled by css/style.css`);
    // every slide has exactly one heading
    const bodies = html.split(/<section class="slide/).slice(1).map((b) => b.slice(0, b.indexOf("</section>")));
    bodies.forEach((b, i) => assert((b.match(/<h[12][ >]/g) || []).length === 1, `slide "${ids[i]}" needs exactly one h1 / h2`));
    // a side slide has a text column and one figure
    bodies.forEach((b, i) => {
      if (!/^[^>]*\bside\b/.test(b)) return;
      assert(b.includes('<div class="slide-text">') && (b.match(/<figure /g) || []).length === 1, `side slide "${ids[i]}" needs a text column and one figure`);
    });
  },
});
