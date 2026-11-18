import { describe, it, expect } from 'vitest';
import { Rng } from '../src/rng';
import { checkPart, normalize } from '../src/answers';
import { qFields, qPlaceText, qValueText, qDigitAtPlace, familyRound, LESSON_NUMBERS } from '../src/generators/place';
import { buildTopicRound } from '../src/rounds';
import { validateQuestion } from '../src/validate';
import { digitsOf } from '../src/format';

/** the number a question is about – it is part of the question signature */
const subject = (sig: string) => Number(sig.match(/-(\d{4})(?:-|$)/)?.[1] ?? -1);

describe('Hebrew answers', () => {
  it('"באיזה מקום נמצאת הספרה 3 במספר 7639?" → עשרות (spaces, niqqud, prefix ok)', () => {
    const q = qPlaceText('digitValue', 1, 7639, 1);
    const p = q.parts[0];
    expect(p.kind).toBe('text');
    expect(q.prompt).toContain('7,639');
    for (const a of ['עשרות', '  עשרות ', 'עֲשָׂרוֹת', 'העשרות', 'מקום העשרות', 'במקום  העשרות']) expect(checkPart(p, a).ok, a).toBe(true);
    for (const a of ['מאות', 'יחידות', '30', '3', '']) expect(checkPart(p, a).ok, a).toBe(false);
    expect(checkPart(p, '30').trap).toContain('שם המקום');
    expect(p.fieldHint).toContain('כתבי את שם המקום');
    expect(validateQuestion(q)).toEqual([]);
  });

  it('"מה הערך של הספרה 3 במספר 7639?" → 30, "שלושים", "3 עשרות"', () => {
    const q = qValueText('digitValue', 1, 7639, 1);
    const p = q.parts[0];
    for (const a of ['30', ' 30 ', 'שלושים', 'שְׁלוֹשִׁים', '3 עשרות', 'שלוש עשרות', '3   עשרות', 'שלשים']) expect(checkPart(p, a).ok, a).toBe(true);
    for (const a of ['3', '300', 'עשרות', 'שלוש', '3 מאות']) expect(checkPart(p, a).ok, a).toBe(false);
    expect(checkPart(p, 'עשרות').trap).toBe('מצאת את המקום. כמה הן 3 עשרות?');
    expect(checkPart(p, 'העשרות').trap).toBe('מצאת את המקום. כמה הן 3 עשרות?');
    expect(validateQuestion(q)).toEqual([]);
  });

  it('values in every place accept digits and words', () => {
    const cases: [number, number, string[]][] = [[7639, 3, ['7000', '7,000', 'שבעת אלפים', '7 אלפים']], [7639, 2, ['600', 'שש מאות', '6 מאות']], [7639, 0, ['9', 'תשע', '9 יחידות']], [2514, 2, ['500', 'חמש מאות']], [1234, 3, ['1000', 'אלף', '1 אלף']]];
    for (const [n, pl, ok] of cases) {
      const p = qValueText('digitValue', 1, n, pl).parts[0];
      for (const a of ok) expect(checkPart(p, a).ok, `${n} ${pl} ${a}`).toBe(true);
    }
    expect(normalize('  עֶשֶׂר־ים ')).toBe('עשר ים');
  });
});

describe('decomposition with four boxes', () => {
  it('פרקי את המספר 7639 → 7 | 6 | 3 | 9, rows אלפים → יחידות', () => {
    const q = qFields('placeValue', 1, 7639);
    const p = q.parts[0];
    expect(q.prompt).toContain('פרקי את המספר');
    expect(p.fields!.map((f) => f.label)).toEqual(['אלפים', 'מאות', 'עשרות', 'יחידות']);
    expect(p.fields!.map((f) => f.answer)).toEqual(['7', '6', '3', '9']);
    expect(checkPart(p, '7|6|3|9').ok).toBe(true);
    const r = checkPart(p, '7|6|9|3');
    expect(r.ok).toBe(false);
    expect(r.bad).toEqual([false, false, true, true]); // exactly the rows to fix
    expect(p.after).toContain('7,000 + 600 + 30 + 9');
    expect(validateQuestion(q)).toEqual([]);
  });

  it('7052: the hundreds box needs an explicit 0, with a hint when left empty', () => {
    const p = qFields('placeValue', 2, 7052).parts[0];
    expect(p.fields!.map((f) => f.answer)).toEqual(['7', '0', '5', '2']);
    const r = checkPart(p, '7||5|2');
    expect(r.ok).toBe(false);
    expect(r.emptyZero).toBe(true);
    expect(r.bad).toEqual([false, true, false, false]);
    expect(p.zeroHint).toContain('0');
    expect(p.zeroHint).toContain('מאות');
    expect(checkPart(p, '7|0|5|2').ok).toBe(true);
    expect(p.after).toContain('7,000 + 50 + 2');
  });
});

