/**
 * מבנה עשרוני וערך הספרה – question types that can all work on the SAME number,
 * so Noa meets one number in several forms (decompose, place name, value, choose, compose).
 */
import type { Level, Question, Part, TopicId } from '../types';
import type { Rng } from '../rng';
import { fmt, m, BLANK, makeChoices, mathChoice, textChoice, placeName, countWord, digitsOf } from '../format';
import { valueAccepts, placeAccepts } from '../answers';
import { cargoBays } from '../space';

/** numbers used in the lesson cards – never used in generated questions */
export const LESSON_NUMBERS = new Set([7639, 7052, 2514, 8147, 473, 352, 3507, 2049, 5308, 3476]);

export type PlaceType =
  | 'fields' | 'composeWords' | 'composeSum' | 'decompMissing' | 'chooseDecomp'
  | 'placeText' | 'valueText' | 'digitAtPlace' | 'placeChoice' | 'valueNumber' | 'whichNumber' | 'repeated';

export interface PlaceOpts { n?: number; digitPlace?: number; askPlace?: number; shuffled?: boolean }

const fromDigits = (ds: number[]) => ds.reduce((s, d, p) => s + d * 10 ** p, 0);
const PLACES = [3, 2, 1, 0];

/** 4-digit number. distinct: all digits different. zero: exactly one 0 (not in thousands). */
export function familyNumber(rng: Rng, o: { zero?: boolean; distinct?: boolean; avoid?: number[] } = {}): number {
  for (;;) {
    const pool = rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const ds = [pool[0], pool[1], pool[2], pool[3]]; // [u,t,h,th]
    if (!o.distinct) { ds[0] = rng.int(1, 9); ds[1] = rng.int(1, 9); }
    if (o.zero) ds[rng.int(0, 2)] = 0;
    const n = fromDigits(ds);
    if (LESSON_NUMBERS.has(n) || (o.avoid ?? []).includes(n)) continue;
    if (o.distinct && new Set(ds).size !== 4) continue;
    return n;
  }
}

const valuesSum = (n: number) => PLACES.map((p) => digitsOf(n)[p] * 10 ** p).filter((v) => v !== 0).map(fmt).join(' + ');

/* ------------------------------------------------------------- the question types */

/** "פרקי את המספר 7639" – four boxes: [ ] אלפים / [ ] מאות / [ ] עשרות / [ ] יחידות */
export function qFields(topic: TopicId, level: Level, n: number): Question {
  const ds = digitsOf(n);
  const zeroP = PLACES.find((p) => ds[p] === 0);
  const fields = PLACES.map((p) => ({ label: placeName(p), answer: String(ds[p]) }));
  const part: Part = {
    kind: 'fields', fields, answer: fields.map((f) => f.answer).join('|'),
    hint: 'בדקי את השורות המסומנות. קראי את המספר משמאל: הספרה הראשונה היא האלפים, והאחרונה (הימנית) היא היחידות.',
    zeroHint: zeroP !== undefined
      ? `ב־${fmt(n)} אין ${placeName(zeroP)}, אבל צריך לכתוב 0 בשורת ה${placeName(zeroP)}. ה־0 שומר על המקום, כדי שכל ספרה תישאר במקום שלה.`
      : undefined,
    fieldHint: 'כתבי ספרה אחת בכל שורה',
    after: `הפירוק לפי ערכים: ${m(`${fmt(n)} = ${valuesSum(n)}`)}`,
  };
  return {
    topic, level, sig: `pv-fields-${n}`,
    prompt: `פרקי את המספר <b>${fmt(n)}</b>.`,
    parts: [part],
    hintFigure: cargoBays(n, { minPlaces: 4 }),
    explanation: `${PLACES.map((p) => `${countWord(ds[p], p)}`).join(', ')}. ${zeroP !== undefined ? `בשורת ה${placeName(zeroP)} כותבים 0. ` : ''}לפי ערכים: ${m(`${fmt(n)} = ${valuesSum(n)}`)}.`,
  };
}

