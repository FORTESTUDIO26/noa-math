/**
 * Answer checking: numbers, Hebrew words (with niqqud / extra spaces), multi-box decomposition.
 */
import type { Part } from './types';
import { placeName } from './format';

/** remove niqqud & cantillation, punctuation, extra spaces; maqaf → space */
export function normalize(s: string): string {
  return s
    .replace(/[־‐-―-]/g, ' ') // maqaf / dashes
    .replace(/[֑-ׇ]/g, '') // niqqud
    .replace(/[״׳"'`.,!?:;()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeNumber(s: string): string | null {
  const clean = s.replace(/[\s,.'’]/g, '').replace(/^0+(?=\d)/, '');
  return /^\d+$/.test(clean) ? String(Number(clean)) : null;
}

/* ---------------------------------------------------------------- Hebrew number words */

const FEM = ['', 'אחת', 'שתיים', 'שלוש', 'ארבע', 'חמש', 'שש', 'שבע', 'שמונה', 'תשע'];
const MASC = ['', 'אחד', 'שניים', 'שלושה', 'ארבעה', 'חמישה', 'שישה', 'שבעה', 'שמונה', 'תשעה'];
const ALT: Record<string, string[]> = { 'שתיים': ['שתים'], 'שניים': ['שנים'], 'שלוש': ['שלש'], 'שלושה': ['שלשה'], 'חמישה': ['חמשה'], 'שישה': ['ששה'] };
const TENS = ['', 'עשר', 'עשרים', 'שלושים', 'ארבעים', 'חמישים', 'שישים', 'שבעים', 'שמונים', 'תשעים'];
const TENS_ALT: Record<number, string[]> = { 1: ['עשרה'], 3: ['שלשים'], 5: ['חמשים'], 6: ['ששים'] };
const HUNDREDS = ['', 'מאה', 'מאתיים', 'שלוש מאות', 'ארבע מאות', 'חמש מאות', 'שש מאות', 'שבע מאות', 'שמונה מאות', 'תשע מאות'];
const THOUSANDS = ['', 'אלף', 'אלפיים', 'שלושת אלפים', 'ארבעת אלפים', 'חמשת אלפים', 'ששת אלפים', 'שבעת אלפים', 'שמונת אלפים', 'תשעת אלפים'];
const SINGULAR = ['יחידה', 'עשרת', 'מאה', 'אלף'];

const words = (d: number, list: string[]) => [list[d], ...(ALT[list[d]] ?? [])];

/** every accepted way to write the value of digit d in place p: 30, "שלושים", "3 עשרות", "שלוש עשרות" … */
export function valueAccepts(d: number, p: number): string[] {
  const v = d * 10 ** p;
  const out = new Set<string>([String(v)]);
  if (d === 0) { out.add('אפס'); return [...out]; }
  if (p === 0) { words(d, FEM).concat(words(d, MASC)).forEach((w) => out.add(w)); }
  if (p === 1) { out.add(TENS[d]); (TENS_ALT[d] ?? []).forEach((w) => out.add(w)); }
  if (p === 2) { out.add(HUNDREDS[d]); if (d === 2) out.add('מאתים'); }
  if (p === 3) {
    out.add(THOUSANDS[d]);
    if (d > 2) words(d, FEM).concat(words(d, MASC)).forEach((w) => out.add(`${w} אלפים`));
  }
  // "3 עשרות", "שלוש עשרות", "1 מאה", "מאה אחת"
  const plural = placeName(p);
  if (d === 1) {
    out.add(`1 ${SINGULAR[p]}`);
    out.add(`${SINGULAR[p]} אחת`);
    out.add(`${SINGULAR[p]} אחד`);
    out.add(`1 ${plural}`);
  } else {
    out.add(`${d} ${plural}`);
    words(d, FEM).concat(words(d, MASC)).forEach((w) => out.add(`${w} ${plural}`));
  }
  return [...out].map(normalize);
}

/** "עשרות", "העשרות", "מקום העשרות", "במקום העשרות", "עשרת" */
export function placeAccepts(p: number): string[] {
  const x = placeName(p);
  return [x, `ה${x}`, `מקום ה${x}`, `במקום ה${x}`, `ב${x}`, SINGULAR[p], `ה${SINGULAR[p]}`].map(normalize);
}

/* ---------------------------------------------------------------- checking */

export interface CheckResult {
  ok: boolean;
  /** fields: which boxes are wrong */
  bad?: boolean[];
  /** a box whose answer is 0 was left empty */
  emptyZero?: boolean;
  /** nothing at all was typed */
  empty?: boolean;
  /** focused hint for this specific wrong answer */
  trap?: string;
}

export const splitFields = (given: string | undefined, n: number): string[] => {
  const a = (given ?? '').split('|');
  return Array.from({ length: n }, (_, i) => a[i] ?? '');
};

export function checkPart(part: Part, given: string | undefined): CheckResult {
  const g = given ?? '';
  if (part.kind === 'choice') {
    const ok = g !== '' && g === part.answer;
    const chosen = part.choices?.find((c) => c.id === g)?.text;
    return { ok, empty: g === '', trap: ok || !chosen ? undefined : findTrap(part, chosen) };
  }
  if (part.kind === 'number') {
    if (g.trim() === '') return { ok: false, empty: true };
    const n = normalizeNumber(g);
    const ok = n !== null && n === normalizeNumber(part.answer);
    return { ok, trap: ok ? undefined : findTrap(part, g) };
  }
  if (part.kind === 'text') {
    const t = normalize(g);
    if (t === '') return { ok: false, empty: true };
    const asNum = normalizeNumber(g);
    const accepts = (part.accept ?? [part.answer]).map(normalize);
    const ok = accepts.includes(t) || (asNum !== null && accepts.includes(asNum));
    return { ok, trap: ok ? undefined : findTrap(part, g) };
  }
  // fields
  const fs = part.fields ?? [];
  const vals = splitFields(g, fs.length);
  if (vals.every((v) => v.trim() === '')) return { ok: false, empty: true, bad: fs.map(() => true) };
  let emptyZero = false;
  const bad = fs.map((f, i) => {
    const v = vals[i].trim();
    if (v === '') { if (f.answer === '0') emptyZero = true; return true; }
    return normalizeNumber(v) !== normalizeNumber(f.answer);
  });
  return { ok: bad.every((b) => !b), bad, emptyZero };
}

function findTrap(part: Part, given: string): string | undefined {
  const t = normalize(given);
  const n = normalizeNumber(given);
  for (const tr of part.traps ?? []) {
    const ms = tr.match.map(normalize);
    if (ms.includes(t) || (n !== null && ms.includes(n))) return tr.hint;
  }
  return undefined;
}

export function isFilled(part: Part, given: string | undefined): boolean {
  if (part.kind === 'fields') return splitFields(given, part.fields!.length).every((v) => v.trim() !== '');
  return (given ?? '').trim() !== '';
}
