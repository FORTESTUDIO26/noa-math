import { CONFIG } from './config';
import type { Choice } from './types';
import type { Rng } from './rng';

export const BLANK = '☐';
export const X = CONFIG.multSymbol;
export const D = CONFIG.divSymbol;
export const MINUS = CONFIG.minusSymbol;

/** 3406 → "3,406" */
export function fmt(n: number): string {
  const s = String(Math.abs(n));
  const sep = CONFIG.thousandsSeparator;
  const out = sep && s.length >= 4 ? s.replace(/\B(?=(\d{3})+(?!\d))/g, sep) : s;
  return (n < 0 ? '-' : '') + out;
}

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Inline math inside Hebrew text – isolated and left-to-right so "6 × 7 = 42" never flips. */
export function m(expr: string): string {
  return `<span class="m" dir="ltr">${renderBlank(esc(expr))}</span>`;
}

export function renderBlank(escaped: string): string {
  return escaped.replace(/☐/g, '<span class="blank" aria-label="מספר חסר">?</span>');
}

/** Builds shuffled choices with ids a,b,c,d. Throws on duplicates (caught by validation/tests). */
export function makeChoices(
  rng: Rng | null,
  correct: { html: string; text: string; isFigure?: boolean },
  distractors: { html: string; text: string; isFigure?: boolean }[],
  opts: { shuffle?: boolean } = {},
): { choices: Choice[]; answer: string } {
  const all = [{ ...correct, ok: true }, ...distractors.map((d) => ({ ...d, ok: false }))];
  const seen = new Set<string>();
  for (const c of all) {
    if (seen.has(c.text)) throw new Error('duplicate choice: ' + c.text);
    seen.add(c.text);
  }
  const ordered = opts.shuffle === false || !rng ? all : rng.shuffle(all);
  const ids = 'abcdefgh';
  let answer = '';
  const choices = ordered.map((c, i) => {
    if (c.ok) answer = ids[i];
    return { id: ids[i], html: c.html, text: c.text, isFigure: c.isFigure };
  });
  return { choices, answer };
}

export const mathChoice = (expr: string) => ({ html: m(expr), text: expr });
export const textChoice = (t: string) => ({ html: esc(t), text: t });

export function placeName(p: number): string {
  return ['יחידות', 'עשרות', 'מאות', 'אלפים', 'רבבות'][p];
}
/** "3 אלפים", "1 מאה", "1 עשרת", "1 יחידה" */
export function countWord(d: number, p: number): string {
  const singular = ['יחידה', 'עשרת', 'מאה', 'אלף'][p];
  return d === 1 ? `1 ${singular}` : `${d} ${placeName(p)}`;
}
export function digitsOf(n: number): number[] {
  // index 0 = units
  return String(n).split('').reverse().map(Number);
}

/** Choices in a fixed, logical order (ids follow the on-screen position). */
export function orderedChoices(items: { html: string; text: string; isFigure?: boolean }[], correctIndex: number): { choices: Choice[]; answer: string; fixedOrder: true } {
  const seen = new Set(items.map((i) => i.text));
  if (seen.size !== items.length) throw new Error('duplicate choice');
  const ids = 'abcdefgh';
  return { choices: items.map((c, i) => ({ id: ids[i], ...c })), answer: ids[correctIndex], fixedOrder: true };
}

/** "אלפים, מאות, עשרות, יחידות" – only the places the number really has */
export function placeOrder(places: number): number[] {
  return [3, 2, 1, 0].filter((p) => p < places);
}