/** "באיזה מקום נמצאת הספרה 3 במספר 7639?" – typed answer "עשרות" */
export function qPlaceText(topic: TopicId, level: Level, n: number, p: number): Question {
  const ds = digitsOf(n);
  const d = ds[p];
  const others = [0, 1, 2, 3].filter((q) => q !== p);
  return {
    topic, level, sig: `dv-placeText-${n}-${p}`,
    prompt: `באיזה מקום נמצאת הספרה <b>${d}</b> במספר <b>${fmt(n)}</b>?`,
    parts: [{
      kind: 'text', answer: placeName(p), accept: placeAccepts(p), fieldHint: 'כתבי את שם המקום: יחידות, עשרות, מאות או אלפים',
      hint: `התחילי מימין: הספרה הראשונה מימין היא ספרת היחידות, אחריה עשרות, מאות ואלפים. ספרי מקומות עד שתגיעי ל־${d}.`,
      traps: [
        { match: valueAccepts(d, p), hint: `כתבת את הערך של הספרה. כאן שואלים על <b>שם המקום</b> – כתבי במילה: יחידות, עשרות, מאות או אלפים.` },
        { match: [String(d)], hint: `${d} היא הספרה עצמה. כתבי את <b>שם המקום</b> שלה במילה.` },
        ...others.map((q) => ({ match: placeAccepts(q), hint: `${placeName(q)} זה לא המקום של ${d}. התחילי מימין וספרי: יחידות, עשרות, מאות, אלפים.` })),
      ],
    }],
    hintFigure: cargoBays(n, { highlight: p, minPlaces: 4 }),
    explanation: `במספר ${m(fmt(n))}: ${PLACES.map((q) => `${placeName(q)} – ${ds[q]}`).join(', ')}. הספרה ${d} נמצאת במקום ה<b>${placeName(p)}</b>.`,
  };
}

/** "מה הערך של הספרה 3 במספר 7639?" – accepts 30, "שלושים", "3 עשרות" */
export function qValueText(topic: TopicId, level: Level, n: number, p: number): Question {
  const d = digitsOf(n)[p];
  const v = d * 10 ** p;
  return {
    topic, level, sig: `dv-valueText-${n}-${p}`,
    prompt: `מה הערך של הספרה <b>${d}</b> במספר <b>${fmt(n)}</b>?`,
    parts: [{
      kind: 'text', answer: fmt(v), accept: valueAccepts(d, p), fieldHint: 'כתבי את הערך – במספר או במילים',
      hint: `קודם מצאי באיזה מקום נמצאת הספרה ${d}. אחר כך חשבי כמה היא שווה שם.`,
      traps: [
        { match: placeAccepts(p), hint: `מצאת את המקום. כמה הן ${d} ${placeName(p)}?` },
        { match: [String(d)], hint: `${d} היא הספרה. במקום ה${placeName(p)} היא שווה יותר – כמה הן ${d} ${placeName(p)}?` },
      ],
    }],
    hintFigure: cargoBays(n, { highlight: p, open: p, minPlaces: 4 }),
    explanation: `הספרה ${d} נמצאת במקום ה${placeName(p)}. ${countWord(d, p)} הן ${m(fmt(v))}, לכן הערך שלה הוא ${m(fmt(v))}.`,
  };
}

/** "איזו ספרה נמצאת במקום המאות במספר 7639?" – 4 different digits, one correct */
export function qDigitAtPlace(rng: Rng, topic: TopicId, level: Level, n: number, p: number): Question {
  const ds = digitsOf(n);
  const correct = ds[p];
  const pool = [...new Set(ds.filter((x) => x !== correct))];
  for (const extra of rng.shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])) if (pool.length < 3 && extra !== correct && !pool.includes(extra)) pool.push(extra);
  const { choices, answer } = makeChoices(rng, mathChoice(String(correct)), pool.slice(0, 3).map((x) => mathChoice(String(x))));
  return {
    topic, level, sig: `dv-digitAt-${n}-${p}`,
    prompt: `איזו ספרה נמצאת במקום ה<b>${placeName(p)}</b> במספר <b>${fmt(n)}</b>?`,
    parts: [{ kind: 'choice', choices, answer, hint: `התחילי מהספרה הימנית (יחידות) וספרי שמאלה: יחידות, עשרות, מאות, אלפים – עד ה${placeName(p)}.` }],
    hintFigure: cargoBays(n, { highlight: p, minPlaces: 4 }),
    explanation: `במספר ${m(fmt(n))} במקום ה${placeName(p)} נמצאת הספרה <b>${correct}</b>.`,
  };
}

