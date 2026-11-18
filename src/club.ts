/**
 * "מועדון החיות של נועה" – original kawaii characters drawn in SVG:
 *   חתלתולה עם סרט (kitten), כלבלב עם בנדנה (puppy), בובת ארנבת (bunny doll).
 * Plus the activity art: a chest of drawers (place value) with packs of 1/10/100/1000,
 * bowls of treats (multiplication / division) and small treats for counting groups.
 */
import { fmt, m, placeName, digitsOf, X } from './format';

export type Mood = 'happy' | 'cheer' | 'think' | 'oops' | 'wave';
export type Who = 'kitten' | 'puppy' | 'bunny';

/* ------------------------------------------------------------- shared face parts (80×80 box) */

function eyes(mood: Mood, y: number, dx = 9): string {
  const l = 40 - dx, r = 40 + dx;
  if (mood === 'cheer') return `<path d="M${l - 4} ${y + 1} q4 -5 8 0 M${r - 4} ${y + 1} q4 -5 8 0" class="c-line"/>`;
  if (mood === 'think') return `<ellipse cx="${l + 1}" cy="${y - 1}" rx="3" ry="3.6" class="c-eye"/><ellipse cx="${r + 1}" cy="${y - 1}" rx="3" ry="3.6" class="c-eye"/><circle cx="${l + 2}" cy="${y - 2.5}" r="1.1" class="c-shine"/><circle cx="${r + 2}" cy="${y - 2.5}" r="1.1" class="c-shine"/>`;
  return `<ellipse cx="${l}" cy="${y}" rx="3.3" ry="4" class="c-eye"/><ellipse cx="${r}" cy="${y}" rx="3.3" ry="4" class="c-eye"/><circle cx="${l + 1.2}" cy="${y - 1.5}" r="1.3" class="c-shine"/><circle cx="${r + 1.2}" cy="${y - 1.5}" r="1.3" class="c-shine"/>`;
}
function mouth(mood: Mood, y: number): string {
  if (mood === 'cheer') return `<path d="M35.5 ${y - 1} q4.5 7 9 0 z" class="c-mouth-open"/>`;
  if (mood === 'oops') return `<ellipse cx="40" cy="${y + 1}" rx="2.4" ry="2.1" class="c-mouth-open"/>`;
  if (mood === 'think') return `<path d="M37 ${y + 1} h6" class="c-line"/>`;
  return `<path d="M36 ${y} q2 2.6 4 0 q2 2.6 4 0" class="c-line"/>`;
}
const blush = (y: number, dx = 15) => `<ellipse cx="${40 - dx}" cy="${y}" rx="4.2" ry="2.6" class="c-blush"/><ellipse cx="${40 + dx}" cy="${y}" rx="4.2" ry="2.6" class="c-blush"/>`;
const extras = (mood: Mood) =>
  mood === 'think' ? '<circle cx="70" cy="14" r="2.6" class="c-bubble"/><circle cx="75" cy="6" r="3.8" class="c-bubble"/>'
    : mood === 'oops' ? '<path d="M66 22 q3 5 0 8 q-3 -3 0 -8 z" class="c-drop"/>'
      : mood === 'cheer' ? '<path d="M6 18 l2 -5 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 z" class="c-spark"/><path d="M71 30 l1.5 -4 l1.5 4 l4 1.5 l-4 1.5 l-1.5 4 l-1.5 -4 l-4 -1.5 z" class="c-spark"/>'
        : '';

/* ------------------------------------------------------------- the three friends */

