import { CONFIG } from './config';
import type { Level, Question, TopicId } from './types';
import { Rng } from './rng';
import { generate } from './generators';
import { validateQuestion } from './validate';
import { TOPICS } from './topics';

export interface TopicStats { seen: number; firstTry: number; wrong: number }
export type Stats = Partial<Record<TopicId, TopicStats>>;

/** Generates a valid question whose signature was not used recently. */
export function freshQuestion(rng: Rng, topic: TopicId, level: Level, avoid: Set<string>): Question {
  let fallback: Question | null = null;
  for (let i = 0; i < 40; i++) {
    let q: Question;
    try { q = generate(topic, rng, level); } catch { continue; }
    if (validateQuestion(q).length) continue;
    fallback = fallback ?? q;
    if (!avoid.has(q.sig)) { avoid.add(q.sig); return q; }
  }
  if (fallback) return fallback;
  throw new Error('could not generate ' + topic);
}

export function buildTopicRound(rng: Rng, topic: TopicId, recent: string[]): Question[] {
  const avoid = new Set(recent);
  return CONFIG.topicRoundLevels.map((lv) => freshQuestion(rng, topic, lv, avoid));
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
  return final.map((t) => {
    const w = weakness(stats, t);
    const level: Level = w >= 0.4 ? rng.pick([1, 2] as Level[]) : rng.pick([2, 2, 3] as Level[]);
    return freshQuestion(rng, t, level, avoid);
  });
}

/** Exam plan: every teacher item at least once; central items twice. */
export const EXAM_PLAN: [TopicId, Level][] = [
  ['placeValue', 1], ['placeValue', 3],
  ['digitValue', 1], ['digitValue', 3],
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
  return EXAM_PLAN.map(([t, lv]) => freshQuestion(rng, t, lv, avoid));
}

export function isCorrectAnswer(q: Question, partIdx: number, given: string | undefined): boolean {
  const p = q.parts[partIdx];
  if (given === undefined || given === '') return false;
  if (p.kind === 'choice') return given === p.answer;
  const clean = given.replace(/[\s,.'’]/g, '').replace(/^0+(?=\d)/, '');
  return /^\d+$/.test(clean) && Number(clean) === Number(p.answer);
}