describe('several forms of the same number', () => {
  it('choose the digit in a place: 4 different options, exactly one right', () => {
    const rng = new Rng(1);
    const q = qDigitAtPlace(rng, 'digitValue', 2, 7639, 2);
    const p = q.parts[0];
    expect(p.choices!.length).toBe(4);
    expect(new Set(p.choices!.map((c) => c.text)).size).toBe(4);
    expect(p.choices!.find((c) => c.id === p.answer)!.text).toBe('6');
  });

  it('correct choice lands in every position across rounds', () => {
    const rng = new Rng(2);
    const pos = new Set<string>();
    for (let i = 0; i < 80; i++) {
      const n = 1234 + i * 97;
      const ds = digitsOf(n);
      if (new Set(ds).size < 4 || ds.length < 4) continue;
      pos.add(qDigitAtPlace(rng, 'digitValue', 2, n, i % 4).parts[0].answer);
    }
    expect([...pos].sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  for (const topic of ['placeValue', 'digitValue'] as const) {
    it(`${topic}: round reuses numbers in different forms, never two questions in a row on the same number`, () => {
      const rng = new Rng(topic.length);
      const seenNumbers = new Set<number>();
      for (let r = 0; r < 150; r++) {
        const qs = buildTopicRound(rng, topic, []);
        expect(qs.length).toBe(6);
        qs.forEach((q) => expect(validateQuestion(q), q.sig).toEqual([]));
        const nums = qs.map((q) => subject(q.sig));
        nums.forEach((n) => { if (n > 0) { expect(LESSON_NUMBERS.has(n), `${n} is a lesson number`).toBe(false); seenNumbers.add(n); } });
        // the same number shows up in at least two questions
        const counts = new Map<number, number>();
        nums.forEach((n) => n > 0 && counts.set(n, (counts.get(n) ?? 0) + 1));
        expect(Math.max(...counts.values())).toBeGreaterThanOrEqual(2);
        // no question is right after another question about the same number
        for (let i = 1; i < nums.length; i++) if (nums[i] > 0) expect(nums[i], qs.map((q) => q.sig).join(' ')).not.toBe(nums[i - 1]);
        // both typing and choice questions
        const kinds = new Set(qs.flatMap((q) => q.parts.map((p) => p.kind)));
        expect(kinds.has('choice')).toBe(true);
        expect([...kinds].some((k) => k !== 'choice')).toBe(true);
      }
      expect(seenNumbers.size).toBeGreaterThan(200); // numbers change between rounds
    });
  }

  it('digitValue round has typed place name, typed value (same digit, later) and a 4-option choice', () => {
    const qs = buildTopicRound(new Rng(9), 'digitValue', []);
    expect(qs[0].parts[0].kind).toBe('text');
    expect(qs[0].sig).toContain('placeText');
    expect(qs[4].sig).toContain('valueText');
    expect(qs[0].sig.split('-').slice(2).join('-')).toBe(qs[4].sig.split('-').slice(2).join('-'));
    expect(qs[2].parts[0].choices!.length).toBe(4);
  });

  it('placeValue round has the 4-box decomposition and composing from words', () => {
    const qs = buildTopicRound(new Rng(10), 'placeValue', []);
    expect(qs.some((q) => q.parts[0].kind === 'fields')).toBe(true);
    expect(qs.some((q) => q.sig.startsWith('pv-words'))).toBe(true);
    expect(qs.filter((q) => q.parts[0].kind === 'fields').some((q) => q.parts[0].fields!.some((f) => f.answer === '0'))).toBe(true);
  });
});

describe('the round never reveals the next answer', () => {
  it('familyRound alternates two numbers', () => {
    const rng = new Rng(3);
    for (let i = 0; i < 50; i++) {
      const qs = familyRound(rng, 'placeValue');
      const nums = qs.map((q) => subject(q.sig));
      expect(nums[0]).toBe(nums[2]);
      expect(nums[1]).toBe(nums[3]);
      expect(nums[0]).not.toBe(nums[1]);
    }
  });
});
