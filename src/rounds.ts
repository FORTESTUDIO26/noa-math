import { CONFIG } from './config';
import type { Choice, Level, Question, TopicId } from './types';
import { Rng } from './rng';
import { generate } from './generators';
import { validateQuestion } from './validate';
import { TOPICS } from './topics';
import { checkPart } from './answers';
import { numbersToChoices } from './choices';
import { familyRound, placeQuestion, fixedPositionClash, type PlaceType } from './generators/place';

export interface TopicStats { seen: number; firstTry: number; wrong: number }
export type Stats = Partial<Record<TopicId, TopicStats>>;

/** Generates a valid question whose signature was not used recently. */
export function freshQuestion(rng: Rng, topic: TopicId, level: Level, avoid: Set<string>): Question {
  let fallback: Question | null = null;
  for (let i = 0; i < 40; i++) {
    let q: Question;
    try { q = numbersToChoices(generate(topic, rng, level)); } catch { continue; }
    if (validateQuestion(q).length) continue;
    fallback = fallback ?? q;
    if (!avoid.has(q.sig)) { avoid.add(q.sig); return q; }
  }
  if (fallback) return fallback;
  throw new Error('could not generate ' + topic);
}

export function buildTopicRound(rng: Rng, topic: TopicId, recent: string[]): Question[] {
  const avoid = new Set(recent);
  if (topic === 'placeValue' || topic === 'digitValue') {
    // one round = two numbers, each met in several forms
    let best: Question[] = [];
    for (let i = 0; i < 80; i++) {
      const qs = familyRound(rng, topic).map(numbersToChoices);
      if (qs.some((q) => validateQuestion(q).length)) continue;
      if (fixedPositionClash(qs) && i < 79) continue; // number buttons are in a fixed order too
      best = qs;
      if (!qs.some((q) => avoid.has(q.sig))) break;
    }
    return spreadChoiceAnswers(rng, best);
  }
  const levels = CONFIG.topicRoundLevels;
  const qs = levels.map((lv) => freshQuestion(rng, topic, lv, avoid));
  return spreadChoiceAnswers(rng, avoidFixedClash(qs, (i) => freshQuestion(rng, topic, levels[i], avoid)));
}

/**
 * The correct button should not sit in the same position in two choice questions in a row.
 * Shuffleable options are reshuffled; fixed-order lists (place names, angle types …) keep their
 * order – the round builders regenerate such a question instead (see avoidFixedClash).
 */
export function spreadChoiceAnswers(rng: Rng, qs: Question[]): Question[] {
  let last = '';
  qs.forEach((q, qi) => {
    q.parts.forEach((p, pi) => {
      if (p.kind !== 'choice' || !p.choices) { last = ''; return; }
      // a fixed-order list right after this one cannot move, so steer clear of its position too
      const nq = pi === q.parts.length - 1 ? qs[qi + 1] : undefined;
      const np = nq?.parts[0];
      const nextFixed = np && np.kind === 'choice' && np.fixedOrder ? np.answer : '';
      if (!p.fixedOrder) {
        for (let k = 0; k < 12 && (p.answer === last || p.answer === nextFixed); k++) {
          const cs: Choice[] = p.choices;
          const correctText = cs.find((c) => c.id === p.answer)!.text;
          const next: Choice[] = rng.shuffle(cs).map((c, i) => ({ ...c, id: 'abcdefgh'[i] }));
          p.choices = next;
          p.answer = next.find((c) => c.text === correctText)!.id;
        }
      }
      last = p.answer;
    });
  });
  return qs;
}

/** regenerate fixed-order choice questions whose answer would repeat the previous position */
function avoidFixedClash(qs: Question[], regen: (i: number) => Question): Question[] {
  for (let i = 1; i < qs.length; i++) {
    for (let k = 0; k < 25 && fixedPositionClash([qs[i - 1], qs[i]]) && qs[i].parts[0].fixedOrder; k++) qs[i] = regen(i);
  }
  return qs;
}

