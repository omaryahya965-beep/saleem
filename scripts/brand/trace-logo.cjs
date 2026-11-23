// Traces the supplied SALEEM logo (transparent PNG, docs/brand/saleem-logo-source.png) into flat-colour SVG paths:
// the wordmark «سليم» (forest green) and the check symbol: its lower stroke (forest green) and its upper stroke
// (gold). Shapes come from the alpha channel (marching squares + Douglas–Peucker); each part's colour is the mean of
// its opaque pixels, flattened (no gradient).
//   node scripts/brand/trace-logo.cjs <repo> <png> <out.json>
const [ROOT, SRC, OUT] = process.argv.slice(2);
const { PNG } = require(ROOT + "/node_modules/pngjs");
const fs = require("fs");
const p = PNG.sync.read(fs.readFileSync(SRC));
const W = p.width,
  H = p.height;
const SPLIT = 950; // gap between the wordmark (x ≤ 933) and the symbol (x ≥ 967)

function grid(x0, x1) {
  const w = x1 - x0 + 3,
    h = H + 2,
    g = new Float32Array(w * h);
  for (let y = 0; y < H; y++)
    for (let x = x0; x <= x1; x++)
      g[(y + 1) * w + (x - x0 + 1)] = p.data[(y * W + x) * 4 + 3] / 255;
  return { g, w, h, ox: x0 - 1, oy: -1 };
}
function trace({ g, w, h, ox, oy }, T = 0.5) {
  const v = (x, y) => g[y * w + x];
  const segs = [];
  const lerp = (a, b) => (T - a) / (b - a);
  for (let y = 0; y < h - 1; y++)
    for (let x = 0; x < w - 1; x++) {
      const a = v(x, y),
        b = v(x + 1, y),
        c = v(x + 1, y + 1),
        d = v(x, y + 1);
      const idx =
        (a > T ? 8 : 0) | (b > T ? 4 : 0) | (c > T ? 2 : 0) | (d > T ? 1 : 0);
      if (idx === 0 || idx === 15) continue;
      const P = {
        t: [`h${x},${y}`, x + lerp(a, b), y],
        r: [`v${x + 1},${y}`, x + 1, y + lerp(b, c)],
        b: [`h${x},${y + 1}`, x + lerp(d, c), y + 1],
        l: [`v${x},${y}`, x, y + lerp(a, d)],
      };
      const center = (a + b + c + d) / 4 > T;
      const table = {
        1: [["l", "b"]],
        2: [["b", "r"]],
        3: [["l", "r"]],
        4: [["t", "r"]],
        5: center
          ? [
              ["l", "t"],
              ["b", "r"],
            ]
          : [
              ["l", "b"],
              ["t", "r"],
            ],
        6: [["t", "b"]],
        7: [["l", "t"]],
        8: [["l", "t"]],
        9: [["t", "b"]],
        10: center
          ? [
              ["t", "r"],
              ["l", "b"],
            ]
          : [
              ["l", "t"],
              ["b", "r"],
            ],
        11: [["t", "r"]],
        12: [["l", "r"]],
        13: [["b", "r"]],
        14: [["l", "b"]],
      };
      for (const [u, q] of table[idx]) segs.push([P[u], P[q]]);
    }
  const map = new Map();
  segs.forEach((s, i) => {
    for (const e of s) {
      if (!map.has(e[0])) map.set(e[0], []);
      map.get(e[0]).push(i);
    }
  });
  const used = new Uint8Array(segs.length),
    loops = [];
  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue;
    used[i] = 1;
    const pts = [segs[i][0], segs[i][1]];
    let cur = segs[i][1][0];
    for (;;) {
      const nx = (map.get(cur) || []).find((j) => !used[j]);
      if (nx === undefined) break;
      used[nx] = 1;
      const s = segs[nx];
      const o = s[0][0] === cur ? s[1] : s[0];
      pts.push(o);
      cur = o[0];
    }
    loops.push(pts.map((e) => [e[1] + ox, e[2] + oy]));
  }
  return loops.filter((l) => l.length > 8);
}
function dp(pts, eps) {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  let md = 0,
    mi = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d =
      Math.abs(
        (b[0] - a[0]) * (a[1] - pts[i][1]) - (a[0] - pts[i][0]) * (b[1] - a[1]),
      ) / (Math.hypot(b[0] - a[0], b[1] - a[1]) || 1);
    if (d > md) ((md = d), (mi = i));
  }
  if (md > eps)
    return dp(pts.slice(0, mi + 1), eps)
      .slice(0, -1)
      .concat(dp(pts.slice(mi), eps));
  return [a, b];
}
function closed(l, eps) {
  let fi = 0,
    fd = 0;
  l.forEach((q, i) => {
    const d = Math.hypot(q[0] - l[0][0], q[1] - l[0][1]);
    if (d > fd) ((fd = d), (fi = i));
  });
  return dp(l.slice(0, fi + 1), eps)
    .slice(0, -1)
    .concat(dp(l.slice(fi), eps).slice(0, -1));
}
const toPath = (loops) =>
  loops
    .map(
      (l) =>
        "M" +
        closed(l, 0.45)
          .map((q) => q[0].toFixed(1) + " " + q[1].toFixed(1))
          .join("L") +
        "Z",
    )
    .join("");
const box = (loops) => {
  let b = [1e9, 1e9, -1e9, -1e9];
  for (const l of loops)
    for (const [x, y] of l)
      b = [
        Math.min(b[0], x),
        Math.min(b[1], y),
        Math.max(b[2], x),
        Math.max(b[3], y),
      ];
  return b.map(Math.round);
};
// Mean colour of opaque pixels inside a box (hex).
function colour([x0, y0, x1, y1], pred = () => true) {
  let n = 0,
    s = [0, 0, 0];
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const i = (y * W + x) * 4;
      if (
        p.data[i + 3] > 240 &&
        pred(p.data[i], p.data[i + 1], p.data[i + 2])
      ) {
        n++;
        s[0] += p.data[i];
        s[1] += p.data[i + 1];
        s[2] += p.data[i + 2];
      }
    }
  return (
    "#" +
    s
      .map((v) =>
        Math.round(v / n)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

const word = trace(grid(0, SPLIT));
const mark = trace(grid(SPLIT, W - 1));
// The upper-right stroke of the symbol is gold; the lower stroke is green.
const markBoxes = mark.map((l) => box([l]));
const goldIdx = markBoxes.reduce(
  (best, b, i) => (b[1] < markBoxes[best][1] ? i : best),
  0,
);
const gold = mark.filter((_, i) => i === goldIdx);
const green = mark.filter((_, i) => i !== goldIdx);
const out = {
  bbox: box([...word, ...mark]),
  markBox: box(mark),
  word: toPath(word),
  markGreen: toPath(green),
  markGold: toPath(gold),
  colours: {
    word: colour(box(word)),
    markGreen: colour(box(green), (r, g) => g > r),
    markGold: colour(box(gold), (r, g) => r > g),
  },
  loops: { word: word.length, mark: mark.length },
};
fs.writeFileSync(OUT, JSON.stringify(out));
console.log(
  JSON.stringify({
    ...out,
    word: out.word.length,
    markGreen: out.markGreen.length,
    markGold: out.markGold.length,
  }),
);
