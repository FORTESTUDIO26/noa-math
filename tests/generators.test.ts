import { describe, it, expect } from 'vitest';
import { Rng } from '../src/rng';
import { GENERATORS } from '../src/generators';
import { validateQuestion } from '../src/validate';
import { TOPICS } from '../src/topics';
import type { Level, Question } from '../src/types';
import { classifyTriangle, triangleOptions, TRI_NAMES, classifyAngle, ANGLE_NAMES } from '../src/generators/geometry';
import { triangleVertices } from '../src/figures';
import { CONFIG } from '../src/config';

const N = 400;
const strip = (s: string) => s.replace(/<[^>]+>/g, ' ');

function* all(): Generator<[string, Level, Question]> {
  for (const t of TOPICS) for (const lv of [1, 2, 3] as Level[]) {
    const rng = new Rng(1000 + lv * 77 + t.id.length);
    for (let i = 0; i < N; i++) yield [t.id, lv, GENERATORS[t.id](rng, lv)];
  }
}

describe('every generated question is valid', () => {
  it('passes validation (answer present, unique choices, no division by zero)', () => {
    const bad: string[] = [];
    for (const [t, lv, q] of all()) {
      const e = validateQuestion(q);
      if (e.length) bad.push(`${t} L${lv}: ${e.join('; ')} (${q.sig})`);
      expect(q.topic).toBe(t);
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it('numbers stay inside the verified range (up to 10,000)', () => {
    for (const [t, , q] of all()) {
      for (const p of q.parts) if (p.kind === 'number') expect(Number(p.answer), `${t} ${q.sig}`).toBeLessThanOrEqual(CONFIG.maxNumber);
      const nums = strip((q.math ?? '') + ' ' + q.prompt + ' ' + (q.figure ?? '').replace(/<svg[\s\S]*?<\/svg>/g, '')).match(/\d[\d,]*/g) ?? [];
      for (const n of nums) expect(Number(n.replace(/,/g, '')), `${t} ${q.sig}`).toBeLessThanOrEqual(CONFIG.maxNumber);
    }
  });

  it('each generator varies between rounds', () => {
    for (const t of TOPICS) for (const lv of [1, 2, 3] as Level[]) {
      const rng = new Rng(42);
      const sigs = new Set(Array.from({ length: 30 }, () => GENERATORS[t.id](rng, lv).sig));
      expect(sigs.size, `${t.id} L${lv}`).toBeGreaterThan(5);
    }
  });
});

describe('arithmetic answers are actually correct', () => {
  it('math expressions with one blank evaluate to the answer', () => {
    let checked = 0;
    for (const [, , q] of all()) {
      if (!q.math || q.parts.length !== 1 || q.parts[0].kind !== 'number') continue;
      const expr = q.math.replace(/,/g, '').replace(/×/g, '*').replace(/:/g, '/').replace(/−/g, '-');
      const [lhs, rhs] = expr.split('=').map((s) => s.trim());
      const sub = (s: string) => s.replace('☐', q.parts[0].answer);
      const ev = (s: string) => Function(`return (${sub(s)})`)();
      expect(ev(lhs), q.sig).toBe(ev(rhs));
      checked++;
    }
    expect(checked).toBeGreaterThan(1000);
  });

  it('number-line answer equals start + index × step (from the drawn labels)', () => {
    const rng = new Rng(7);
    for (let i = 0; i < 600; i++) {
      const q = GENERATORS.numberLine(rng, ((i % 3) + 1) as Level);
      const labels = [...q.figure!.matchAll(/<line x1="([\d.]+)"[^>]*class="nl-tick[^"]*"\/>(?:<text x="[\d.]+" y="[\d.]+" class="nl-label"[^>]*>([\d,]+)<\/text>)?/g)];
      const xs = labels.map((l) => Number(l[1]));
      const gaps = xs.slice(1).map((x, k) => +(x - xs[k]).toFixed(1));
      expect(new Set(gaps).size, 'equal spacing').toBe(1);
      const known = labels.map((l, k) => ({ k, v: l[2] ? Number(l[2].replace(/,/g, '')) : null })).filter((x) => x.v !== null) as { k: number; v: number }[];
      const step = (known[1].v - known[0].v) / (known[1].k - known[0].k);
      const qIdx = q.figure!.indexOf('nl-tick-q');
      const qk = labels.findIndex((l) => l[0].includes('nl-tick-q'));
      expect(qIdx).toBeGreaterThan(0);
      expect(Number(q.parts[0].answer)).toBe(known[0].v + (qk - known[0].k) * step);
    }
  });

  it('sequence answers follow a constant step', () => {
    const rng = new Rng(9);
    for (let i = 0; i < 600; i++) {
      const q = GENERATORS.sequences(rng, ((i % 3) + 1) as Level);
      const vals = [...q.figure!.matchAll(/seq-box[^>]*>([^<]+)</g)].map((m) => (m[1] === '?' ? Number(q.parts[0].answer) : Number(m[1].replace(/,/g, ''))));
      expect(vals.length).toBe(5);
      const d = vals[1] - vals[0];
      expect(d).not.toBe(0);
      vals.forEach((v, k) => { expect(v).toBe(vals[0] + k * d); expect(v).toBeGreaterThanOrEqual(0); });
    }
  });
});

describe('geometry is unambiguous', () => {
  it('triangle questions: correct class matches side lengths, never two valid answers', () => {
    const rng = new Rng(3);
    for (let i = 0; i < 600; i++) {
      const lv = ((i % 2) + 1) as Level;
      const q = GENERATORS.triangles(rng, lv);
      const src = lv === 1 ? q.parts[0] && q.figure! : q.prompt;
      const lens = lv === 1 ? [...src.matchAll(/class="len[^"]*">(\d+)</g)].map((m) => +m[1]) : [...strip(src).matchAll(/(\d+) ס״מ/g)].map((m) => +m[1]);
      expect(lens.length).toBe(3);
      const t = classifyTriangle(lens);
      const p = q.parts[0];
      const correct = p.choices!.find((c) => c.id === p.answer)!.text;
      expect(correct).toBe(TRI_NAMES[t]);
      expect(p.choices!.map((c) => c.text).sort()).toEqual(triangleOptions(t).map((o) => TRI_NAMES[o]).sort());
      if (t === 'equilateral') expect(p.choices!.some((c) => c.text === TRI_NAMES.isosceles)).toBe(false);
      expect(triangleVertices(lens[0], lens[1], lens[2])).not.toBeNull();
    }
  });

  it('triangle picture-choice: exactly one option fits', () => {
    const rng = new Rng(5);
    for (let i = 0; i < 300; i++) {
      const q = GENERATORS.triangles(rng, 3);
      const p = q.parts[0];
      const target = Object.entries(TRI_NAMES).find(([, n]) => q.prompt.includes(n))![0];
      const fits = p.choices!.filter((c) => {
        const lens = [...c.html.matchAll(/class="len[^"]*">(\d+)</g)].map((m) => +m[1]);
        const t = classifyTriangle(lens);
        return t === target || (target === 'isosceles' && t === 'equilateral');
      });
      expect(fits.length).toBe(1);
      expect(fits[0].id).toBe(p.answer);
    }
  });

  it('angle questions: drawn angle type matches the answer', () => {
    const rng = new Rng(11);
    for (let i = 0; i < 300; i++) {
      const q = GENERATORS.angles(rng, 1);
      const correct = q.parts[0].choices!.find((c) => c.id === q.parts[0].answer)!.text;
      const t = Object.entries(ANGLE_NAMES).find(([, n]) => n === correct)![0];
      // right angles are drawn with a square marker (polyline), others with arcs
      const square = /<polyline[^>]*class="ang-mark"/.test(q.figure!);
      expect(square).toBe(t === 'right');
    }
    expect(classifyAngle(45)).toBe('acute');
    expect(classifyAngle(120)).toBe('obtuse');
  });

  it('polygon count questions match the number of drawn vertices', () => {
    const rng = new Rng(13);
    for (let i = 0; i < 300; i++) {
      const q = GENERATORS.polygons(rng, 1);
      const pts = q.figure!.match(/<polygon points="([^"]+)"/)![1].trim().split(' ');
      expect(String(pts.length)).toBe(q.parts[0].answer);
    }
  });
});
