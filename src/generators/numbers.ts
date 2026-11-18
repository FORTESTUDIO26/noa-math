import { CONFIG } from '../config';
import type { Level, Question, Part } from '../types';
import type { Rng } from '../rng';
import { fmt, m, X, D, MINUS, BLANK, makeChoices, mathChoice, textChoice, placeName, countWord } from '../format';
import { numberLine, sequenceFigure, groupsFigure } from '../figures';

const T = CONFIG.timesTableMax;
const MAXN = CONFIG.maxNumber;

function num(answer: number, hint: string, extra: Partial<Part> = {}): Part {
  return { kind: 'number', answer: String(answer), hint, ...extra };
}

/* ============================================================ מבנה עשרוני */

export function placeValue(rng: Rng, level: Level): Question {
  const topic = 'placeValue' as const;
  if (level === 1) {
    const d = [rng.int(1, 9), rng.int(1, 9), rng.int(1, 9), rng.int(1, 9)]; // th,h,t,u
    const n = d[0] * 1000 + d[1] * 100 + d[2] * 10 + d[3];
    if (rng.bool()) {
      return {
        topic, level, sig: `pv-compose-${n}`,
        prompt: 'הרכיבי את המספר. כתבי את התוצאה.',
        math: `${fmt(d[0] * 1000)} + ${d[1] * 100} + ${d[2] * 10} + ${d[3]} = ${BLANK}`,
        parts: [num(n, 'כל מחובר מתאים למקום אחר: אלפים, מאות, עשרות ויחידות. כתבי ספרה אחת לכל מקום.')],
        explanation: `${countWord(d[0], 3)}, ${countWord(d[1], 2)}, ${countWord(d[2], 1)} ו־${countWord(d[3], 0)}. כותבים את הספרות לפי הסדר: ${m(fmt(n))}.`,
      };
    }
    const missP = rng.int(1, 2); // hundreds or tens
    const vals = [d[0] * 1000, d[1] * 100, d[2] * 10, d[3]];
    const idx = 3 - missP;
    const shown = vals.map((v, i) => (i === idx ? BLANK : fmt(v)));
    return {
      topic, level, sig: `pv-decomp-${n}-${missP}`,
      prompt: 'השלימי את הפירוק של המספר.',
      math: `${fmt(n)} = ${shown.join(' + ')}`,
      parts: [num(vals[idx], `מצאי את הספרה במקום ה${placeName(missP)}. כמה היא שווה?`)],
      explanation: `במספר ${m(fmt(n))} הספרה ${d[idx]} נמצאת במקום ה${placeName(missP)}, ולכן היא שווה ${m(fmt(vals[idx]))}.`,
    };
  }
  if (level === 2) {
    // numbers with a zero
    const zeroAt = rng.pick([1, 2]); // tens or hundreds is 0
    const ds = [rng.int(1, 9), rng.int(1, 9), rng.int(1, 9), rng.int(1, 9)]; // [u,t,h,th]
    ds[zeroAt] = 0;
    const n = ds[3] * 1000 + ds[2] * 100 + ds[1] * 10 + ds[0];
    const words = [3, 2, 1, 0].filter((p) => ds[p] !== 0).map((p) => countWord(ds[p], p));
    if (rng.bool()) {
      const text = words.slice(0, -1).join(', ') + ' ו־' + words[words.length - 1];
      return {
        topic, level, sig: `pv-words0-${n}`,
        prompt: `כתבי את המספר: <b>${text}</b>.`,
        parts: [num(n, `אין ${placeName(zeroAt)} במספר. מה כותבים במקום ה${placeName(zeroAt)}?`)],
        explanation: `כותבים ספרה לכל מקום: אלפים ${ds[3]}, מאות ${ds[2]}, עשרות ${ds[1]}, יחידות ${ds[0]}. במקום שאין בו כלום כותבים 0. לכן המספר הוא ${m(fmt(n))}.`,
      };
    }
    const nonzero = [3, 2, 1, 0].filter((p) => ds[p] !== 0);
    const missP = rng.pick(nonzero.filter((p) => p !== 3));
    const terms = nonzero.map((p) => (p === missP ? BLANK : fmt(ds[p] * 10 ** p)));
    return {
      topic, level, sig: `pv-decomp0-${n}-${missP}`,
      prompt: 'השלימי את הפירוק. שימי לב לאפס.',
      math: `${fmt(n)} = ${terms.join(' + ')}`,
      parts: [num(ds[missP] * 10 ** missP, `באיזה מקום נמצאת הספרה ${ds[missP]} במספר ${fmt(n)}? כמה היא שווה?`)],
      explanation: `במספר ${m(fmt(n))} יש 0 ב${placeName(zeroAt)}, ולכן לא כותבים אותן בפירוק. הספרה ${ds[missP]} נמצאת במקום ה${placeName(missP)} ושווה ${m(fmt(ds[missP] * 10 ** missP))}.`,
    };
  }
  // level 3
  const ds = [rng.int(0, 9), rng.int(0, 9), rng.int(0, 9), rng.int(1, 9)];
  if (ds.filter((x) => x === 0).length === 0) ds[rng.int(0, 2)] = 0;
  if (ds.filter((x) => x !== 0).length < 3) ds[ds.indexOf(0) === 3 ? 2 : ds.indexOf(0)] = rng.int(1, 9);
  const n = ds[3] * 1000 + ds[2] * 100 + ds[1] * 10 + ds[0];
  const nonzero = [3, 2, 1, 0].filter((p) => ds[p] !== 0);
  if (rng.bool()) {
    // words in mixed order
    const order = rng.shuffle(nonzero);
    const words = order.map((p) => countWord(ds[p], p));
    const text = words.slice(0, -1).join(', ') + ' ו־' + words[words.length - 1];
    return {
      topic, level, sig: `pv-mixed-${n}`,
      prompt: `כתבי את המספר. שימי לב – הסדר מבולבל: <b>${text}</b>.`,
      parts: [num(n, 'סדרי לפי המקומות: קודם אלפים, אחר כך מאות, עשרות ויחידות. במקום ריק כותבים 0.')],
      explanation: `מסדרים: אלפים ${ds[3]}, מאות ${ds[2]}, עשרות ${ds[1]}, יחידות ${ds[0]}. המספר הוא ${m(fmt(n))}.`,
    };
  }
  // choose the right decomposition
  const termsOf = (vals: number[]) => vals.filter((v) => v !== 0).map(fmt).join(' + ');
  const correctVals = nonzero.map((p) => ds[p] * 10 ** p);
  const distract: string[] = [];
  for (const p of nonzero) {
    for (const shift of [-1, 1]) {
      const np = p + shift;
      if (np < 0 || np > 3) continue;
      const vals = nonzero.map((q) => (q === p ? ds[q] * 10 ** np : ds[q] * 10 ** q));
      const sum = vals.reduce((a, b) => a + b, 0);
      if (sum === n) continue;
      const lab = termsOf(vals.slice().sort((a, b) => b - a));
      if (!distract.includes(lab) && lab !== termsOf(correctVals)) distract.push(lab);
    }
  }
  const picked = rng.sample(distract, 3);
  const { choices, answer } = makeChoices(rng, mathChoice(termsOf(correctVals)), picked.map(mathChoice));
  return {
    topic, level, sig: `pv-choose-${n}`,
    prompt: `איזה פירוק מתאים למספר <b>${fmt(n)}</b>?`,
    parts: [{ kind: 'choice', choices, answer, hint: 'בדקי כל ספרה: באיזה מקום היא נמצאת? אפס לא כותבים בפירוק.' }],
    explanation: `${nonzero.map((p) => `${ds[p]} ב${placeName(p)} = ${m(fmt(ds[p] * 10 ** p))}`).join('; ')}. לכן ${m(`${fmt(n)} = ${termsOf(correctVals)}`)}.`,
  };
}