/** "כתבי את המספר: 7 אלפים, 6 מאות, 3 עשרות ו־9 יחידות" */
export function qComposeWords(rng: Rng, topic: TopicId, level: Level, n: number, shuffled: boolean): Question {
  const ds = digitsOf(n);
  const nonzero = PLACES.filter((p) => ds[p] !== 0);
  const order = shuffled ? rng.shuffle(nonzero) : nonzero;
  const words = order.map((p) => countWord(ds[p], p));
  const text = words.slice(0, -1).join(', ') + ' ו־' + words[words.length - 1];
  const zeroP = PLACES.find((p) => ds[p] === 0);
  return {
    topic, level, sig: `pv-words-${n}-${shuffled ? 's' : 'o'}`,
    prompt: `${shuffled ? 'שימי לב – הסדר מבולבל. ' : ''}כתבי את המספר: <b>${text}</b>.`,
    parts: [{ kind: 'number', answer: String(n), hint: zeroP !== undefined ? `אין ${placeName(zeroP)} במספר. מה כותבים במקום ה${placeName(zeroP)}?` : 'כתבי ספרה לכל מקום לפי הסדר: אלפים, מאות, עשרות, יחידות.' }],
    hintFigure: cargoBays(n, { minPlaces: 4 }),
    explanation: `מסדרים: אלפים ${ds[3]}, מאות ${ds[2]}, עשרות ${ds[1]}, יחידות ${ds[0]}${zeroP !== undefined ? ` (במקום ה${placeName(zeroP)} כותבים 0)` : ''}. המספר: ${m(fmt(n))}.`,
  };
}

/** "7,000 + 600 + 30 + 9 = ☐" */
export function qComposeSum(topic: TopicId, level: Level, n: number): Question {
  const ds = digitsOf(n);
  return {
    topic, level, sig: `pv-sum-${n}`,
    prompt: 'הרכיבי את המספר. כתבי את התוצאה.',
    math: `${valuesSum(n)} = ${BLANK}`,
    parts: [{ kind: 'number', answer: String(n), hint: 'כל מחובר מתאים למקום אחר: אלפים, מאות, עשרות ויחידות. כתבי ספרה אחת לכל מקום – ו־0 במקום שחסר.' }],
    hintFigure: cargoBays(n, { minPlaces: 4 }),
    explanation: `${PLACES.map((p) => countWord(ds[p], p)).join(', ')}. המספר: ${m(fmt(n))}.`,
  };
}

/** "4,056 = 4,000 + ☐ + 6" */
export function qDecompMissing(rng: Rng, topic: TopicId, level: Level, n: number): Question {
  const ds = digitsOf(n);
  const nonzero = PLACES.filter((p) => ds[p] !== 0 && p !== 3);
  const missP = rng.pick(nonzero);
  const terms = PLACES.filter((p) => ds[p] !== 0).map((p) => (p === missP ? BLANK : fmt(ds[p] * 10 ** p)));
  return {
    topic, level, sig: `pv-miss-${n}-${missP}`,
    prompt: 'השלימי את הפירוק.',
    math: `${fmt(n)} = ${terms.join(' + ')}`,
    parts: [{ kind: 'number', answer: String(ds[missP] * 10 ** missP), hint: `באיזה מקום נמצאת הספרה ${ds[missP]} במספר ${fmt(n)}? כמה היא שווה?` }],
    hintFigure: cargoBays(n, { highlight: missP, open: missP, minPlaces: 4 }),
    explanation: `הספרה ${ds[missP]} נמצאת במקום ה${placeName(missP)} ושווה ${m(fmt(ds[missP] * 10 ** missP))}.`,
  };
}

