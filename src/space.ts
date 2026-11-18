/**
 * Space-station visual language: Robi the robot, spaceship cargo bays (place value),
 * and packs of 1 / 10 / 100 / 1000 that show what a digit is worth.
 */
import { fmt, m, placeName, digitsOf, X } from './format';

export type Mood = 'wave' | 'think' | 'idle' | 'collect';

/** Robi – a small friendly robot. Pure SVG, ~56px. */
export function robot(mood: Mood = 'idle', size = 56): string {
  const armUp = mood === 'wave';
  const mouth = mood === 'think'
    ? '<path d="M24 37 h10" class="rb-line"/>'
    : '<path d="M22 35 q7 6 14 0" class="rb-line"/>';
  const eyes = mood === 'think'
    ? '<circle cx="23" cy="27" r="2.6" class="rb-eye"/><circle cx="36" cy="25" r="2.6" class="rb-eye"/>'
    : '<circle cx="23" cy="27" r="3" class="rb-eye"/><circle cx="35" cy="27" r="3" class="rb-eye"/>';
  const rightArm = armUp
    ? '<g class="rb-arm"><path d="M46 46 L54 32" class="rb-limb"/><circle cx="54" cy="31" r="3.5" class="rb-hand"/></g>'
    : '<path d="M46 48 L53 56" class="rb-limb"/><circle cx="53.5" cy="57" r="3.2" class="rb-hand"/>';
  const thought = mood === 'think' ? '<circle cx="54" cy="10" r="2.5" class="rb-bubble"/><circle cx="59" cy="4" r="3.5" class="rb-bubble"/>' : '';
  const beam = mood === 'collect' ? '<path d="M8 50 L-2 64 L18 64 Z" class="rb-beam"/>' : '';
  return `<svg class="robot robot-${mood}" width="${size}" height="${size}" viewBox="-4 -2 68 70" aria-hidden="true" focusable="false">
    ${beam}
    <line x1="29" y1="12" x2="29" y2="5" class="rb-line"/><circle cx="29" cy="4" r="3.5" class="rb-bulb"/>
    <rect x="12" y="12" width="34" height="30" rx="9" class="rb-head"/>
    <rect x="16" y="18" width="26" height="18" rx="6" class="rb-face"/>
    ${eyes}${mouth}
    <rect x="16" y="42" width="26" height="20" rx="6" class="rb-body"/>
    <circle cx="29" cy="52" r="3" class="rb-light"/>
    <path d="M12 48 L5 56" class="rb-limb"/><circle cx="4.5" cy="57" r="3.2" class="rb-hand"/>
    ${rightArm}${thought}
  </svg>`;
}

/** tiny robot used as a countable item inside multiplication groups (centered at x,y) */
export function robotItem(x: number, y: number): string {
  return `<g class="item-robot" transform="translate(${x - 8} ${y - 9})"><line x1="8" y1="3" x2="8" y2="0.5" class="ir-ant"/><rect x="1" y="3" width="14" height="10" rx="3" class="ir-head"/><circle cx="5.5" cy="8" r="1.5" class="ir-eye"/><circle cx="10.5" cy="8" r="1.5" class="ir-eye"/><rect x="4" y="13" width="8" height="5" rx="1.5" class="ir-body"/></g>`;
}

/* ---------------------------------------------------------------- cargo bays */

export interface CargoOpts {
  /** place index to highlight (0 = units) */
  highlight?: number;
  /** clickable bays that open packs */
  interactive?: boolean;
  /** place whose packs are shown right away */
  open?: number;
  /** text shown in the packs panel before a bay is opened */
  prompt?: string;
  minPlaces?: number;
  /** stable id so an opened bay stays open after the screen re-renders */
  id?: string;
}

/** Four (or three) cargo bays, left → right: אלפים, מאות, עשרות, יחידות */
export function cargoBays(n: number, o: CargoOpts = {}): string {
  const ds = digitsOf(n);
  const places = Math.max(ds.length, o.minPlaces ?? 0);
  let bays = '';
  for (let p = places - 1; p >= 0; p--) {
    const d = ds[p] ?? 0;
    const hi = p === o.highlight;
    const open = p === o.open;
    const cls = `bay${hi ? ' bay-hi' : ''}${open ? ' bay-open' : ''}`;
    const inner = `<span class="bay-door" aria-hidden="true"></span><span class="bay-digit">${d}</span>${hi ? '<span class="bay-arrow" aria-hidden="true">▲</span>' : ''}<span class="bay-name">${placeName(p)}</span>`;
    bays += o.interactive
      ? `<button type="button" class="${cls}" data-act="bay" data-digit="${d}" data-place="${p}" aria-pressed="${open}" aria-label="תא ${placeName(p)}: ${d}">${inner}</button>`
      : `<div class="${cls}">${inner}</div>`;
  }
  const panel = o.open !== undefined
    ? packs(ds[o.open] ?? 0, o.open)
    : o.interactive ? `<div class="packs-prompt">${o.prompt ?? 'לחצי על תא מטען כדי לפתוח אותו'}</div>` : '';
  return `<div class="cargo"${o.id ? ` data-cargo-id="${o.id}"` : ''}><div class="ship" aria-label="תאי המטען של החללית"><div class="bays" dir="ltr">${bays}</div></div>${panel || o.interactive ? `<div class="bay-packs" aria-live="polite">${panel}</div>` : ''}</div>`;
}

/** d packs of 10^p, drawn to show the value */
export function packs(d: number, p: number): string {
  const unit = 10 ** p;
  if (d === 0) return `<div class="packs-caption">התא ריק: 0 ${placeName(p)}. הערך הוא ${m('0')}.</div>`;
  const one = (k: number) => {
    if (p === 0) return `<svg class="pk pk-1" viewBox="0 0 16 16"><rect x="1" y="1" width="14" height="14" rx="2" class="pk-cube"/></svg>`;
    if (p === 1) {
      let r = '';
      for (let i = 0; i < 10; i++) r += `<rect x="1" y="${1 + i * 10}" width="12" height="10" class="pk-cube"/>`;
      return `<svg class="pk pk-10" viewBox="0 0 14 102" aria-label="חבילה ${k} של 10">${r}</svg>`;
    }
    if (p === 2) {
      let r = '<rect x="1" y="1" width="60" height="60" class="pk-cube"/>';
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
  return `<div class="pk-row pk-row-${p}" dir="ltr">${items}</div><div class="packs-caption">${caption}</div>`;
}
