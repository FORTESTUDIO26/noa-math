import type { Level, Question, TopicId } from '../types';
import type { Rng } from '../rng';
import { placeValue, digitValue, prevNext, evenOdd, multDiv, missing, numberLineQ, sequences, multMeaning, wordProblems } from './numbers';
import { angles, polygons, triangles } from './geometry';

export const GENERATORS: Record<TopicId, (rng: Rng, level: Level) => Question> = {
  placeValue, digitValue, prevNext, evenOdd, multDiv, missing,
  numberLine: numberLineQ, sequences, multMeaning, wordProblems,
  angles, polygons, triangles,
};

export function generate(topic: TopicId, rng: Rng, level: Level): Question {
  return GENERATORS[topic](rng, level);
}
