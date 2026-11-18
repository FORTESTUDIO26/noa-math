/**
 * Accurate SVG / HTML illustrations. Every figure is computed from the same numbers
 * that the question uses, so the drawing always matches the data and the answer.
 */
import { fmt, esc, placeName, digitsOf } from './format';
import type { Rng } from './rng';
import { robotItem } from './space';

type Pt = { x: number; y: number };
const r1 = (v: number) => Math.round(v * 10) / 10;

function bbox(pts: Pt[]) {
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

function svgWrap(vb: string, body: string, label: string, cls = 'fig'): string {
  return `<svg class="${cls}" viewBox="${vb}" direction="ltr" role="img" aria-label="${esc(label)}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
}

/* ---------------------------------------------------------------- number line */

export interface NumberLineOpts {
  start: number;
  step: number;
  count: number; // number of ticks
  labeled: number[]; // indices with visible numbers
  unknown?: number; // index with "?"
  jumps?: boolean; // draw jump arcs with "+step" labels (lesson)
  answerShown?: boolean; // write the value under unknown instead of "?"
}

export function numberLine(o: NumberLineOpts): string {
  const W = 340, mx = 26, y = 62;
  const sp = (W - 2 * mx) / (o.count - 1);
  const X = (i: number) => r1(mx + i * sp);
  const longest = fmt(o.start + o.step * (o.count - 1)).length;
  const fs = longest >= 5 ? 13 : 15;
  let b = '';
  // space track: a rail with stations at equal distances
  b += `<line x1="6" y1="${y}" x2="${W - 4}" y2="${y}" class="nl-rail"/>`;
  b += `<line x1="6" y1="${y}" x2="${W - 4}" y2="${y}" class="nl-line"/>`;
  b += `<path d="M${W - 4} ${y} l-11 -6 v12 z" class="nl-arrow"/>`;
  for (let i = 0; i < o.count; i++) {
    b += `<circle cx="${X(i)}" cy="${y}" r="${i === o.unknown ? 9 : 7}" class="nl-station${i === o.unknown ? ' nl-station-q' : ''}"/>`;
  }
  for (let i = 0; i < o.count; i++) {
    const v = o.start + i * o.step;
    const isUnknown = i === o.unknown;
    b += `<line x1="${X(i)}" y1="${y - 11}" x2="${X(i)}" y2="${y + 11}" class="nl-tick${isUnknown ? ' nl-tick-q' : ''}"/>`;
    if (isUnknown) {
      const w = Math.max(30, fs * 0.62 * longest + 10);
      b += `<rect x="${r1(X(i) - w / 2)}" y="${y + 17}" width="${r1(w)}" height="26" rx="6" class="nl-qbox"/>`;
      b += `<text x="${X(i)}" y="${y + 36}" class="nl-q" font-size="${fs + 2}">${o.answerShown ? fmt(v) : '?'}</text>`;
    } else if (o.labeled.includes(i)) {
      b += `<text x="${X(i)}" y="${y + 36}" class="nl-label" font-size="${fs}">${fmt(v)}</text>`;
    }
  }
  if (o.jumps) {
    for (let i = 0; i < o.count - 1; i++) {
      const x1 = X(i) + 3, x2 = X(i + 1) - 3, xm = (x1 + x2) / 2;
      b += `<path d="M${r1(x1)} ${y - 13} Q${r1(xm)} ${y - 40} ${r1(x2)} ${y - 13}" class="nl-jump"/>`;
      b += `<text x="${r1(xm)}" y="${y - 32}" class="nl-jlabel" font-size="12">+${fmt(o.step)}</text>`;
    }
  }
  const label = `מסלול חלל (ישר מספרים) עם ${o.count} תחנות במרווחים שווים` + (o.unknown !== undefined ? ' ותחנה עם סימן שאלה' : '');
  return svgWrap(`0 0 ${W} 110`, b, label, 'fig fig-wide');
}

/* ---------------------------------------------------------------- angles */

const rad = (d: number) => (d * Math.PI) / 180;
const dirPt = (deg: number, len: number, o: Pt = { x: 0, y: 0 }): Pt => ({
  x: o.x + Math.cos(rad(deg)) * len,
  y: o.y - Math.sin(rad(deg)) * len, // svg y goes down
});

export interface AngleOpts {
  deg: number; // angle size
  rot: number; // direction of first ray
  closed?: boolean; // draw third side (triangle) – marked angle inside a shape
  guide?: boolean; // dashed "corner of a page" (right angle) for comparison (lesson)
  len1?: number;
  len2?: number;
  size?: 'normal' | 'small';
}

export function angleFigure(o: AngleOpts): string {
  const L1 = o.len1 ?? 100, L2 = o.len2 ?? 100;
  const V = { x: 0, y: 0 };
  const P1 = dirPt(o.rot, L1), P2 = dirPt(o.rot + o.deg, L2);
  const pts: Pt[] = [V, P1, P2];
  let b = '';
  if (o.guide) {
    const G1 = dirPt(o.rot, 70), G2 = dirPt(o.rot + 90, 70);
    pts.push(G1, G2);
    b += `<polyline points="${r1(G1.x)},${r1(G1.y)} 0,0 ${r1(G2.x)},${r1(G2.y)}" class="ang-guide"/>`;
    const A = dirPt(o.rot, 14), C = dirPt(o.rot + 90, 14);
    b += `<polyline points="${r1(A.x)},${r1(A.y)} ${r1(A.x + C.x)},${r1(A.y + C.y)} ${r1(C.x)},${r1(C.y)}" class="ang-guide"/>`;
  }
  if (o.closed) {
    b += `<polygon points="0,0 ${r1(P1.x)},${r1(P1.y)} ${r1(P2.x)},${r1(P2.y)}" class="shape"/>`;
  } else {
    b += `<line x1="0" y1="0" x2="${r1(P1.x)}" y2="${r1(P1.y)}" class="ray"/>`;
    b += `<line x1="0" y1="0" x2="${r1(P2.x)}" y2="${r1(P2.y)}" class="ray"/>`;
  }
  // marker: square for a right angle, double arc otherwise (shape-based, not colour-only)
  if (o.deg === 90) {
    const s = 18;
    const A = dirPt(o.rot, s), C = dirPt(o.rot + 90, s);
    const B = { x: A.x + C.x, y: A.y + C.y };
    b += `<polyline points="${r1(A.x)},${r1(A.y)} ${r1(B.x)},${r1(B.y)} ${r1(C.x)},${r1(C.y)}" class="ang-mark"/>`;
  } else {
    for (const r of [24, 30]) {
      const S = dirPt(o.rot, r), E = dirPt(o.rot + o.deg, r);
      const large = o.deg > 180 ? 1 : 0;
      b += `<path d="M${r1(S.x)} ${r1(S.y)} A${r} ${r} 0 ${large} 0 ${r1(E.x)} ${r1(E.y)}" class="ang-mark"/>`;
    }
  }
  b += `<circle cx="0" cy="0" r="5" class="vertex"/>`;
  const bb = bbox(pts.concat([dirPt(o.rot, 34), dirPt(o.rot + o.deg / 2, 34), dirPt(o.rot + o.deg, 34)]));
  const pad = 14;
  const vb = `${r1(bb.minX - pad)} ${r1(bb.minY - pad)} ${r1(bb.maxX - bb.minX + 2 * pad)} ${r1(bb.maxY - bb.minY + 2 * pad)}`;
  return svgWrap(vb, b, o.closed ? 'צורה עם זווית מסומנת' : 'זווית', o.size === 'small' ? 'fig fig-small' : 'fig');
}

/* ---------------------------------------------------------------- polygons */

export function polygonPoints(rng: Rng, n: number, irregular: boolean, radius: number): Pt[] {
  for (let attempt = 0; attempt < 200; attempt++) {
    const rot = rng.next() * 2 * Math.PI;
    const pts: Pt[] = [];
    for (let i = 0; i < n; i++) {
      const jitter = irregular ? (rng.next() - 0.5) * 0.5 * ((2 * Math.PI) / n) : 0;
      const a = rot + (i * 2 * Math.PI) / n + jitter;
      const r = irregular ? radius * (0.78 + rng.next() * 0.22) : radius;
      pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
    }
    if (isGoodPolygon(pts, radius)) return pts;
  }
  // fallback: regular
  return Array.from({ length: n }, (_, i) => ({ x: Math.cos((i * 2 * Math.PI) / n) * radius, y: Math.sin((i * 2 * Math.PI) / n) * radius }));
}

/** convex, no tiny sides, no almost-straight corners (so every side is countable) */
export function isGoodPolygon(pts: Pt[], radius: number): boolean {
  const n = pts.length;
  let sign = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n], c = pts[(i + 2) % n];
    const side = Math.hypot(b.x - a.x, b.y - a.y);
    if (side < radius * (n >= 8 ? 0.45 : 0.55)) return false;
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    const s = Math.sign(cross);
    if (s === 0) return false;
    if (sign === 0) sign = s; else if (s !== sign) return false;
    // turning angle must be clear (corner visible)
    const v1 = { x: b.x - a.x, y: b.y - a.y }, v2 = { x: c.x - b.x, y: c.y - b.y };
    const cos = (v1.x * v2.x + v1.y * v2.y) / (Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y));
    if (cos > Math.cos(rad(20))) return false; // turn smaller than 20° → corner hard to see
  }
  return true;
}

export function polygonFigure(pts: Pt[], opts: { numberSides?: boolean; size?: 'normal' | 'small' } = {}): string {
  const S = 110; // fixed frame so different radii look like different sizes
  const P = pts.map((p) => ({ x: p.x + S, y: p.y + S }));
  let b = `<polygon points="${P.map((p) => `${r1(p.x)},${r1(p.y)}`).join(' ')}" class="shape"/>`;
  for (const p of P) b += `<circle cx="${r1(p.x)}" cy="${r1(p.y)}" r="4.5" class="vertex"/>`;
  if (opts.numberSides) {
    const cx = P.reduce((s, p) => s + p.x, 0) / P.length, cy = P.reduce((s, p) => s + p.y, 0) / P.length;
    P.forEach((a, i) => {
      const c = P[(i + 1) % P.length];
      const mx = (a.x + c.x) / 2, my = (a.y + c.y) / 2;
      const d = Math.hypot(mx - cx, my - cy) || 1;
      const lx = mx + ((mx - cx) / d) * 17, ly = my + ((my - cy) / d) * 17;
      b += `<circle cx="${r1(lx)}" cy="${r1(ly)}" r="11" class="side-badge"/><text x="${r1(lx)}" y="${r1(ly + 5)}" class="side-num">${i + 1}</text>`;
    });
  }
  return svgWrap(`0 0 ${2 * S} ${2 * S}`, b, `מצולע עם ${pts.length} צלעות`, opts.size === 'small' ? 'fig fig-small' : 'fig');
}

/** shapes that are NOT polygons (for "which is not a polygon?") */
export function nonPolygonFigure(kind: 'circle' | 'curved' | 'open', rng: Rng): string {
  const S = 110;
  let b = '';
  if (kind === 'circle') {
    const r = 60 + rng.int(0, 30);
    b = `<circle cx="${S}" cy="${S}" r="${r}" class="shape"/>`;
  } else if (kind === 'curved') {
    b = `<path d="M50 160 L170 160 L170 80 Q110 20 50 80 Z" class="shape"/>`;
  } else {
    b = `<polyline points="60,70 160,60 170,160 50,150" class="shape-open"/>`;
  }
  return svgWrap(`0 0 ${2 * S} ${2 * S}`, b, 'צורה', 'fig fig-small');
}

/* ---------------------------------------------------------------- triangles */

export function triangleVertices(a: number, b: number, c: number): Pt[] | null {
  // A=(0,0), B=(c,0); |AC| = b, |BC| = a
  if (a + b <= c || a + c <= b || b + c <= a) return null;
  const cx = (b * b - a * a + c * c) / (2 * c);
  const cy = Math.sqrt(Math.max(0, b * b - cx * cx));
  return [{ x: 0, y: 0 }, { x: c, y: 0 }, { x: cx, y: -cy }];
}

export function minAngleDeg(a: number, b: number, c: number): number {
  const ang = (x: number, y: number, z: number) => (Math.acos((y * y + z * z - x * x) / (2 * y * z)) * 180) / Math.PI;
  return Math.min(ang(a, b, c), ang(b, a, c), ang(c, a, b));
}

export interface TriangleOpts {
  sides: [number, number, number]; // lengths in cm: [a (B–C), b (A–C), c (A–B)]
  rot: number; // degrees
  lengths?: boolean;
  ticks?: boolean;
  size?: 'normal' | 'small';
  highlightEqual?: boolean;
}

export function triangleFigure(o: TriangleOpts): string {
  const [a, b, c] = o.sides;
  const base = triangleVertices(a, b, c);
  if (!base) throw new Error('invalid triangle');
  const k = 26; // px per cm – drawing is to scale
  const cosr = Math.cos(rad(o.rot)), sinr = Math.sin(rad(o.rot));
  const P = base.map((p) => ({ x: (p.x * cosr - p.y * sinr) * k, y: (p.x * sinr + p.y * cosr) * k }));
  const cx = (P[0].x + P[1].x + P[2].x) / 3, cy = (P[0].y + P[1].y + P[2].y) / 3;
  // sides: c = P0-P1, a = P1-P2, b = P2-P0
  const sides: { p: Pt; q: Pt; len: number }[] = [
    { p: P[0], q: P[1], len: c },
    { p: P[1], q: P[2], len: a },
    { p: P[2], q: P[0], len: b },
  ];
  const counts = new Map<number, number>();
  for (const s of sides) counts.set(s.len, (counts.get(s.len) ?? 0) + 1);
  let body = `<polygon points="${P.map((p) => `${r1(p.x)},${r1(p.y)}`).join(' ')}" class="shape"/>`;
  const extra: Pt[] = [];
  for (const s of sides) {
    const mx = (s.p.x + s.q.x) / 2, my = (s.p.y + s.q.y) / 2;
    const dx = s.q.x - s.p.x, dy = s.q.y - s.p.y, d = Math.hypot(dx, dy);
    const nx = -dy / d, ny = dx / d; // normal
    // outward normal
    const out = (mx + nx - cx) ** 2 + (my + ny - cy) ** 2 > (mx - cx) ** 2 + (my - cy) ** 2 ? 1 : -1;
    const ox = nx * out, oy = ny * out;
    const equal = (counts.get(s.len) ?? 0) >= 2;
    if (o.ticks && equal) {
      const t = 9;
      body += `<line x1="${r1(mx - ox * t)}" y1="${r1(my - oy * t)}" x2="${r1(mx + ox * t)}" y2="${r1(my + oy * t)}" class="tick"/>`;
    }
    if (o.lengths) {
      const lx = mx + ox * 22, ly = my + oy * 22;
      extra.push({ x: lx - 14, y: ly - 14 }, { x: lx + 14, y: ly + 14 });
      const cls = o.highlightEqual && equal ? 'len len-eq' : 'len';
      body += `<text x="${r1(lx)}" y="${r1(ly + 6)}" class="${cls}">${s.len}</text>`;
    }
  }
  for (const p of P) body += `<circle cx="${r1(p.x)}" cy="${r1(p.y)}" r="4" class="vertex"/>`;
  const bb = bbox(P.concat(extra));
  const pad = 16;
  const vb = `${r1(bb.minX - pad)} ${r1(bb.minY - pad)} ${r1(bb.maxX - bb.minX + 2 * pad)} ${r1(bb.maxY - bb.minY + 2 * pad)}`;
  const lab = o.lengths ? `משולש עם צלעות באורך ${c}, ${a} ו-${b} סנטימטר` : 'משולש';
  return svgWrap(vb, body, lab, o.size === 'small' ? 'fig fig-small' : 'fig');
}

/* ---------------------------------------------------------------- equal groups */

export function groupsFigure(counts: number[], opts: { numbered?: boolean; perLabel?: boolean; size?: 'normal' | 'small'; item?: 'dot' | 'star' | 'robot' } = {}): string {
  const maxC = Math.max(...counts);
  const cols = maxC <= 4 ? 2 : 3;
  const rows = Math.ceil(maxC / cols);
  const cell = 22;
  const bw = cols * cell + 16, bh = rows * cell + 16;
  const perRow = counts.length <= 4 ? counts.length : Math.ceil(counts.length / 2);
  const gap = 14;
  const top = opts.numbered ? 26 : 8;
  const rowH = bh + gap + (opts.perLabel ? 22 : 0) + (opts.numbered ? 22 : 0);
  const W = 16 + perRow * bw + (perRow - 1) * gap;
  let b = '';
  counts.forEach((cnt, gi) => {
    // group 1 on the right (Hebrew reading order)
    const gx = W - 8 - bw - (gi % perRow) * (bw + gap);
    const gy = top + Math.floor(gi / perRow) * rowH;
    b += `<rect x="${gx}" y="${gy}" width="${bw}" height="${bh}" rx="12" class="grp"/>`;
    if (opts.numbered) b += `<text x="${gx + bw / 2}" y="${gy - 7}" class="grp-num" direction="rtl">קבוצה ${gi + 1}</text>`;
    for (let k = 0; k < cnt; k++) {
      const x = gx + 8 + (k % cols) * cell + cell / 2;
      const y = gy + 8 + Math.floor(k / cols) * cell + cell / 2;
      b += opts.item === 'robot'
        ? robotItem(x, y)
        : opts.item === 'star'
          ? `<path d="${starPath(x, y, 9)}" class="item"/>`
          : `<circle cx="${x}" cy="${y}" r="8" class="item"/>`;
    }
    if (opts.perLabel) b += `<text x="${gx + bw / 2}" y="${gy + bh + 18}" class="grp-count">${cnt}</text>`;
  });
  const H = top + Math.ceil(counts.length / perRow) * rowH - gap - (opts.numbered ? 22 : 0) + 6;
  const label = `${counts.length} קבוצות: ` + counts.join(', ');
  return svgWrap(`0 0 ${W} ${H}`, b, label, opts.size === 'small' ? 'fig fig-small' : 'fig');
}

function starPath(cx: number, cy: number, r: number): string {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    d += (i === 0 ? 'M' : 'L') + r1(cx + Math.cos(a) * rr) + ' ' + r1(cy + Math.sin(a) * rr);
  }
  return d + 'Z';
}

/* ---------------------------------------------------------------- HTML helpers */

/** Sequence boxes, left-to-right. blank index shows "?" */
export function sequenceFigure(terms: number[], blank: number | number[], opts: { steps?: boolean; showAnswer?: boolean } = {}): string {
  const blanks = Array.isArray(blank) ? blank : [blank];
  const cells: string[] = [];
  terms.forEach((t, i) => {
    if (i > 0 && opts.steps) {
      const d = t - terms[i - 1];
      cells.push(`<span class="seq-step">${d > 0 ? '+' : '−'}${fmt(Math.abs(d))}</span>`);
    } else if (i > 0) cells.push('<span class="seq-comma">,</span>');
    const isB = blanks.includes(i);
    cells.push(isB
      ? `<span class="seq-box seq-blank">${opts.showAnswer ? fmt(t) : '?'}</span>`
      : `<span class="seq-box">${fmt(t)}</span>`);
  });
  return `<div class="seq" dir="ltr" role="img" aria-label="סדרה">${cells.join('')}</div><div class="seq-dir" aria-hidden="true">קוראים משמאל לימין ⟶</div>`;
}

/** Place-value table (LTR: thousands on the left). highlight = place index (0 = units). */
export function placeTable(n: number, opts: { highlight?: number; minPlaces?: number } = {}): string {
  const ds = digitsOf(n);
  const places = Math.max(ds.length, opts.minPlaces ?? 0);
  let cols = '';
  for (let p = places - 1; p >= 0; p--) {
    const hi = p === opts.highlight;
    cols += `<div class="pv-col${hi ? ' pv-hi' : ''}"><div class="pv-digit">${ds[p] ?? 0}</div>${hi ? '<div class="pv-arrow" aria-hidden="true">▲</div>' : ''}<div class="pv-name">${placeName(p)}</div></div>`;
  }
  return `<div class="pv" dir="ltr">${cols}</div>`;
}