/** error rate 0..1 (unseen topics count as slightly weak so they get practiced too) */
export function weakness(stats: Stats, topic: TopicId): number {
  const s = stats[topic];
  if (!s || s.seen === 0) return 0.35;
  return s.wrong / Math.max(1, s.seen);
}

/**
 * Mixed round: arithmetic + geometry. Weak topics get priority (and can appear twice),
 * but there are always questions from other topics too.
 */
export function buildMixed(rng: Rng, stats: Stats, recent: string[]): Question[] {
  const n = CONFIG.mixedLength;
  const ranked = TOPICS.map((t) => ({ t, w: weakness(stats, t.id) + rng.next() * 0.15 })).sort((a, b) => b.w - a.w);
  const chosen: TopicId[] = [];
  // 1) the weakest topics (only ones with real difficulty get a 2nd question)
  const weakOnes = ranked.filter((r) => r.w >= 0.3).slice(0, 3);
  for (const r of weakOnes) { chosen.push(r.t.id); if (weakness(stats, r.t.id) >= 0.4 && stats[r.t.id]?.seen) chosen.push(r.t.id); }
  // 2) make sure there is geometry and arithmetic
  const geo = TOPICS.filter((t) => t.area === 'geometry').map((t) => t.id);
  const nums = TOPICS.filter((t) => t.area === 'numbers').map((t) => t.id);
  while (chosen.filter((c) => geo.includes(c)).length < 2) chosen.push(rng.pick(geo.filter((g) => !chosen.includes(g)).length ? geo.filter((g) => !chosen.includes(g)) : geo));
  while (chosen.filter((c) => nums.includes(c)).length < 3) chosen.push(rng.pick(nums.filter((x) => !chosen.includes(x))));
  // 3) fill with other topics (variety)
  const rest = rng.shuffle(TOPICS.map((t) => t.id).filter((id) => !chosen.includes(id)));
  while (chosen.length < n && rest.length) chosen.push(rest.pop()!);
  const final = rng.shuffle(chosen.slice(0, n));
  const avoid = new Set(recent);
  const make = (i: number) => {
    const t = final[i];
    const level: Level = weakness(stats, t) >= 0.4 ? rng.pick([1, 2] as Level[]) : rng.pick([2, 2, 3] as Level[]);
    return freshQuestion(rng, t, level, avoid);
  };
  return spreadChoiceAnswers(rng, avoidFixedClash(final.map((_, i) => make(i)), make));
}

/** Exam plan: every teacher item at least once; central items twice. */
export const EXAM_PLAN: [TopicId, Level, PlaceType?][] = [
  ['placeValue', 1, 'fields'], ['placeValue', 3, 'composeWords'],
  ['digitValue', 1, 'placeChoice'], ['digitValue', 2, 'valueChoice'], ['digitValue', 3, 'digitAtPlace'],
  ['prevNext', 2], ['prevNext', 3],
  ['evenOdd', 2],
  ['multDiv', 2], ['multDiv', 3],
  ['missing', 2], ['missing', 3],
  ['numberLine', 2], ['numberLine', 3],
  ['sequences', 2],
  ['multMeaning', 2],
  ['wordProblems', 2], ['wordProblems', 3],
  ['angles', 1],
  ['polygons', 2],
  ['triangles', 1], ['triangles', 3],
];

export function buildExam(rng: Rng, recent: string[]): Question[] {
  const avoid = new Set(recent);
  const make = (i: number) => {
    const [t, lv, type] = EXAM_PLAN[i];
    if (!type) return freshQuestion(rng, t, lv, avoid);
    const q = numbersToChoices(placeQuestion(rng, t, lv, type));
    avoid.add(q.sig);
    return q;
  };
  return spreadChoiceAnswers(rng, avoidFixedClash(EXAM_PLAN.map((_, i) => make(i)), make));
}

export function isCorrectAnswer(q: Question, partIdx: number, given: string | undefined): boolean {
  return checkPart(q.parts[partIdx], given).ok;
}
