import { CONFIG } from '../config';
import type { Level, Question } from '../types';
import type { Rng } from '../rng';
import { makeChoices, textChoice, orderedChoices } from '../format';
import { angleFigure, polygonFigure, polygonPoints, nonPolygonFigure, triangleFigure, minAngleDeg } from '../figures';

/* ============================================================ זוויות */

export type AngleType = 'acute' | 'right' | 'obtuse' | 'straight';
export const ANGLE_NAMES: Record<AngleType, string> = { acute: 'חדה', right: 'ישרה', obtuse: 'קהה', straight: 'שטוחה' };

export function angleTypes(): AngleType[] {
  return CONFIG.includeStraightAngle ? ['acute', 'right', 'obtuse', 'straight'] : ['acute', 'right', 'obtuse'];
}

/** degrees kept far from 90° so the type is clear to the eye */
export function angleDeg(rng: Rng, t: AngleType): number {
  if (t === 'acute') return rng.int(6, 13) * 5; // 30..65
  if (t === 'right') return 90;
  if (t === 'obtuse') return rng.int(23, 31) * 5; // 115..155
  return 180;
}
export function classifyAngle(deg: number): AngleType {
  if (deg === 90) return 'right';
  if (deg === 180) return 'straight';
  return deg < 90 ? 'acute' : 'obtuse';
}

const angleHint = 'דמייני פינה של דף בקודקוד. האם הזווית צרה מהפינה, שווה לה בדיוק, או רחבה ממנה?';
const angleRule = 'זווית חדה קטנה מזווית ישרה (פינה של דף), זווית ישרה שווה לה בדיוק, וזווית קהה גדולה ממנה' + (CONFIG.includeStraightAngle ? '. זווית שטוחה נראית כמו קו ישר.' : '.');

function nameChoices(correct: AngleType) {
  const types = angleTypes();
  return orderedChoices(types.map((t) => textChoice(ANGLE_NAMES[t])), types.indexOf(correct));
}

export function angles(rng: Rng, level: Level): Question {
  const topic = 'angles' as const;
  const types = angleTypes();
  if (level === 1) {
    const t = rng.pick(types);
    const deg = angleDeg(rng, t);
    const rot = rng.int(0, 71) * 5;
    const { choices, answer } = nameChoices(t);
    return {
      topic, level, sig: `an-name-${t}-${deg}-${rot}`,
      prompt: 'איזו זווית מסומנת בציור?',
      figure: angleFigure({ deg, rot }),
      parts: [{ kind: 'choice', choices, answer, fixedOrder: true, hint: angleHint }],
      explanation: `${angleRule} הזווית בציור היא <b>${ANGLE_NAMES[t]}</b>.`,
    };
  }
  if (level === 2) {
    const t = rng.pick(types);
    const figs = types.map((tt) => {
      const deg = angleDeg(rng, tt);
      return { html: angleFigure({ deg, rot: rng.int(0, 71) * 5, size: 'small' }), text: `${tt}-${deg}`, isFigure: true, tt };
    });
    const correct = figs.find((f) => f.tt === t)!;
    const { choices, answer } = makeChoices(rng, correct, figs.filter((f) => f !== correct));
    return {
      topic, level, sig: `an-pick-${t}-${figs.map((f) => f.text).join('')}`,
      prompt: `בחרי את הזווית ה<b>${ANGLE_NAMES[t]}</b>.`,
      parts: [{ kind: 'choice', choices, answer, hint: angleHint }],
      explanation: `${angleRule} לכן בחרנו את הזווית ה${ANGLE_NAMES[t]}.`,
    };
  }
  // level 3: angle marked inside a triangle, unusual orientation
  const t = rng.pick(types.filter((x) => x !== 'straight'));
  const deg = angleDeg(rng, t);
  const rot = rng.pick([100, 135, 180, 200, 225, 250, 290, 315]);
  const { choices, answer } = nameChoices(t);
  return {
    topic, level, sig: `an-tri-${t}-${deg}-${rot}`,
    prompt: 'איזו זווית מסומנת במשולש? (הזווית עם הסימון)',
    figure: angleFigure({ deg, rot, closed: true, len1: rng.int(80, 120), len2: rng.int(80, 120) }),
    parts: [{ kind: 'choice', choices, answer, fixedOrder: true, hint: 'הסתכלי רק על הזווית המסומנת. ' + angleHint }],
    explanation: `${angleRule} הזווית המסומנת היא <b>${ANGLE_NAMES[t]}</b>. סיבוב הצורה לא משנה את סוג הזווית.`,
  };
}

/* ============================================================ מצולעים */

export function polygonSides(): number[] {
  return Object.keys(CONFIG.polygonNames).map(Number).sort((a, b) => a - b);
}
const pname = (n: number) => CONFIG.polygonNames[n];

