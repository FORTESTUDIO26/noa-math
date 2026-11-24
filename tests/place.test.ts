import { describe, it, expect } from 'vitest';
import { Rng } from '../src/rng';
import { checkPart } from '../src/answers';
import { qFields, qPlaceChoice, qValueChoice, qDigitAtPlace, familyRound, LESSON_NUMBERS } from '../src/generators/place';
import { GENERATORS } from '../src/generators';
import { TOPICS } from '../src/topics';
import { buildLessons } from '../src/lessons';
import { buildTopicRound, buildExam } from '../src/rounds';
import { validateQuestion } from '../src/validate';
import { digitsOf } from '../src/format';

/** the number a question is about – it is part of the question signature */
const subject = (sig: string) => Number(sig.match(/-(\d{4})(?:-|$)/)?.[1] ?? -1);

describe('word answers are choices', () => {
  const textOf = (q: ReturnType<typeof qPlaceChoice>) => q.parts[0].choices!.map((c) => c.text);
  const rightText = (q: ReturnType<typeof qPlaceChoice>) => q.parts[0].choices!.find((c) => c.id === q.parts[0].answer)!.text;

  it('"באיזה מקום נמצאת הספרה 3 במספר 7639?" → choose עשרות among the 4 places', () => {
    const q = qPlaceChoice('digitValue', 1, 7639, 1);
    expect(q.parts[0].kind).toBe('choice');
    expect(textOf(q)).toEqual(['אלפים', 'מאות', 'עשרות', 'יחידות']);
    expect(rightText(q)).toBe('עשרות');
    expect(validateQuestion(q)).toEqual([]);
  });

  it('"מה הערך של הספרה 3 במספר 7639?" → choose among 3, 30, 300, 3,000', () => {
    const q = qValueChoice('digitValue', 1, 7639, 1);
    expect(textOf(q)).toEqual(['3', '30', '300', '3,000']);
    expect(rightText(q)).toBe('30');
    const three = q.parts[0].choices!.find((c) => c.text === '3')!.id;
    expect(checkPart(q.parts[0], three).trap).toContain('הספרה עצמה');
    expect(validateQuestion(q)).toEqual([]);
  });

  it('only options that make sense: a 3-digit number has 3 places and 3 values', () => {
    expect(textOf(qPlaceChoice('digitValue', 1, 473, 1))).toEqual(['מאות', 'עשרות', 'יחידות']);
    expect(textOf(qValueChoice('digitValue', 1, 473, 1))).toEqual(['7', '70', '700']);
  });

  it('no generated question asks to type a word', () => {
    for (const t of TOPICS) for (const lv of [1, 2, 3] as const) {
      const rng = new Rng(t.id.length * 31 + lv);
      for (let i = 0; i < 150; i++) {
        const q = GENERATORS[t.id](rng, lv);
        expect(q.parts.some((p) => p.kind === 'text'), q.sig).toBe(false);
      }
    }
    for (const l of Object.values(buildLessons())) for (const sk of l.skills) expect(sk.tryIt.parts.some((p) => p.kind === 'text')).toBe(false);
  });

  it('term answers (places, even/odd, angles, polygons, triangles) are buttons in a fixed logical order', () => {
    const rng = new Rng(77);
    const lists = new Set<string>();
    for (const t of ['evenOdd', 'angles', 'polygons', 'triangles', 'digitValue'] as const) for (let i = 0; i < 200; i++) {
      for (const p of GENERATORS[t](rng, ((i % 3) + 1) as 1 | 2 | 3).parts) {
        if (p.kind === 'choice' && p.fixedOrder) lists.add(p.choices!.map((c) => c.text).join('/'));
      }
    }
    expect([...lists]).toEqual(expect.arrayContaining(['זוגי/אי־זוגי', 'חדה/ישרה/קהה', 'משולש/מרובע/מחומש/משושה/מתומן', 'אלפים/מאות/עשרות/יחידות', 'שווה־צלעות/שווה־שוקיים/שונה־צלעות', 'שווה־צלעות/שונה־צלעות']));
  });

  it('in every round the correct button never sits in the same place in two choice questions in a row', () => {
    const rng = new Rng(5);
    for (const t of TOPICS) for (let r = 0; r < 25; r++) {
      const qs = buildTopicRound(rng, t.id, []);
      for (let i = 1; i < qs.length; i++) {
        const a = qs[i - 1].parts[qs[i - 1].parts.length - 1], b = qs[i].parts[0];
        if (a.kind === 'choice' && b.kind === 'choice') expect(b.answer, `${t.id}: ${qs[i - 1].sig} → ${qs[i].sig}`).not.toBe(a.answer);
      }
    }
    for (let r = 0; r < 20; r++) {
      const qs = buildExam(rng, []);
      for (let i = 1; i < qs.length; i++) {
        const a = qs[i - 1].parts[qs[i - 1].parts.length - 1], b = qs[i].parts[0];
        if (a.kind === 'choice' && b.kind === 'choice') expect(b.answer).not.toBe(a.answer);
      }
    }
  });
});

describe('decomposition with four boxes', () => {
  it('יש לפרק את המספר 7639 → 7 | 6 | 3 | 9, rows אלפים → יחידות', () => {
    const q = qFields('placeValue', 1, 7639);
    const p = q.parts[0];
    expect(q.prompt).toContain('יש לפרק את המספר');
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
        // nothing to type: only answer buttons (and the 4-box decomposition with its digit pad)
        const kinds = new Set(qs.flatMap((q) => q.parts.map((p) => p.kind)));
        expect(kinds.has('choice')).toBe(true);
        expect([...kinds].every((k) => k === 'choice' || k === 'fields')).toBe(true);
      }
      expect(seenNumbers.size).toBeGreaterThan(200); // numbers change between rounds
    });
  }

  it('digitValue round: place (choice), value of the same digit later (choice), a number answer and a 4-option digit choice', () => {
    const qs = buildTopicRound(new Rng(9), 'digitValue', []);
    expect(qs[0].parts[0].kind).toBe('choice');
    expect(qs[0].sig).toContain('dv-place');
    expect(qs[4].sig).toContain('dv-value');
    expect(qs[3].parts[0].kind).toBe('choice'); // was a typed number – now 4 number buttons
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