/* ============================================================ ערך הספרה */

function distinctDigitsNumber(rng: Rng, len: number, allowZero = true): number[] {
  // returns digits [u,t,h,(th)] distinct, leading non-zero
  for (;;) {
    const pool = allowZero ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] : [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const ds = rng.sample(pool, len);
    if (ds[len - 1] !== 0) return ds;
  }
}
const fromDigits = (ds: number[]) => ds.reduce((s, d, p) => s + d * 10 ** p, 0);

export function digitValue(rng: Rng, level: Level): Question {
  const topic = 'digitValue' as const;
  const hintRight = 'התחילי מימין: הספרה הראשונה מימין היא ספרת היחידות, אחריה עשרות, מאות ואלפים.';
  if (level === 1) {
    const len = rng.pick([3, 4]);
    const ds = distinctDigitsNumber(rng, len);
    const nz = ds.map((d, p) => ({ d, p })).filter((x) => x.d !== 0 && x.p > 0);
    const t = rng.pick(nz);
    const n = fromDigits(ds);
    return {
      topic, level, sig: `dv-val-${n}-${t.p}`,
      prompt: `מה הערך של הספרה <b>${t.d}</b> במספר <b>${fmt(n)}</b>?`,
      parts: [num(t.d * 10 ** t.p, `${hintRight} באיזה מקום נמצאת הספרה ${t.d}?`)],
      explanation: `הספרה ${t.d} נמצאת במקום ה${placeName(t.p)}. ${countWord(t.d, t.p)} הן ${m(fmt(t.d * 10 ** t.p))}, לכן הערך שלה הוא ${m(fmt(t.d * 10 ** t.p))}.`,
    };
  }
  if (level === 2) {
    // which place? number has a zero somewhere
    const ds = distinctDigitsNumber(rng, 4, true);
    if (!ds.includes(0)) ds[rng.int(0, 2)] = 0;
    const cand = ds.map((d, p) => ({ d, p })).filter((x) => ds.filter((y) => y === x.d).length === 1);
    const t = rng.pick(cand);
    const n = fromDigits(ds);
    const { choices, answer } = makeChoices(null, textChoice(placeName(t.p)), [0, 1, 2, 3].filter((p) => p !== t.p).map((p) => textChoice(placeName(p))));
    // keep a fixed, logical order: אלפים, מאות, עשרות, יחידות
    const order = ['אלפים', 'מאות', 'עשרות', 'יחידות'];
    choices.sort((a, b) => order.indexOf(a.text) - order.indexOf(b.text));
    return {
      topic, level, sig: `dv-place-${n}-${t.p}`,
      prompt: `באיזה מקום נמצאת הספרה <b>${t.d}</b> במספר <b>${fmt(n)}</b>?`,
      parts: [{ kind: 'choice', choices, answer, hint: `${hintRight} ספרי מקומות עד שתגיעי ל־${t.d}.` }],
      explanation: `במספר ${m(fmt(n))}: ${[3, 2, 1, 0].map((p) => `${placeName(p)} – ${ds[p]}`).join(', ')}. לכן הספרה ${t.d} נמצאת במקום ה${placeName(t.p)}.`,
    };
  }
  // level 3
  if (rng.bool()) {
    // repeated digit; ask for value at a named place (e.g. "the 4 in the hundreds place")
    const d = rng.int(1, 9);
    const places = rng.sample([0, 1, 2, 3], 2);
    const ds = [0, 0, 0, 0].map(() => rng.pick([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter((x) => x !== d)));
    for (const p of places) ds[p] = d;
    if (ds[3] === 0) ds[3] = d === 9 ? 1 : d + 1;
    const tp = rng.pick(places);
    const n = fromDigits(ds);
    if (ds.filter((x) => x === d).length !== 2) return digitValue(rng, level);
    return {
      topic, level, sig: `dv-rep-${n}-${tp}`,
      prompt: `במספר <b>${fmt(n)}</b> הספרה ${d} מופיעה פעמיים. מה הערך של הספרה ${d} שנמצאת במקום ה<b>${placeName(tp)}</b>?`,
      parts: [num(d * 10 ** tp, `${countWord(d, tp)} – כמה זה?`)],
      explanation: `הספרה ${d} במקום ה${placeName(tp)} שווה ${countWord(d, tp)}, כלומר ${m(fmt(d * 10 ** tp))}.`,
    };
  }
  // which number has digit d worth d*10^p
  const d = rng.int(1, 9);
  const tp = rng.int(0, 3);
  const make = (p: number) => {
    const others = rng.sample([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter((x) => x !== d), 3);
    const ds: number[] = [];
    let k = 0;
    for (let q = 0; q < 4; q++) ds[q] = q === p ? d : others[k++];
    if (ds[3] === 0) ds[3] = [1, 2, 3, 4, 5, 6, 7, 8, 9].find((x) => x !== d && !ds.includes(x))!;
    return fromDigits(ds);
  };
  const correct = make(tp);
  const dis = [0, 1, 2, 3].filter((p) => p !== tp).map(make);
  const { choices, answer } = makeChoices(rng, mathChoice(fmt(correct)), dis.map((x) => mathChoice(fmt(x))));
  const val = d * 10 ** tp;
  return {
    topic, level, sig: `dv-which-${d}-${tp}-${correct}`,
    prompt: `באיזה מספר הספרה ${d} שווה <b>${fmt(val)}</b>?`,
    parts: [{ kind: 'choice', choices, answer, hint: `${fmt(val)} זה ${countWord(d, tp)}. חפשי מספר שבו ${d} נמצאת במקום ה${placeName(tp)}.` }],
    explanation: `${m(fmt(val))} = ${countWord(d, tp)}. רק במספר ${m(fmt(correct))} הספרה ${d} נמצאת במקום ה${placeName(tp)}.`,
  };
}

/* ============================================================ קודם ועוקב */

export function prevNext(rng: Rng, level: Level): Question {
  const topic = 'prevNext' as const;
  const isNext = rng.bool();
  let n: number;
  if (level === 1) {
    n = rng.int(12, 980);
    while (n % 10 === 9 || n % 10 === 0) n++;
  } else if (level === 2) {
    if (isNext) n = rng.bool() ? rng.int(1, 98) * 10 + 9 : rng.int(1, 9) * 100 + 99;
    else n = rng.bool() ? rng.int(2, 99) * 10 : rng.int(2, 9) * 100;
  } else {
    if (rng.bool(0.3)) {
      const mid = rng.int(1, 9) * 1000 + rng.pick([0, rng.int(1, 9) * 100]);
      return {
        topic, level, sig: `pn-between-${mid}`,
        prompt: `איזה מספר נמצא בדיוק בין <b>${fmt(mid - 1)}</b> ל־<b>${fmt(mid + 1)}</b>?`,
        parts: [num(mid, `זה המספר העוקב של ${fmt(mid - 1)}. הוסיפי 1.`)],
        explanation: `${m(`${fmt(mid - 1)} + 1 = ${fmt(mid)}`)} וגם ${m(`${fmt(mid + 1)} ${MINUS} 1 = ${fmt(mid)}`)}. לכן המספר הוא ${m(fmt(mid))}.`,
      };
    }
    if (isNext) n = rng.bool() ? rng.int(1, 9) * 1000 - 1 : rng.int(1, 9) * 1000 + rng.int(0, 9) * 100 + 99;
    else n = rng.bool() ? rng.int(1, 9) * 1000 : rng.int(1, 9) * 1000 + rng.int(1, 9) * 100;
  }
  const ans = isNext ? n + 1 : n - 1;
  return {
    topic, level, sig: `pn-${isNext ? 'n' : 'p'}-${n}`,
    prompt: isNext ? `מה המספר <b>העוקב</b> של <b>${fmt(n)}</b>?` : `מה המספר <b>הקודם</b> של <b>${fmt(n)}</b>?`,
    parts: [num(ans, isNext ? 'המספר העוקב גדול ב־1. הוסיפי 1 – ושימי לב למעבר עשרת או מאה.' : 'המספר הקודם קטן ב־1. הורידי 1 – ושימי לב למעבר עשרת או מאה.')],
    explanation: isNext
      ? `העוקב גדול ב־1: ${m(`${fmt(n)} + 1 = ${fmt(ans)}`)}.`
      : `הקודם קטן ב־1: ${m(`${fmt(n)} ${MINUS} 1 = ${fmt(ans)}`)}.`,
  };
}

/* ============================================================ זוגי ואי־זוגי */

const EVEN = 'זוגי', ODD = 'אי־זוגי';

export function evenOdd(rng: Rng, level: Level): Question {
  const topic = 'evenOdd' as const;
  const hint = 'הסתכלי רק על ספרת היחידות – הספרה הימנית. אם היא 0, 2, 4, 6 או 8 – המספר זוגי.';
  if (level === 1) {
    const n = rng.int(11, 999);
    const even = n % 2 === 0;
    const { choices, answer } = makeChoices(null, textChoice(even ? EVEN : ODD), [textChoice(even ? ODD : EVEN)]);
    choices.sort((a, b) => (a.text === EVEN ? 0 : 1) - (b.text === EVEN ? 0 : 1));
    return {
      topic, level, sig: `eo-is-${n}`,
      prompt: `האם המספר <b>${fmt(n)}</b> זוגי או אי־זוגי?`,
      parts: [{ kind: 'choice', choices, answer, hint }],
      explanation: `ספרת היחידות היא ${n % 10}. ${n % 10} ${even ? 'זוגי' : 'אי־זוגי'}, ולכן ${m(fmt(n))} ${even ? 'זוגי' : 'אי־זוגי'}.`,
    };
  }
  if (level === 2) {
    const wantEven = rng.bool();
    const base = () => rng.int(100, 999) * 10;
    const right = base() + (wantEven ? rng.pick([0, 2, 4, 6, 8]) : rng.pick([1, 3, 5, 7, 9]));
    const wrong = new Set<number>();
    while (wrong.size < 3) {
      const w = base() + (wantEven ? rng.pick([1, 3, 5, 7, 9]) : rng.pick([0, 2, 4, 6, 8]));
      if (w !== right) wrong.add(w);
    }
    const { choices, answer } = makeChoices(rng, mathChoice(fmt(right)), [...wrong].map((w) => mathChoice(fmt(w))));
    return {
      topic, level, sig: `eo-pick-${right}`,
      prompt: `בחרי את המספר ה<b>${wantEven ? EVEN : ODD}</b>.`,
      parts: [{ kind: 'choice', choices, answer, hint }],
      explanation: `בודקים רק את ספרת היחידות. ב־${m(fmt(right))} ספרת היחידות היא ${right % 10}, ולכן הוא ${wantEven ? EVEN : ODD}. בשאר המספרים ספרת היחידות ${wantEven ? 'אי־זוגית' : 'זוגית'}.`,
    };
  }
  const wantEven = rng.bool();
  const n = rng.int(100, 9990);
  const ans = wantEven ? (n % 2 === 0 ? n + 2 : n + 1) : n % 2 === 1 ? n + 2 : n + 1;
  return {
    topic, level, sig: `eo-next-${wantEven ? 'e' : 'o'}-${n}`,
    prompt: `מה המספר ה<b>${wantEven ? EVEN : ODD}</b> הבא שגדול מ־<b>${fmt(n)}</b>?`,
    parts: [num(ans, `האם ${fmt(n)} עצמו ${wantEven ? EVEN : ODD}? מספרים זוגיים ואי־זוגיים באים לסירוגין.`)],
    explanation: `${m(fmt(n))} הוא ${n % 2 === 0 ? EVEN : ODD}. ${n % 2 === 0 === wantEven ? `המספר ה${wantEven ? EVEN : ODD} הבא גדול ב־2` : `המספר הבא, ${m(fmt(n + 1))}, כבר ${wantEven ? EVEN : ODD}`}: ${m(fmt(ans))}.`,
  };
}

/* ============================================================ כפל וחילוק */

export function multDiv(rng: Rng, level: Level): Question {
  const topic = 'multDiv' as const;
  if (level === 1) {
    const a = rng.pick([2, 3, 4, 5, 10]), b = rng.int(1, T);
    if (rng.bool(0.7)) {
      return {
        topic, level, sig: `md-m-${a}x${b}`,
        prompt: 'פתרי את התרגיל.',
        math: `${a} ${X} ${b} = ${BLANK}`,
        parts: [num(a * b, `${a} ${X} ${b} זה ${a} פעמים ${b}. אפשר לחבר: ${Array(a).fill(b).join(' + ')}.`)],
        explanation: `${m(`${a} ${X} ${b}`)} פירושו ${a} פעמים ${b}: ${m(Array(a).fill(b).join(' + ') + ' = ' + a * b)}.`,
      };
    }
    return divQ(rng, level, a, b);
  }
  if (level === 2) {
    const a = rng.int(6, 9), b = rng.int(3, 9);
    if (rng.bool()) {
      const [p, q] = rng.bool() ? [a, b] : [b, a];
      return {
        topic, level, sig: `md-m-${p}x${q}`,
        prompt: 'פתרי את התרגיל.',
        math: `${p} ${X} ${q} = ${BLANK}`,
        parts: [num(p * q, `היעזרי בתרגיל שאת יודעת: ${p} ${X} ${q - 1} = ${p * (q - 1)}. כמה צריך להוסיף?`)],
        explanation: `${m(`${p} ${X} ${q - 1} = ${p * (q - 1)}`)}, ועוד ${p} אחד: ${m(`${p * (q - 1)} + ${p} = ${p * q}`)}. לכן ${m(`${p} ${X} ${q} = ${p * q}`)}.`,
      };
    }
    return divQ(rng, level, b, a);
  }
  // level 3 – the link between multiplication and division
  const a = rng.int(3, 9), b = rng.int(3, 9), c = a * b;
  if (rng.bool()) {
    const [x, y] = rng.bool() ? [a, b] : [b, a];
    return {
      topic, level, sig: `md-fam-${x}-${y}`,
      prompt: `היעזרי בתרגיל הכפל ${m(`${a} ${X} ${b} = ${c}`)} והשלימי את תרגיל החילוק.`,
      math: `${c} ${D} ${x} = ${BLANK}`,
      parts: [num(y, `בתרגיל הכפל ${a} ${X} ${b} = ${c}. ${x} כפול כמה שווה ${c}?`)],
      explanation: `חילוק הוא הפעולה ההפוכה לכפל. ${m(`${x} ${X} ${y} = ${c}`)}, לכן ${m(`${c} ${D} ${x} = ${y}`)}.`,
    };
  }
  const correct = rng.bool() ? `${c} ${D} ${b} = ${a}` : `${c} ${D} ${a} = ${b}`;
  const wrongs = new Set<string>();
  const cands = [
    `${c} ${D} ${b} = ${a + 1}`, `${c} ${D} ${a} = ${b - 1}`, `${b} ${D} ${c} = ${a}`, `${c} ${D} ${a + b} = ${a}`,
    `${c} ${D} ${b} = ${b}`, `${c} ${D} ${a} = ${a}`,
  ].filter((s) => {
    // keep only statements that are really false
    const mm = s.match(/^(\d+) : (\d+) = (\d+)$/);
    if (!mm) return true;
    const [, p, q, r] = mm.map(Number) as unknown as number[];
    return !(q !== 0 && p / q === r);
  });
  for (const s of rng.shuffle(cands)) if (wrongs.size < 3 && s !== correct) wrongs.add(s);
  const { choices, answer } = makeChoices(rng, mathChoice(correct), [...wrongs].map(mathChoice));
  return {
    topic, level, sig: `md-pick-${a}-${b}`,
    prompt: `${m(`${a} ${X} ${b} = ${c}`)}. איזה תרגיל חילוק נכון לפי תרגיל הכפל?`,
    parts: [{ kind: 'choice', choices, answer, hint: `בתרגיל חילוק מתחילים מהמספר הגדול (${c}) ומחלקים באחד המספרים שהכפלנו.` }],
    explanation: `מתרגיל הכפל ${m(`${a} ${X} ${b} = ${c}`)} יוצאים שני תרגילי חילוק: ${m(`${c} ${D} ${b} = ${a}`)} ו־${m(`${c} ${D} ${a} = ${b}`)}. התשובה הנכונה: ${m(correct)}.`,
  };
}

function divQ(rng: Rng, level: Level, divisor: number, quotient: number): Question {
  const d = Math.max(CONFIG.minDivisor, divisor);
  const c = d * quotient;
  return {
    topic: 'multDiv', level, sig: `md-d-${c}:${d}`,
    prompt: 'פתרי את תרגיל החילוק.',
    math: `${c} ${D} ${d} = ${BLANK}`,
    parts: [num(quotient, `חשבי בכפל: ${d} כפול כמה שווה ${c}?`)],
    explanation: `שואלים: ${m(`${d} ${X} ${BLANK} = ${c}`)}. ${m(`${d} ${X} ${quotient} = ${c}`)}, לכן ${m(`${c} ${D} ${d} = ${quotient}`)}.`,
  };
}

/* ============================================================ מספר חסר */

export function missing(rng: Rng, level: Level): Question {
  const topic = 'missing' as const;
  const kinds: Record<Level, string[]> = {
    1: ['add', 'mulL', 'mulR'],
    2: ['mulR', 'mulL', 'dividend', 'sub'],
    3: ['divisor', 'mulL', 'dividend', 'addBig'],
  };
  const k = rng.pick(kinds[level]);
  const small = level === 1;
  const a = small ? rng.int(2, 5) : rng.int(3, 9), b = small ? rng.int(2, 9) : rng.int(4, T);
  const c = a * b;
  switch (k) {
    case 'mulL':
      return {
        topic, level, sig: `ms-mulL-${a}-${b}`,
        prompt: 'איזה מספר חסר?', math: `${BLANK} ${X} ${b} = ${c}`,
        parts: [num(a, `כמה פעמים ${b} זה ${c}? אפשר לספור בקפיצות של ${b}.`)],
        explanation: `מחפשים כמה פעמים ${b} נותן ${c}: ${m(`${c} ${D} ${b} = ${a}`)}. בדיקה: ${m(`${a} ${X} ${b} = ${c}`)}.`,
      };
    case 'mulR':
      return {
        topic, level, sig: `ms-mulR-${a}-${b}`,
        prompt: 'איזה מספר חסר?', math: `${a} ${X} ${BLANK} = ${c}`,
        parts: [num(b, `${a} כפול כמה שווה ${c}? אפשר להשתמש בחילוק: ${c} ${D} ${a}.`)],
        explanation: `${m(`${c} ${D} ${a} = ${b}`)}. בדיקה: ${m(`${a} ${X} ${b} = ${c}`)}.`,
      };
    case 'dividend':
      return {
        topic, level, sig: `ms-dvd-${a}-${b}`,
        prompt: 'איזה מספר חסר?', math: `${BLANK} ${D} ${a} = ${b}`,
        parts: [num(c, `המספר החסר הוא המספר שמחלקים. כפלי: ${a} ${X} ${b}.`)],
        explanation: `חילוק הפוך לכפל: ${m(`${a} ${X} ${b} = ${c}`)}, לכן ${m(`${c} ${D} ${a} = ${b}`)}.`,
      };
    case 'divisor': {
      return {
        topic, level, sig: `ms-dvs-${a}-${b}`,
        prompt: 'איזה מספר חסר?', math: `${c} ${D} ${BLANK} = ${b}`,
        parts: [num(a, `באיזה מספר מחלקים את ${c} כדי לקבל ${b}? חשבי: ${BLANK} ${X} ${b} = ${c}.`)],
        explanation: `מחפשים מספר שכשכופלים אותו ב־${b} מקבלים ${c}: ${m(`${a} ${X} ${b} = ${c}`)}. לכן ${m(`${c} ${D} ${a} = ${b}`)}.`,
      };
    }
    case 'add': {
      const total = rng.int(3, 10) * 10, x = rng.int(1, total / 10 - 1) * 10 - rng.int(0, 1) * 5;
      return {
        topic, level, sig: `ms-add-${x}-${total}`,
        prompt: 'איזה מספר חסר?', math: `${x} + ${BLANK} = ${total}`,
        parts: [num(total - x, `כמה חסר מ־${x} עד ${total}? אפשר לחסר: ${total} ${MINUS} ${x}.`)],
        explanation: `${m(`${total} ${MINUS} ${x} = ${total - x}`)}. בדיקה: ${m(`${x} + ${total - x} = ${total}`)}.`,
      };
    }
    case 'sub': {
      const x = rng.int(3, 9) * 100, y = rng.int(1, x / 100 - 1) * 100 + rng.pick([0, 50]);
      return {
        topic, level, sig: `ms-sub-${x}-${y}`,
        prompt: 'איזה מספר חסר?', math: `${x} ${MINUS} ${BLANK} = ${x - y}`,
        parts: [num(y, `כמה הורידו מ־${x} כדי להגיע ל־${x - y}?`)],
        explanation: `${m(`${x} ${MINUS} ${x - y} = ${y}`)}. בדיקה: ${m(`${x} ${MINUS} ${y} = ${x - y}`)}.`,
      };
    }
    default: {
      const total = rng.int(2, 9) * 1000, x = rng.int(1, total / 50 - 1) * 50;
      return {
        topic, level, sig: `ms-addB-${x}-${total}`,
        prompt: 'איזה מספר חסר?', math: `${BLANK} + ${fmt(x)} = ${fmt(total)}`,
        parts: [num(total - x, `כמה צריך להוסיף ל־${fmt(x)} כדי להגיע ל־${fmt(total)}? חסרי: ${fmt(total)} ${MINUS} ${fmt(x)}.`)],
        explanation: `${m(`${fmt(total)} ${MINUS} ${fmt(x)} = ${fmt(total - x)}`)}. בדיקה: ${m(`${fmt(total - x)} + ${fmt(x)} = ${fmt(total)}`)}.`,
      };
    }
  }
}

/* ============================================================ ישר המספרים */

export function numberLineQ(rng: Rng, level: Level): Question {
  const topic = 'numberLine' as const;
  const count = 7;
  let step: number, labeled: number[], unknown: number;
  if (level === 1) {
    step = rng.pick([1, 2, 5, 10]);
    labeled = [0, 1];
    unknown = rng.int(3, 6);
  } else if (level === 2) {
    step = rng.pick([10, 20, 25, 50, 100]);
    labeled = [0, 2];
    unknown = rng.pick([1, 3, 4, 5, 6]);
  } else {
    step = rng.pick([100, 200, 250, 500, 1000]);
    labeled = rng.pick([[1, 3], [2, 5], [0, 4]]);
    unknown = rng.pick([0, 1, 2, 3, 4, 5, 6].filter((i) => !labeled.includes(i)));
  }
  const maxStart = Math.floor((MAXN - step * (count - 1)) / step);
  const startK = level === 1 ? rng.int(step === 1 ? 10 : 0, step === 1 ? 90 : 20) : rng.int(0, Math.min(maxStart, level === 2 ? Math.floor(1000 / step) : maxStart));
  const start = startK * step;
  const val = (i: number) => start + i * step;
  const [i0, i1] = labeled;
  const jumps = i1 - i0;
  const ans = val(unknown);
  const dist = unknown - i0;
  return {
    topic, level, sig: `nl-${start}-${step}-${unknown}-${labeled.join('')}`,
    prompt: 'איזה מספר מתאים לשנתה עם סימן השאלה?',
    figure: numberLine({ start, step, count, labeled, unknown }),
    parts: [num(ans, jumps === 1
      ? 'בדקי בכמה המספרים גדלים בין שתי שנתות.'
      : `בין ${fmt(val(i0))} ל־${fmt(val(i1))} יש ${jumps} קפיצות. בכמה גדל המספר בכל קפיצה?`)],
    explanation: `בין ${m(fmt(val(i0)))} ל־${m(fmt(val(i1)))} יש ${jumps === 1 ? 'קפיצה אחת' : `${jumps} קפיצות`}: ${jumps === 1 ? m(`${fmt(val(i1))} ${MINUS} ${fmt(val(i0))} = ${fmt(step)}`) : m(`(${fmt(val(i1))} ${MINUS} ${fmt(val(i0))}) ${D} ${jumps} = ${fmt(step)}`)}, כלומר כל קפיצה היא ${m(fmt(step))}. ` +
      (dist >= 0
        ? `סימן השאלה נמצא ${dist} קפיצות אחרי ${m(fmt(val(i0)))}: ${m(`${fmt(val(i0))} + ${dist} ${X} ${fmt(step)} = ${fmt(ans)}`)}.`
        : `סימן השאלה נמצא ${-dist} קפיצות לפני ${m(fmt(val(i0)))}: ${m(`${fmt(val(i0))} ${MINUS} ${-dist} ${X} ${fmt(step)} = ${fmt(ans)}`)}.`),
  };
}

/* ============================================================ סדרות */

export function sequences(rng: Rng, level: Level): Question {
  const topic = 'sequences' as const;
  const len = 5;
  let step: number, up: boolean, blank: number;
  if (level === 1) { step = rng.pick([2, 5, 10]); up = true; blank = rng.pick([3, 4]); }
  else if (level === 2) { step = rng.pick([3, 4, 25, 50, 100]); up = rng.bool(); blank = rng.int(1, 3); }
  else { step = rng.pick([6, 7, 8, 9, 250, 500, 1000]); up = rng.bool(); blank = rng.int(0, 4); }
  const span = step * (len - 1);
  const cap = step >= 250 ? MAXN - span : step >= 25 ? 2000 : 150;
  let base = rng.int(0, Math.floor(cap / step)) * step;
  if (step < 25 && rng.bool()) base += rng.int(1, step - 1); // not always multiples of the step
  const first = up ? base : base + span;
  const terms = Array.from({ length: len }, (_, i) => first + (up ? 1 : -1) * i * step);
  const ans = terms[blank];
  const ref = blank === 0 ? 1 : 0;
  return {
    topic, level, sig: `sq-${terms.join('_')}-${blank}`,
    prompt: `השלימי את המספר החסר בסדרה ה${up ? 'עולה' : 'יורדת'}.`,
    figure: sequenceFigure(terms, blank),
    parts: [num(ans, `בדקי בכמה המספרים ${up ? 'גדלים' : 'קטנים'}: מ־${fmt(terms[ref])} ל־${fmt(terms[ref + 1 === blank ? ref + 2 : ref + 1])}.`)],
    explanation: `בכל צעד המספר ${up ? 'גדל' : 'קטן'} ב־${m(fmt(step))}. ` +
      (blank === 0
        ? `המספר הראשון ${up ? 'קטן' : 'גדול'} ב־${fmt(step)} מ־${m(fmt(terms[1]))}: ${m(`${fmt(terms[1])} ${up ? MINUS : '+'} ${fmt(step)} = ${fmt(ans)}`)}.`
        : m(`${fmt(terms[blank - 1])} ${up ? '+' : MINUS} ${fmt(step)} = ${fmt(ans)}`) + '.'),
  };
}

/* ============================================================ משמעות הכפל */

const ITEMS = [
  { one: 'עיגולים', fig: 'dot' as const },
  { one: 'כוכבים', fig: 'star' as const },
];

export function multMeaning(rng: Rng, level: Level): Question {
  const topic = 'multMeaning' as const;
  const g = rng.int(2, 5), p = rng.int(2, 6);
  const it = rng.pick(ITEMS);
  if (level === 1) {
    return {
      topic, level, sig: `mm-count-${g}-${p}`,
      prompt: 'הסתכלי על הציור והשיבי על השאלות.',
      figure: groupsFigure(Array(g).fill(p), { item: it.fig }),
      parts: [
        num(g, 'ספרי את המסגרות. כל מסגרת היא קבוצה.', { prompt: 'כמה קבוצות יש?' }),
        num(p, 'בחרי קבוצה אחת וספרי את מה שיש בתוכה.', { prompt: `כמה ${it.one} יש בכל קבוצה?` }),
        num(g * p, `יש ${g} קבוצות של ${p}. ${g} ${X} ${p} = ?`, { prompt: `כמה ${it.one} יש בסך הכל?` }),
      ],
      explanation: `יש ${g} קבוצות, ובכל קבוצה ${p} ${it.one}. התרגיל: ${m(`${g} ${X} ${p} = ${g * p}`)}.`,
    };
  }
  if (level === 2) {
    const cands = [`${g} + ${p}`, `${g} ${X} ${p + 1}`, `${g + 1} ${X} ${p}`, `${p} + ${p}`, `${g} ${X} ${g}`]
      .filter((s) => s !== `${g} ${X} ${p}` && s !== `${p} ${X} ${g}`);
    const uniq = [...new Set(cands)];
    const { choices, answer } = makeChoices(rng, mathChoice(`${g} ${X} ${p}`), rng.sample(uniq, 3).map(mathChoice));
    return {
      topic, level, sig: `mm-expr-${g}-${p}`,
      prompt: 'איזה תרגיל מתאים לציור?',
      figure: groupsFigure(Array(g).fill(p), { item: it.fig }),
      parts: [{ kind: 'choice', choices, answer, hint: 'כמה קבוצות יש? וכמה בכל קבוצה? התרגיל: מספר הקבוצות × כמה בכל קבוצה.' }],
      explanation: `יש ${g} קבוצות שוות, ובכל אחת ${p}. לכן התרגיל הוא ${m(`${g} ${X} ${p}`)} (וביחד ${g * p}).`,
    };
  }
  // level 3: choose the drawing for an exercise
  const variants: number[][] = [];
  const key = (c: number[]) => c.slice().sort().join(',');
  const add = (c: number[]) => { if (c.every((x) => x >= 1) && !variants.some((v) => key(v) === key(c))) variants.push(c); };
  const correct = Array(g).fill(p);
  add(correct);
  const pool: number[][] = [Array(g).fill(p + 1), Array(g + 1).fill(p), Array(g).fill(p - 1)];
  // unequal groups with the same total – not multiplication
  const uneven = Array(g).fill(p); uneven[0] += 1; uneven[g - 1] -= 1;
  pool.push(uneven);
  for (const c of rng.shuffle(pool)) {
    if (variants.length >= 4) break;
    if (c.length === p && c.every((x) => x === g)) continue; // never offer the swapped picture
    if (c.some((x) => x < 1) || c.length > 6 || Math.max(...c) > 7) continue;
    add(c);
  }
  const fig = (c: number[]) => ({ html: groupsFigure(c, { item: it.fig, size: 'small' }), text: key(c) + '|' + c.length, isFigure: true });
  const { choices, answer } = makeChoices(rng, fig(correct), variants.slice(1).map(fig));
  return {
    topic, level, sig: `mm-pic-${g}-${p}`,
    prompt: `איזה ציור מתאים לתרגיל ${m(`${g} ${X} ${p}`)}?`,
    parts: [{ kind: 'choice', choices, answer, hint: `צריך ${g} קבוצות שוות, ובכל קבוצה בדיוק ${p}. בדקי גם שכל הקבוצות שוות.` }],
    explanation: `${m(`${g} ${X} ${p}`)} פירושו ${g} קבוצות שוות של ${p}. בציור הנכון יש ${g} מסגרות, ובכל אחת ${p}.`,
  };
}

/* ============================================================ בעיות מילוליות */

const NAMES = ['נועה', 'מאיה', 'יעל', 'תמר', 'שירה', 'אורי', 'דניאל', 'איתי'];
type Op = '+' | '−' | '×' | ':';

interface WP { text: string; a: number; b: number; op: Op; unit: string; why: string }

function wpTemplate(rng: Rng, level: Level): WP {
  const name = rng.pick(NAMES);
  const kinds: Record<Level, string[]> = { 1: ['mul', 'add', 'sub'], 2: ['mul', 'share', 'groups', 'sub'], 3: ['times', 'groups', 'share', 'subBig'] };
  const k = rng.pick(kinds[level]);
  const g = rng.int(3, 9), p = rng.int(3, level === 1 ? 6 : 9);
  switch (k) {
    case 'mul': {
      const [thing, box] = rng.pick([['עפרונות', 'קופסאות'], ['ביצים', 'תבניות'], ['מדבקות', 'דפים'], ['תפוחים', 'שקיות']]);
      return { text: `ל${name} יש ${g} ${box}. בכל אחת יש ${p} ${thing}. כמה ${thing} יש בסך הכל?`, a: g, b: p, op: '×', unit: thing, why: `יש ${g} קבוצות שוות של ${p}, לכן כופלים.` };
    }
    case 'add': {
      const a = rng.int(12, 60), b = rng.int(11, 39);
      return { text: `בספרייה של הכיתה היו ${a} ספרים. ${name} הביאה עוד ${b} ספרים. כמה ספרים יש עכשיו?`, a, b, op: '+', unit: 'ספרים', why: 'הוסיפו ספרים, לכן מחברים.' };
    }
    case 'sub': {
      const a = rng.int(40, 95), b = rng.int(11, a - 10);
      return { text: `ל${name} היו ${a} חרוזים. היא השתמשה ב־${b} חרוזים לצמיד. כמה חרוזים נשארו לה?`, a, b, op: '−', unit: 'חרוזים', why: 'השתמשו בחלק מהחרוזים ולוקחים אותם, לכן מחסרים.' };
    }
    case 'share': {
      return { text: `${g * p} עוגיות חולקו שווה בשווה ל־${g} ילדים. כמה עוגיות קיבל כל ילד?`, a: g * p, b: g, op: ':', unit: 'עוגיות', why: 'מחלקים שווה בשווה, לכן מחלקים.' };
    }
    case 'groups': {
      return { text: `במגירה ${g * p} גרביים. ${name} שמה בכל שקית ${p} גרביים. כמה שקיות היא מילאה?`, a: g * p, b: p, op: ':', unit: 'שקיות', why: `מחלקים את ${g * p} לקבוצות של ${p}, לכן מחלקים.` };
    }
    case 'times': {
      return { text: `ל${name} יש ${p} בולים. לאחיה יש פי ${g} בולים ממנה. כמה בולים יש לאחיה?`, a: p, b: g, op: '×', unit: 'בולים', why: `"פי ${g}" פירושו ${g} פעמים יותר, לכן כופלים.` };
    }
    default: {
      const a = rng.int(12, 60) * 50, b = rng.int(5, a / 50 - 2) * 50;
      return { text: `בבית הספר ${fmt(a)} מחברות. חילקו לתלמידים ${fmt(b)} מחברות. כמה מחברות נשארו?`, a, b, op: '−', unit: 'מחברות', why: 'חילקו חלק מהמחברות ולוקחים אותן, לכן מחסרים.' };
    }
  }
}

function calc(a: number, b: number, op: Op): number | null {
  if (op === '+') return a + b;
  if (op === '−') return a - b >= 0 ? a - b : null;
  if (op === '×') return a * b;
  return b !== 0 && a % b === 0 ? a / b : null;
}

export function wordProblems(rng: Rng, level: Level): Question {
  const topic = 'wordProblems' as const;
  const w = wpTemplate(rng, level);
  const ans = calc(w.a, w.b, w.op)!;
  const expr = (op: Op) => `${fmt(w.a)} ${op} ${fmt(w.b)}`;
  const others = (['+', '−', '×', ':'] as Op[]).filter((o) => o !== w.op && calc(w.a, w.b, o) !== null && !(o === '×' && w.a * w.b > 99999));
  const { choices, answer } = makeChoices(rng, mathChoice(expr(w.op)), others.map((o) => mathChoice(expr(o))));
  return {
    topic, level, sig: `wp-${w.op}-${w.a}-${w.b}`,
    prompt: w.text,
    parts: [
      { kind: 'choice', prompt: 'איזה תרגיל פותר את הבעיה?', choices, answer, hint: 'מה קורה בסיפור? מוסיפים, לוקחים, יש קבוצות שוות, או מחלקים שווה בשווה?' },
      num(ans, `פתרי את התרגיל ${expr(w.op)}.`, { prompt: 'מה התשובה?', suffix: w.unit }),
    ],
    explanation: `${w.why} התרגיל: ${m(`${expr(w.op)} = ${fmt(ans)}`)}. התשובה: ${fmt(ans)} ${w.unit}.`,
  };
}

/* ============================================================ helpers for tests */
export const _internal = { calc, fromDigits };