/** choose the right decomposition */
export function qChooseDecomp(rng: Rng, topic: TopicId, level: Level, n: number): Question {
  const ds = digitsOf(n);
  const nonzero = PLACES.filter((p) => ds[p] !== 0);
  const termsOf = (vals: number[]) => vals.filter((v) => v !== 0).sort((a, b) => b - a).map(fmt).join(' + ');
  const correct = termsOf(nonzero.map((p) => ds[p] * 10 ** p));
  const distract: string[] = [];
  for (const p of nonzero) for (const shift of [-1, 1]) {
    const np = p + shift;
    if (np < 0 || np > 3) continue;
    const vals = nonzero.map((q) => (q === p ? ds[q] * 10 ** np : ds[q] * 10 ** q));
    if (vals.reduce((a, b) => a + b, 0) === n) continue;
    const lab = termsOf(vals);
    if (lab !== correct && !distract.includes(lab)) distract.push(lab);
  }
  const { choices, answer } = makeChoices(rng, mathChoice(correct), rng.sample(distract, 3).map(mathChoice));
  return {
    topic, level, sig: `pv-choose-${n}`,
    prompt: `איזה פירוק מתאים למספר <b>${fmt(n)}</b>?`,
    parts: [{ kind: 'choice', choices, answer, hint: 'בדקי כל ספרה: באיזה מקום היא נמצאת? אפס לא כותבים בפירוק.' }],
    hintFigure: cargoBays(n, { minPlaces: 4 }),
    explanation: `${nonzero.map((p) => `${ds[p]} ב${placeName(p)} = ${m(fmt(ds[p] * 10 ** p))}`).join('; ')}. לכן ${m(`${fmt(n)} = ${correct}`)}.`,
  };
}

/** choose the place name (4 options) */
export function qPlaceChoice(topic: TopicId, level: Level, n: number, p: number): Question {
  const ds = digitsOf(n);
  const d = ds[p];
  const { choices, answer } = makeChoices(null, textChoice(placeName(p)), [0, 1, 2, 3].filter((q) => q !== p).map((q) => textChoice(placeName(q))));
  const order = ['אלפים', 'מאות', 'עשרות', 'יחידות'];
  choices.sort((a, b) => order.indexOf(a.text) - order.indexOf(b.text));
  return {
    topic, level, sig: `dv-place-${n}-${p}`,
    prompt: `באיזה מקום נמצאת הספרה <b>${d}</b> במספר <b>${fmt(n)}</b>?`,
    parts: [{ kind: 'choice', choices, answer, hint: `התחילי מימין: יחידות, עשרות, מאות, אלפים. ספרי מקומות עד שתגיעי ל־${d}.` }],
    hintFigure: cargoBays(n, { highlight: p, minPlaces: 4 }),
    explanation: `במספר ${m(fmt(n))} הספרה ${d} נמצאת במקום ה${placeName(p)}.`,
  };
}

/** numeric value of a digit (number keyboard) */
export function qValueNumber(topic: TopicId, level: Level, n: number, p: number): Question {
  const d = digitsOf(n)[p];
  return {
    topic, level, sig: `dv-val-${n}-${p}`,
    prompt: `מה הערך של הספרה <b>${d}</b> במספר <b>${fmt(n)}</b>? כתבי במספר.`,
    parts: [{ kind: 'number', answer: String(d * 10 ** p), hint: `התחילי מימין: יחידות, עשרות, מאות, אלפים. באיזה מקום נמצאת הספרה ${d}?`, traps: [{ match: [String(d)], hint: `${d} היא הספרה. כמה היא שווה במקום ה${placeName(p)}?` }] }],
    hintFigure: cargoBays(n, { highlight: p, open: p, minPlaces: 4 }),
    explanation: `הספרה ${d} נמצאת במקום ה${placeName(p)}. ${countWord(d, p)} הן ${m(fmt(d * 10 ** p))}.`,
  };
}

