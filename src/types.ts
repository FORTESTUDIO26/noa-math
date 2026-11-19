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

export interface Field {
  /** label after the box, e.g. "אלפים" */
  label: string;
  /** expected digit(s) */
  answer: string;
}

export interface TrapHint {
  /** normalized wrong answers that trigger this hint */
  match: string[];
  hint: string;
}

export interface Part {
  /**
   * choice  – pick one button
   * number  – numeric keyboard
   * text    – typed words (no longer generated: word answers are choices now; kept for old saved rounds)
   * fields  – several numeric boxes in a column (decomposition like in the notebook)
   */
  kind: 'choice' | 'number' | 'text' | 'fields';
  prompt?: string;
  choices?: Choice[];
  /** choice id / integer / display answer for text / "7|0|5|2" for fields */
  answer: string;
  /** short hint shown after the first mistake */
  hint: string;
  /** text shown after the input, e.g. "תפוחים" */
  suffix?: string;
  /** text: all accepted answers (compared after normalization) */
  accept?: string[];
  /** short instruction under the input, e.g. "כותבים את שם המקום" */
  fieldHint?: string;
  /** focused hints for typical wrong answers */
  traps?: TrapHint[];
  /** fields kind */
  fields?: Field[];
  /** fields: hint when a box whose answer is 0 was left empty */
  zeroHint?: string;
  /** HTML shown once the part is solved (or after the 2nd mistake) */
  after?: string;
  /** choice: options keep a logical order (place names, angle types …), so they are not reshuffled */
  fixedOrder?: boolean;
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
  /** illustration that gives the answer away – shown only with the hint or after checking */
  hintFigure?: string;
  parts: Part[];
  /** full explained solution (HTML) */
  explanation: string;
}