export function polygons(rng: Rng, level: Level): Question {
  const topic = 'polygons' as const;
  const sides = polygonSides();
  const countHint = 'סמני צלע אחת שממנה התחלת, וספרי את הצלעות סביב הצורה עד שתחזרי אליה.';
  if (level === 1) {
    const n = rng.pick(sides);
    const pts = polygonPoints(rng, n, rng.bool(), rng.int(55, 100));
    const askVert = rng.bool(0.3);
    return {
      topic, level, sig: `pg-count-${n}-${askVert}-${Math.round(pts[0].x)}`,
      prompt: askVert ? 'כמה קודקודים יש למצולע?' : 'כמה צלעות יש למצולע?',
      figure: polygonFigure(pts),
      parts: [{ kind: 'number', answer: String(n), hint: askVert ? 'קודקוד הוא נקודה שבה נפגשות שתי צלעות. ספרי את הנקודות.' : countHint }],
      explanation: `למצולע יש ${n} צלעות ו־${n} קודקודים. זה ${pname(n)}.`,
    };
  }
  if (level === 2) {
    const n = rng.pick(sides);
    const pts = polygonPoints(rng, n, true, rng.int(60, 100));
    const { choices, answer } = orderedChoices(sides.map((s) => textChoice(pname(s))), sides.indexOf(n));
    return {
      topic, level, sig: `pg-name-${n}-${Math.round(pts[0].x)}`,
      prompt: 'מה שם המצולע?',
      figure: polygonFigure(pts),
      parts: [{ kind: 'choice', choices, answer, fixedOrder: true, hint: countHint + ' השם תלוי במספר הצלעות.' }],
      explanation: `יש ${n} צלעות, ולכן זה <b>${pname(n)}</b>. ${sides.map((s) => `${s} – ${pname(s)}`).join(', ')}.`,
    };
  }
  if (rng.bool(0.35)) {
    const kind = rng.pick(['circle', 'curved', 'open'] as const);
    const polys = rng.sample(sides, 3).map((n) => ({ html: polygonFigure(polygonPoints(rng, n, true, rng.int(55, 95)), { size: 'small' }), text: `poly-${n}`, isFigure: true }));
    const { choices, answer } = makeChoices(rng, { html: nonPolygonFigure(kind, rng), text: `non-${kind}`, isFigure: true }, polys);
    const why = { circle: 'לעיגול אין צלעות ישרות', curved: 'לצורה הזו יש צלע מעוגלת', open: 'הצורה הזו לא סגורה' }[kind];
    return {
      topic, level, sig: `pg-not-${kind}-${polys.map((p) => p.text).join('')}`,
      prompt: 'איזו צורה <b>אינה</b> מצולע?',
      parts: [{ kind: 'choice', choices, answer, hint: 'מצולע הוא צורה סגורה שכל הצלעות שלה ישרות. חפשי צורה שלא עומדת בזה.' }],
      explanation: `מצולע הוא צורה סגורה שכל הצלעות שלה קווים ישרים. ${why}, ולכן היא אינה מצולע.`,
    };
  }
  const chosen = rng.sample(sides, Math.min(4, sides.length));
  const target = rng.pick(chosen);
  const figs = chosen.map((n) => ({ html: polygonFigure(polygonPoints(rng, n, true, rng.int(50, 100)), { size: 'small' }), text: `poly-${n}`, isFigure: true, n }));
  const correct = figs.find((f) => f.n === target)!;
  const { choices, answer } = makeChoices(rng, correct, figs.filter((f) => f !== correct));
  return {
    topic, level, sig: `pg-pick-${target}-${chosen.join('')}`,
    prompt: `בחרי את ה<b>${pname(target)}</b>.`,
    parts: [{ kind: 'choice', choices, answer, hint: `ל${pname(target)} יש ${target} צלעות. ספרי את הצלעות בכל צורה.` }],
    explanation: `ל${pname(target)} יש ${target} צלעות. רק בצורה שבחרנו יש בדיוק ${target} צלעות.`,
  };
}

/* ============================================================ משולשים */

export type TriType = 'equilateral' | 'isosceles' | 'scalene';
export const TRI_NAMES: Record<TriType, string> = { equilateral: 'שווה־צלעות', isosceles: 'שווה־שוקיים', scalene: 'שונה־צלעות' };

export function classifyTriangle(s: number[]): TriType {
  const [a, b, c] = s;
  if (a === b && b === c) return 'equilateral';
  if (a === b || b === c || a === c) return 'isosceles';
  return 'scalene';
}