/** "באיזה מספר הספרה 6 שווה 600?" */
export function qWhichNumber(rng: Rng, topic: TopicId, level: Level): Question {
  const d = rng.int(1, 9), tp = rng.int(0, 3);
  const make = (p: number) => {
    for (;;) {
      const others = rng.sample([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter((x) => x !== d), 3);
      const ds: number[] = [];
      let k = 0;
      for (let q = 0; q < 4; q++) ds[q] = q === p ? d : others[k++];
      if (ds[3] !== 0 && !LESSON_NUMBERS.has(fromDigits(ds))) return fromDigits(ds);
    }
  };
  const correct = make(tp);
  const { choices, answer } = makeChoices(rng, mathChoice(fmt(correct)), [0, 1, 2, 3].filter((p) => p !== tp).map((p) => mathChoice(fmt(make(p)))));
  const val = d * 10 ** tp;
  return {
    topic, level, sig: `dv-which-${d}-${tp}-${correct}`,
    prompt: `באיזה מספר הספרה ${d} שווה <b>${fmt(val)}</b>?`,
    parts: [{ kind: 'choice', choices, answer, hint: `${fmt(val)} זה ${countWord(d, tp)}. חפשי מספר שבו ${d} נמצאת במקום ה${placeName(tp)}.` }],
    explanation: `${m(fmt(val))} = ${countWord(d, tp)}. רק במספר ${m(fmt(correct))} הספרה ${d} נמצאת במקום ה${placeName(tp)}.`,
  };
}

/** repeated digit: "the 5 in the hundreds place" */
export function qRepeated(rng: Rng, topic: TopicId, level: Level): Question {
  for (;;) {
    const d = rng.int(1, 9);
    const places = rng.sample([0, 1, 2, 3], 2);
    const ds = [0, 0, 0, 0].map(() => rng.pick([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter((x) => x !== d)));
    for (const p of places) ds[p] = d;
    if (ds[3] === 0) continue;
    const n = fromDigits(ds);
    const tp = rng.pick(places);
    return {
      topic, level, sig: `dv-rep-${n}-${tp}`,
      prompt: `במספר <b>${fmt(n)}</b> הספרה ${d} מופיעה פעמיים. מה הערך של הספרה ${d} שנמצאת במקום ה<b>${placeName(tp)}</b>?`,
      parts: [{ kind: 'text', answer: fmt(d * 10 ** tp), accept: valueAccepts(d, tp), fieldHint: 'כתבי את הערך – במספר או במילים', hint: `${countWord(d, tp)} – כמה זה?`, traps: [{ match: placeAccepts(tp), hint: `נכון, היא במקום ה${placeName(tp)}. כמה הן ${d} ${placeName(tp)}?` }] }],
      hintFigure: cargoBays(n, { highlight: tp, open: tp, minPlaces: 4 }),
      explanation: `הספרה ${d} במקום ה${placeName(tp)} שווה ${countWord(d, tp)}, כלומר ${m(fmt(d * 10 ** tp))}.`,
    };
  }
}

/* ------------------------------------------------------------- dispatch by type */

export function placeQuestion(rng: Rng, topic: TopicId, level: Level, type: PlaceType, o: PlaceOpts = {}): Question {
  const zero = type === 'fields' ? level >= 2 : level >= 2 && rng.bool();
  const n = o.n ?? familyNumber(rng, { zero, distinct: type === 'digitAtPlace' });
  const ds = digitsOf(n);
  const nonzeroP = [0, 1, 2, 3].filter((p) => ds[p] !== 0 && ds.filter((x) => x === ds[p]).length === 1);
  const dp = o.digitPlace ?? rng.pick(nonzeroP.length ? nonzeroP : [3]);
  switch (type) {
    case 'fields': return qFields(topic, level, n);
    case 'placeText': return qPlaceText(topic, level, n, dp);
    case 'valueText': return qValueText(topic, level, n, dp);
    case 'digitAtPlace': return qDigitAtPlace(rng, topic, level, n, o.askPlace ?? rng.int(0, 3));
    case 'composeWords': return qComposeWords(rng, topic, level, n, o.shuffled ?? level === 3);
    case 'composeSum': return qComposeSum(topic, level, n);
    case 'decompMissing': return qDecompMissing(rng, topic, level, n);
    case 'chooseDecomp': return qChooseDecomp(rng, topic, level, o.n ?? familyNumber(rng, { zero: true }));
    case 'placeChoice': return qPlaceChoice(topic, level, n, dp);
    case 'valueNumber': return qValueNumber(topic, level, n, dp);
    case 'whichNumber': return qWhichNumber(rng, topic, level);
    case 'repeated': return qRepeated(rng, topic, level);
  }
}

const PV_BY_LEVEL: Record<Level, PlaceType[]> = {
  1: ['fields', 'composeSum', 'composeWords'],
  2: ['fields', 'composeWords', 'decompMissing', 'digitAtPlace'],
  3: ['chooseDecomp', 'composeWords', 'fields'],
};
const DV_BY_LEVEL: Record<Level, PlaceType[]> = {
  1: ['placeText', 'valueNumber', 'digitAtPlace'],
  2: ['valueText', 'placeChoice', 'placeText', 'digitAtPlace'],
  3: ['whichNumber', 'repeated', 'valueText'],
};

export function placeValue(rng: Rng, level: Level): Question {
  return placeQuestion(rng, 'placeValue', level, rng.pick(PV_BY_LEVEL[level]));
}
export function digitValue(rng: Rng, level: Level): Question {
  return placeQuestion(rng, 'digitValue', level, rng.pick(DV_BY_LEVEL[level]));
}

/**
 * Topic round built around two numbers A and B, alternating, so the same number appears
 * in several forms but a question is never right after another question on the same number
 * (its solution can't give the next answer away).
 */
export function familyRound(rng: Rng, topic: 'placeValue' | 'digitValue'): Question[] {
  const A = familyNumber(rng, { distinct: true });
  const B = familyNumber(rng, { zero: true, distinct: true, avoid: [A] });
  const Bd = digitsOf(B);
  const bNonZero = [0, 1, 2, 3].filter((p) => Bd[p] !== 0 && Bd.filter((x) => x === Bd[p]).length === 1);
  if (topic === 'placeValue') {
    return [
      placeQuestion(rng, topic, 1, 'fields', { n: A }),
      placeQuestion(rng, topic, 1, 'composeSum', { n: B }),
      placeQuestion(rng, topic, 2, 'digitAtPlace', { n: A, askPlace: rng.int(0, 3) }),
      placeQuestion(rng, topic, 2, 'fields', { n: B }),
      placeQuestion(rng, topic, 3, 'composeWords', { n: A, shuffled: true }),
      placeQuestion(rng, topic, 3, 'chooseDecomp', { n: B }),
    ];
  }
  // digitValue: A digit asked twice – once its place, later its value (place ≠ value)
  const aP = rng.int(0, 2);
  const askA = rng.pick([0, 1, 2, 3].filter((p) => p !== aP));
  const [b1, b2] = rng.sample(bNonZero, 2);
  return [
    placeQuestion(rng, topic, 1, 'placeText', { n: A, digitPlace: aP }),
    placeQuestion(rng, topic, 1, 'valueText', { n: B, digitPlace: b1 }),
    placeQuestion(rng, topic, 2, 'digitAtPlace', { n: A, askPlace: askA }),
    placeQuestion(rng, topic, 2, 'placeText', { n: B, digitPlace: b2 }),
    placeQuestion(rng, topic, 3, 'valueText', { n: A, digitPlace: aP }),
    placeQuestion(rng, topic, 3, rng.pick(['whichNumber', 'repeated'] as PlaceType[])),
  ];
}
