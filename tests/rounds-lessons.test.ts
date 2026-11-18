import { describe, it, expect } from 'vitest';
import { Rng } from '../src/rng';
import { TOPICS } from '../src/topics';
import { buildExam, buildMixed, buildTopicRound, isCorrectAnswer, EXAM_PLAN } from '../src/rounds';
import { buildLessons } from '../src/lessons';
import { validateQuestion } from '../src/validate';
import { CONFIG } from '../src/config';

describe('rounds', () => {
  it('topic round: 5–7 questions of one topic, easy → harder, no repeats', () => {
    const rng = new Rng(1);
    for (const t of TOPICS) {
      const qs = buildTopicRound(rng, t.id, []);
      expect(qs.length).toBeGreaterThanOrEqual(5);
      expect(qs.length).toBeLessThanOrEqual(7);
      expect(qs.every((q) => q.topic === t.id)).toBe(true);
      const lv = qs.map((q) => q.level);
      expect(lv).toEqual([...lv].sort());
      expect(new Set(qs.map((q) => q.sig)).size).toBe(qs.length);
    }
  });

  it('a new round avoids the questions of the previous round', () => {
    const rng = new Rng(2);
    const a = buildTopicRound(rng, 'multDiv', []);
    const b = buildTopicRound(rng, 'multDiv', a.map((q) => q.sig));
    expect(b.filter((q) => a.some((x) => x.sig === q.sig)).length).toBe(0);
  });

  it('exam covers every teacher topic, some twice, all valid', () => {
    const rng = new Rng(3);
    for (let i = 0; i < 50; i++) {
      const qs = buildExam(rng, []);
      expect(new Set(qs.map((q) => q.topic)).size).toBe(TOPICS.length);
      expect(qs.length).toBe(EXAM_PLAN.length);
      expect(qs.length).toBeGreaterThan(TOPICS.length);
      qs.forEach((q) => expect(validateQuestion(q)).toEqual([]));
    }
  });

  it('mixed round mixes arithmetic and geometry and prioritises weak topics', () => {
    const rng = new Rng(4);
    const stats = { triangles: { seen: 6, firstTry: 1, wrong: 5 }, multDiv: { seen: 6, firstTry: 6, wrong: 0 } };
    let triCount = 0;
    for (let i = 0; i < 100; i++) {
      const qs = buildMixed(rng, stats, []);
      expect(qs.length).toBe(CONFIG.mixedLength);
      const geo = qs.filter((q) => ['angles', 'polygons', 'triangles'].includes(q.topic)).length;
      expect(geo).toBeGreaterThanOrEqual(2);
      expect(qs.length - geo).toBeGreaterThanOrEqual(3);
      expect(new Set(qs.map((q) => q.topic)).size).toBeGreaterThanOrEqual(5);
      triCount += qs.filter((q) => q.topic === 'triangles').length;
    }
    expect(triCount / 100).toBeGreaterThanOrEqual(1.9); // weak topic shows up ~twice per round
  });

  it('answers are checked leniently for numbers (commas, spaces, leading zeros)', () => {
    const q = buildTopicRound(new Rng(5), 'prevNext', [])[5];
    const ans = q.parts[0].answer;
    expect(isCorrectAnswer(q, 0, ans)).toBe(true);
    expect(isCorrectAnswer(q, 0, Number(ans).toLocaleString('en-US'))).toBe(true);
    expect(isCorrectAnswer(q, 0, ' ' + ans + ' ')).toBe(true);
    expect(isCorrectAnswer(q, 0, '0' + ans)).toBe(true);
    expect(isCorrectAnswer(q, 0, String(Number(ans) + 1))).toBe(false);
    expect(isCorrectAnswer(q, 0, '')).toBe(false);
  });
});

describe('"איך עושים את זה?" cards', () => {
  const L = buildLessons();
  it('every topic has its own card with explanation, worked example and "עכשיו תורך"', () => {
    for (const t of TOPICS) {
      const l = L[t.id];
      expect(l, t.id).toBeTruthy();
      expect(l.topic).toBe(t.id);
      for (const s of l.skills) {
        expect(s.explain.length).toBeGreaterThan(20);
        const sentences = s.explain.replace(/<[^>]+>/g, '').split(/[.!?](\s|$)/).filter((x) => x && x.trim().length > 3);
        expect(sentences.length, `${t.id}: 1–3 sentences`).toBeLessThanOrEqual(3);
        expect(s.example.steps.length).toBeGreaterThanOrEqual(2);
        expect(s.example.steps.length).toBeLessThanOrEqual(3);
        expect(s.tryIt.topic).toBe(t.id);
        expect(validateQuestion(s.tryIt), `${t.id} tryIt`).toEqual([]);
        // the try-it uses other data than the example
        expect(s.tryIt.prompt + (s.tryIt.math ?? '') + (s.tryIt.figure ?? '')).not.toBe(s.example.task + (s.example.figure ?? ''));
        expect(s.tryIt.figure ?? '').not.toBe(s.example.figure ?? 'none');
      }
    }
  });

  it('two-skill topics demonstrate each skill', () => {
    expect(L.multDiv.skills.map((s) => s.title)).toEqual(['כפל', 'חילוק']);
    expect(L.prevNext.skills.map((s) => s.title)).toEqual(['המספר העוקב', 'המספר הקודם']);
    expect(L.placeValue.skills.length).toBe(2);
    expect(L.missing.skills.length).toBe(2);
    // each try-it checks the same skill it demonstrates
    expect(L.multDiv.skills[0].tryIt.math).toContain('×');
    expect(L.multDiv.skills[1].tryIt.math).toContain(':');
    expect(L.prevNext.skills[0].tryIt.prompt).toContain('העוקב');
    expect(L.prevNext.skills[1].tryIt.prompt).toContain('הקודם');
    expect(L.missing.skills[0].tryIt.math).toContain('×');
    expect(L.missing.skills[1].tryIt.math).toContain(':');
  });

  it('figures for geometry, number line and multiplication meaning', () => {
    for (const t of ['angles', 'polygons', 'triangles', 'numberLine', 'multMeaning'] as const) {
      expect(L[t].skills[0].example.figure, t).toContain('<svg');
    }
  });

  it('the digit-value card matches the requested example', () => {
    const s = L.digitValue.skills[0];
    expect(s.example.task).toContain('352');
    expect(s.example.figure).toContain('pv-hi');
    expect(s.tryIt.prompt).toContain('473');
    expect(s.tryIt.parts[0].answer).toBe('70');
    expect(s.tryIt.parts[0].hint).toBe('התחילי מימין. הספרה הראשונה היא ספרת היחידות. באיזה מקום נמצאת הספרה 7?');
  });
});