/** Valid, well-shaped triangles (no angle under 25°) with whole-cm sides */
export function makeTriangle(rng: Rng, t: TriType): [number, number, number] {
  for (let i = 0; i < 500; i++) {
    let s: number[];
    if (t === 'equilateral') { const x = rng.int(3, 7); s = [x, x, x]; }
    else if (t === 'isosceles') { const x = rng.int(3, 7); let y = rng.int(2, 9); if (y === x) continue; s = [x, x, y]; }
    else { s = rng.sample([2, 3, 4, 5, 6, 7, 8], 3); }
    const [a, b, c] = s;
    if (a + b <= c || a + c <= b || b + c <= a) continue;
    if (minAngleDeg(a, b, c) < 25) continue;
    if (Math.max(...s) > 8) continue;
    const sh = rng.shuffle(s) as [number, number, number];
    return sh;
  }
  throw new Error('no triangle');
}

/** In single-choice questions an equilateral triangle never gets "isosceles" as an option (it would also be true). */
export function triangleOptions(t: TriType): TriType[] {
  if (t === 'equilateral' && CONFIG.equilateralCountsAsIsosceles) return ['equilateral', 'scalene'];
  return ['equilateral', 'isosceles', 'scalene'];
}

const triRule = 'שלוש צלעות שוות – שווה־צלעות. שתי צלעות שוות – שווה־שוקיים. כל הצלעות באורך שונה – שונה־צלעות.';

export function triangles(rng: Rng, level: Level): Question {
  const topic = 'triangles' as const;
  const types: TriType[] = ['equilateral', 'isosceles', 'scalene'];
  if (level === 1 || level === 2) {
    const t = rng.pick(types);
    const s = makeTriangle(rng, t);
    const opts = triangleOptions(t);
    const { choices, answer } = orderedChoices(opts.map((o) => textChoice(TRI_NAMES[o])), opts.indexOf(t));
    const lens = `${s[2]}, ${s[0]} ו־${s[1]}`;
    const eqNote = t === 'equilateral' && CONFIG.equilateralCountsAsIsosceles ? ' (משולש שווה־צלעות הוא גם שווה־שוקיים, אבל השם המדויק שלו הוא שווה־צלעות.)' : '';
    if (level === 1) {
      return {
        topic, level, sig: `tr-fig-${t}-${s.join('')}`,
        prompt: 'איזה משולש זה? (אורכי הצלעות בס״מ. קו קטן על צלע מסמן צלעות שוות.)',
        figure: triangleFigure({ sides: s, rot: rng.int(0, 71) * 5, lengths: true, ticks: true }),
        parts: [{ kind: 'choice', choices, answer, fixedOrder: true, hint: 'השווי את שלושת המספרים. כמה צלעות שוות יש?' }],
        explanation: `אורכי הצלעות: ${lens} ס״מ. ${triRule} לכן זה משולש <b>${TRI_NAMES[t]}</b>.${eqNote}`,
      };
    }
    return {
      topic, level, sig: `tr-txt-${t}-${s.join('')}`,
      prompt: `למשולש יש צלעות באורך <b>${s[2]} ס״מ, ${s[0]} ס״מ ו־${s[1]} ס״מ</b>. איזה משולש הוא?`,
      parts: [{ kind: 'choice', choices, answer, fixedOrder: true, hint: 'חפשי מספרים שחוזרים על עצמם. כמה צלעות באותו אורך?' }],
      explanation: `${triRule} כאן: ${lens} ס״מ – ולכן זה משולש <b>${TRI_NAMES[t]}</b>.${eqNote}`,
    };
  }
  // level 3: pick the drawing. For "isosceles" never show an equilateral triangle among the options.
  const t = rng.pick(types);
  const optTypes: TriType[] = t === 'isosceles' && CONFIG.equilateralCountsAsIsosceles ? ['isosceles', 'scalene', 'scalene'] : ['equilateral', 'isosceles', 'scalene'];
  const used = new Set<string>();
  const figs = optTypes.map((tt) => {
    let s = makeTriangle(rng, tt);
    while (used.has([...s].sort().join())) s = makeTriangle(rng, tt);
    used.add([...s].sort().join());
    return { html: triangleFigure({ sides: s, rot: rng.int(0, 71) * 5, lengths: true, ticks: true, size: 'small' }), text: `${tt}-${[...s].sort().join('')}`, isFigure: true, tt };
  });
  const correct = figs.find((f) => f.tt === t)!;
  const { choices, answer } = makeChoices(rng, correct, figs.filter((f) => f !== correct));
  return {
    topic, level, sig: `tr-pick-${t}-${figs.map((f) => f.text).join('')}`,
    prompt: `בחרי את המשולש ה<b>${TRI_NAMES[t]}</b>. (האורכים בס״מ)`,
    parts: [{ kind: 'choice', choices, answer, hint: 'בכל משולש השווי את שלושת האורכים. כמה מהם שווים?' }],
    explanation: `${triRule} רק במשולש שבחרנו ${t === 'equilateral' ? 'כל שלוש הצלעות שוות' : t === 'isosceles' ? 'בדיוק שתי צלעות שוות' : 'כל הצלעות באורך שונה'}.`,
  };
}