function kittenBody(mood: Mood, full: boolean): string {
  const pawUp = mood === 'cheer' || mood === 'wave';
  const body = full
    ? `<path d="M22 78 q-2 -22 18 -24 q20 2 18 24 z" class="k-fur"/><path d="M58 70 q14 -2 12 -16" class="k-tail"/>
       <ellipse cx="32" cy="77" rx="6" ry="3.5" class="k-fur"/><ellipse cx="48" cy="77" rx="6" ry="3.5" class="k-fur"/>`
    : '';
  const paw = pawUp
    ? `<g class="anim-paw"><path d="M60 52 q8 -8 6 -20" class="k-arm"/><circle cx="66" cy="30" r="5" class="k-fur"/><path d="M64 28 v3 M67 28 v3" class="c-line-thin"/></g>`
    : full ? '<ellipse cx="33" cy="62" rx="5" ry="4" class="k-fur"/><ellipse cx="47" cy="62" rx="5" ry="4" class="k-fur"/>' : '';
  return `${body}
    <path d="M17 34 L19 9 L36 22 Z" class="k-fur"/><path d="M63 34 L61 9 L44 22 Z" class="k-fur"/>
    <path d="M21 28 L22 15 L31 22 Z" class="c-inner"/><path d="M59 28 L58 15 L49 22 Z" class="c-inner"/>
    <ellipse cx="40" cy="38" rx="25" ry="21" class="k-fur"/>
    <path d="M30 18 q4 4 0 8 M37 16 q3 4 0 8" class="k-stripe"/>
    ${eyes(mood, 38)}${blush(45)}${mouth(mood, 45)}
    <path d="M14 43 h9 M14 47 l9 -1 M66 43 h-9 M66 47 l-9 -1" class="c-whisker"/>
    <path d="M38 41.5 l2 2 l2 -2 z" class="c-nose"/>
    <g class="k-bow"><path d="M52 14 l-9 -7 v14 z" class="bow"/><path d="M52 14 l9 -7 v14 z" class="bow"/><circle cx="52" cy="14" r="3.2" class="bow-knot"/></g>
    ${paw}`;
}

function puppyBody(mood: Mood, full: boolean): string {
  const wag = mood === 'cheer' || mood === 'wave' || mood === 'happy';
  const body = full
    ? `<path d="M22 79 q-1 -22 18 -24 q19 2 18 24 z" class="p-fur"/>
       <g class="${wag ? 'anim-tail' : ''}"><path d="M57 68 q12 -4 13 -16" class="p-tail"/></g>
       <ellipse cx="32" cy="78" rx="6" ry="3.4" class="p-fur"/><ellipse cx="48" cy="78" rx="6" ry="3.4" class="p-fur"/>
       <ellipse cx="34" cy="64" rx="5" ry="4" class="p-fur"/><ellipse cx="46" cy="64" rx="5" ry="4" class="p-fur"/>`
    : '';
  return `${body}
    <path d="M24 55 L40 66 L56 55 Z" class="bandana"/><circle cx="36" cy="58" r="1.3" class="bandana-dot"/><circle cx="44" cy="58" r="1.3" class="bandana-dot"/><circle cx="40" cy="62" r="1.3" class="bandana-dot"/>
    <ellipse cx="40" cy="38" rx="24" ry="21" class="p-fur"/>
    <ellipse cx="17" cy="38" rx="7" ry="15" transform="rotate(18 17 38)" class="p-ear"/>
    <ellipse cx="63" cy="38" rx="7" ry="15" transform="rotate(-18 63 38)" class="p-ear"/>
    <ellipse cx="48" cy="30" rx="6" ry="5" class="p-patch"/>
    ${eyes(mood, 36, 10)}${blush(45, 16)}
    <ellipse cx="40" cy="46" rx="9" ry="6.5" class="p-snout"/>
    <ellipse cx="40" cy="42.5" rx="3.6" ry="2.6" class="c-nose"/>
    ${mouth(mood, 48)}`;
}

function bunnyBody(mood: Mood, full: boolean): string {
  const earTilt = mood === 'think' ? 'rotate(-14 30 20)' : '';
  const paw = mood === 'cheer' || mood === 'wave'
    ? '<g class="anim-paw"><path d="M60 58 q8 -8 6 -18" class="b-arm"/><circle cx="66" cy="38" r="5" class="b-fur"/></g>' : '';
  const body = full
    ? `<path d="M23 79 q-2 -21 17 -23 q19 2 17 23 z" class="b-fur"/><path d="M40 58 v20" class="c-stitch"/>
       <circle cx="40" cy="66" r="2" class="b-button"/>
       <ellipse cx="31" cy="78" rx="6" ry="3.4" class="b-fur"/><ellipse cx="49" cy="78" rx="6" ry="3.4" class="b-fur"/>
       <ellipse cx="29" cy="63" rx="4.5" ry="5" class="b-fur"/>`
    : '';
  return `${body}
    <g transform="${earTilt}"><ellipse cx="30" cy="12" rx="7" ry="17" class="b-fur"/><ellipse cx="30" cy="13" rx="3.4" ry="12" class="c-inner"/></g>
    <g transform="rotate(16 50 20)"><ellipse cx="50" cy="12" rx="7" ry="17" class="b-fur"/><ellipse cx="50" cy="13" rx="3.4" ry="12" class="c-inner"/></g>
    <ellipse cx="40" cy="40" rx="23" ry="20" class="b-fur"/>
    <path d="M40 21 v6 M22 40 h4 M54 40 h4" class="c-stitch"/>
    ${eyes(mood, 40, 9)}${blush(47, 14)}
    <path d="M38 45 l2 2 l2 -2 z" class="c-nose"/>
    ${mouth(mood, 48)}
    ${paw}`;
}

