export type TopicId =
  | 'placeValue' | 'digitValue' | 'prevNext' | 'evenOdd' | 'multDiv' | 'missing'
  | 'numberLine' | 'sequences' | 'multMeaning' | 'wordProblems'
  | 'angles' | 'polygons' | 'triangles';

export type Level = 1 | 2 | 3;

export interface Choice {
  id: string;
  /** HTML content of the button (text, math span or SVG). */
  html: string;
  /** Plain text used for comparisons / accessibility. */
  text: string;
  isFigure?: boolean;
}

export interface Part {
  kind: 'choice' | 'number';
  prompt?: string;
  choices?: Choice[];
  /** choice id, or integer as string */
  answer: string;
  /** short hint shown after the first mistake */
  hint: string;
  /** text shown after the input, e.g. "תפוחים" */
  suffix?: string;
}

export interface Question {
  topic: TopicId;
  level: Level;
  /** signature used to avoid repeats between rounds */
  sig: string;
  /** Hebrew instruction (HTML allowed) */
  prompt: string;
  /** arithmetic expression, always shown left-to-right. ☐ marks the blank. */
  math?: string;
  /** HTML/SVG illustration */
  figure?: string;
  parts: Part[];
  /** full explained solution (HTML) */
  explanation: string;
}
