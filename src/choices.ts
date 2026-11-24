/**
 * No typing: every single-number answer is shown as answer buttons.
 * The generators still describe the exact number; this module turns it into 4 options
 * (the right one + 3 plausible mistakes) in ascending order.
 */
import type { Part, Question } from './types';
import { Rng } from './rng';
import { fmt, m } from './format';

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/**
 * plausible wrong numbers for an answer a (typical mistakes first).
 * The right answer lands at a random place in the (ascending) row of buttons:
 * we first decide how many options are smaller than it.
 */
export function distractorsFor(a: number, near: number[], rng: Rng): number[] {
  const ok = (x: number) => Number.isInteger(x) && x >= 0 && x !== a && x <= 100000;
  const steps = a >= 1000 ? [100, 1000, 10, 1] : a >= 100 ? [10, 100, 1, 2] : a >= 20 ? [1, 10, 2, 5] : [1, 2, 3, 4];
  const generic: number[] = [];
  if (a >= 10 && a % 10 === 0) generic.push(a / 10, a * 10);
  for (const st of steps) generic.push(a - st, a + st);
  for (const st of steps) generic.push(a - 2 * st, a + 2 * st);
  const pool: number[] = [];
  for (const x of [...near, ...generic]) if (ok(x) && !pool.includes(x)) pool.push(x);
  const below = pool.filter((x) => x < a), above = pool.filter((x) => x > a);
  // how many buttons should be smaller than the answer (0..3), within what is possible
  const minBelow = Math.max(0, 3 - above.length), maxBelow = Math.min(3, below.length);
  const nBelow = minBelow + Math.floor(rng.next() * (maxBelow - minBelow + 1));
  const out = [...below.slice(0, nBelow), ...above.slice(0, 3 - nBelow)];
  for (let k = 3; out.length < 3; k++) if (ok(a + k) && !out.includes(a + k)) out.push(a + k);
  return out;
}

function partToChoice(p: Part, rng: Rng): Part {
  if (p.kind !== 'number') return p;
  const a = Number(p.answer);
  const wrong = distractorsFor(a, p.near ?? [], rng);
  const all = [a, ...wrong].sort((x, y) => x - y);
  const ids = 'abcd';
  const suffix = p.suffix ? ` <span class="choice-suffix">${p.suffix}</span>` : '';
  const choices = all.map((n, i) => ({ id: ids[i], html: m(fmt(n)) + suffix, text: fmt(n) }));
  return {
    ...p,
    kind: 'choice',
    choices,
    answer: ids[all.indexOf(a)],
    fixedOrder: true,
    // a typed number used to come with "write the number" style instructions
    fieldHint: undefined,
  };
}

/** Turn every number part into a choice (deterministic per question, so it survives a reload). */
export function numbersToChoices(q: Question): Question {
  if (!q.parts.some((p) => p.kind === 'number')) return q;
  const rng = new Rng(hashSeed(q.sig));
  return { ...q, parts: q.parts.map((p) => partToChoice(p, rng)) };
}