const BODIES: Record<Who, (m: Mood, full: boolean) => string> = { kitten: kittenBody, puppy: puppyBody, bunny: bunnyBody };
const NAMES: Record<Who, string> = { kitten: 'חתלתולה עם סרט', puppy: 'כלבלב עם בנדנה', bunny: 'בובת ארנבת' };

/** a friend as an <svg>. full = whole body, otherwise head (+ paw) only */
export function friend(who: Who, mood: Mood = 'happy', size = 56, full = false): string {
  return `<svg class="friend friend-${who} mood-${mood}" width="${size}" height="${size}" viewBox="-2 -2 84 84" aria-hidden="true" focusable="false">${extras(mood)}${BODIES[who](mood, full)}</svg>`;
}
/** the same drawing as a nested svg placed inside a bigger scene */
export function friendAt(who: Who, mood: Mood, x: number, y: number, size: number, full = true): string {
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="-2 -2 84 84" class="friend friend-${who} mood-${mood}" aria-label="${NAMES[who]}" role="img">${extras(mood)}${BODIES[who](mood, full)}</svg>`;
}

/* ------------------------------------------------------------- treats & bowls */

/** a small bone-shaped treat centred at x,y (countable item) */
export function treat(x: number, y: number): string {
  return `<g class="treat" transform="translate(${x - 8} ${y - 4})"><rect x="3" y="2" width="10" height="4" rx="2"/><circle cx="3" cy="2" r="2.3"/><circle cx="3" cy="6" r="2.3"/><circle cx="13" cy="2" r="2.3"/><circle cx="13" cy="6" r="2.3"/></g>`;
}

/**
 * The puppy shares treats into equal bowls (multiplication & division).
 * Each bowl holds `per` treats, drawn so they can be counted.
 */
export function bowlGroups(groups: number, per: number, opts: { size?: 'normal' | 'small'; numbered?: boolean } = {}): string {
  const cols = per <= 4 ? 2 : per <= 9 ? 3 : 4;
  const rows = Math.ceil(per / cols);
  const cw = 19, ch = 11;
  const bw = cols * cw + 14, treatsH = rows * ch + 4;
  const perRow = groups <= 3 ? groups : groups === 4 ? 2 : 3;
  const gw = Math.max(bw, 40), gap = 12, bowlH = 16;
  const gh = treatsH + bowlH + (opts.numbered ? 16 : 0);
  const W = perRow * gw + (perRow - 1) * gap + 8;
  const H = Math.ceil(groups / perRow) * (gh + gap) - gap + 6;
  let b = '';
  for (let g = 0; g < groups; g++) {
    const gx = W - 4 - gw - (g % perRow) * (gw + gap); // bowl 1 on the right (Hebrew reading order)
    const gy = 3 + Math.floor(g / perRow) * (gh + gap);
    const left = gx + (gw - bw) / 2;
    for (let k = 0; k < per; k++) {
      const r = Math.floor(k / cols), c = k % cols;
      b += treat(left + 7 + c * cw + cw / 2 - 2, gy + 6 + r * ch);
    }
    const by = gy + treatsH;
    b += `<path d="M${left} ${by} h${bw} q-2 ${bowlH} -${bw / 2} ${bowlH} q-${bw / 2 - 2} 0 -${bw / 2} -${bowlH} z" class="bowl"/><path d="M${left + 4} ${by + 5} h${bw - 8}" class="bowl-band"/>`;
    if (opts.numbered) b += `<text x="${gx + gw / 2}" y="${by + bowlH + 13}" class="grp-count">${per}</text>`;
  }
  const svg = `<svg class="fig ${opts.size === 'small' ? 'fig-small' : ''}" viewBox="0 0 ${W} ${H}" direction="ltr" role="img" aria-label="${groups} קערות, בכל קערה ${per} חטיפים" xmlns="http://www.w3.org/2000/svg">${b}</svg>`;
  return `<div class="share">${friend('puppy', 'happy', 46, true)}${svg}</div>`;
}

/* ------------------------------------------------------------- the chest of drawers (place value) */

export interface DrawerOpts {
  /** place index to highlight (0 = units) */
  highlight?: number;
  /** drawers can be opened by tapping */
  interactive?: boolean;
  /** drawer shown open right away */
  open?: number;
  /** text shown before a drawer is opened */
  prompt?: string;
  minPlaces?: number;
  /** stable id so an opened drawer stays open after the screen re-renders */
  id?: string;
}

/** Drawers left → right: אלפים, מאות, עשרות, יחידות (same order as the digits) */
export function drawers(n: number, o: DrawerOpts = {}): string {
  const ds = digitsOf(n);
  const places = Math.max(ds.length, o.minPlaces ?? 0);
  let out = '';
  for (let p = places - 1; p >= 0; p--) {
    const d = ds[p] ?? 0;
    const hi = p === o.highlight;
    const open = p === o.open;
    const cls = `bay${hi ? ' bay-hi' : ''}${open ? ' bay-open' : ''}`;
    const inner = `<span class="bay-name">${placeName(p)}</span><span class="bay-digit">${d}</span>${hi ? '<span class="bay-arrow" aria-hidden="true">▲</span>' : ''}<span class="bay-knob" aria-hidden="true"></span>`;
    out += o.interactive
      ? `<button type="button" class="${cls}" data-act="bay" data-digit="${d}" data-place="${p}" aria-pressed="${open}" aria-label="מגירת ה${placeName(p)}: ${d}">${inner}</button>`
      : `<div class="${cls}">${inner}</div>`;
  }
  const panel = o.open !== undefined
    ? packs(ds[o.open] ?? 0, o.open)
    : o.interactive ? `<div class="packs-prompt">${o.prompt ?? 'לחצי על מגירה כדי לפתוח אותה'}</div>` : '';
  return `<div class="cargo"${o.id ? ` data-cargo-id="${o.id}"` : ''}><div class="ship chest" aria-label="שידת המגירות של הארנבת"><div class="bays" dir="ltr">${out}</div></div>${panel || o.interactive ? `<div class="bay-packs" aria-live="polite">${panel}</div>` : ''}</div>`;
}
/** kept name for older imports */
export const cargoBays = drawers;

/** what is inside an open drawer: d packs of 10^p */
export function packs(d: number, p: number): string {
  const unit = 10 ** p;
  if (d === 0) return `<div class="packs-caption">${friend('bunny', 'oops', 34)}<span>המגירה ריקה: 0 ${placeName(p)}. הערך הוא ${m('0')}.</span></div>`;
  const one = (k: number) => {
    if (p === 0) return `<svg class="pk pk-1" viewBox="0 0 16 16"><rect x="1" y="1" width="14" height="14" rx="3" class="pk-cube"/></svg>`;
    if (p === 1) {
      let r = '<rect x="0.5" y="0.5" width="13" height="101" rx="4" class="pk-wrap-band"/>';
      for (let i = 0; i < 10; i++) r += `<rect x="2" y="${2 + i * 10}" width="10" height="8.5" rx="2" class="pk-cube"/>`;
      return `<svg class="pk pk-10" viewBox="0 0 14 102" aria-label="חבילה ${k} של 10">${r}</svg>`;
    }
    if (p === 2) {
      let r = '<rect x="1" y="1" width="60" height="60" rx="4" class="pk-cube"/>';
      for (let i = 1; i < 10; i++) r += `<line x1="${1 + i * 6}" y1="1" x2="${1 + i * 6}" y2="61" class="pk-grid"/><line x1="1" y1="${1 + i * 6}" x2="61" y2="${1 + i * 6}" class="pk-grid"/>`;
      return `<svg class="pk pk-100" viewBox="0 0 62 62">${r}</svg>`;
    }
    return `<svg class="pk pk-1000" viewBox="0 0 70 70"><path d="M5 20 L25 5 L65 5 L45 20 Z" class="pk-top"/><path d="M45 20 L65 5 L65 50 L45 65 Z" class="pk-side"/><rect x="5" y="20" width="40" height="45" class="pk-cube"/><text x="25" y="48" class="pk-label">1000</text></svg>`;
  };
  let items = '';
  for (let k = 1; k <= d; k++) items += `<span class="pk-wrap">${one(k)}</span>`;
  const caption = p === 0
    ? `${d} ${d === 1 ? 'יחידה' : 'יחידות'} – הערך הוא ${m(fmt(d))}.`
    : `${d} ${d === 1 ? 'חבילה' : 'חבילות'} של ${m(fmt(unit))}: ${m(`${d} ${X} ${fmt(unit)} = ${fmt(d * unit)}`)}`;
  return `<div class="pk-row pk-row-${p}" dir="ltr">${items}</div><div class="packs-caption">${friend('bunny', 'cheer', 44)}<span>${caption}</span></div>`;
}
