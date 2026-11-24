/**
 * כרטיסי "איך עושים את זה?" – לכל נושא: הסבר קצר, דוגמה פתורה (עם איור מסומן כשצריך)
 * ושאלת "עכשיו תורך" עם נתונים אחרים, שבודקת בדיוק את אותה מיומנות.
 */
import type { Question, TopicId, Part } from './types';
import { numbersToChoices } from './choices';
import { m, X, D, MINUS, BLANK, mathChoice, textChoice } from './format';
import { numberLine, sequenceFigure, groupsFigure, angleFigure, polygonFigure, triangleFigure } from './figures';
import { drawers as cargoBays, bowlGroups } from './club';
import { qFields, qPlaceChoice, qValueChoice } from './generators/place';
import { fmt, placeName, digitsOf } from './format';
import { CONFIG } from './config';
import { ANGLE_NAMES, angleTypes, TRI_NAMES, triangleOptions, polygonSides } from './generators/geometry';

export interface Skill {
  title: string;
  /** 1–3 short sentences: what to look for / what to do first */
  explain: string;
  /** worked example */
  example: { task: string; figure?: string; steps: string[]; answer: string };
  /** "עכשיו תורך" – same skill, other numbers */
  tryIt: Question;
}
export interface Lesson { topic: TopicId; skills: Skill[] }

const num = (answer: number, hint: string, extra: Partial<Part> = {}): Part => ({ kind: 'number', answer: String(answer), hint, ...extra });
const tq = (topic: TopicId, sig: string, prompt: string, parts: Part[], explanation: string, extra: Partial<Question> = {}): Question =>
  ({ topic, level: 1, sig: 'lesson-' + sig, prompt, parts, explanation, ...extra });

/** generated question reused as a lesson "עכשיו תורך" (own signature, optional overrides for part 0) */
function lessonQ(q: Question, sig: string, partOver: Partial<Part> & { hintFigure?: string } = {}): Question {
  const { hintFigure, ...po } = partOver;
  return { ...q, sig: 'lesson-' + sig, hintFigure: hintFigure ?? q.hintFigure, parts: q.parts.map((p, i) => (i === 0 ? { ...p, ...po } : p)) };
}

/** notebook rows, filled: [7] אלפים / [6] מאות / … */
function notebookRows(n: number): string {
  const ds = digitsOf(n);
  return `<div class="nb-rows" aria-label="פירוק במחברת">${[3, 2, 1, 0].map((p) => `<div class="frow"><span class="nb-box">${ds[p] ?? 0}</span><span class="flabel">${placeName(p)}</span><span class="nb-val">← ${m(fmt((ds[p] ?? 0) * 10 ** p))}</span></div>`).join('')}</div>`;
}

/** fixed (not shuffled) choice order for lesson questions */
function fixedChoices(correct: { html: string; text: string; isFigure?: boolean }, others: { html: string; text: string; isFigure?: boolean }[], correctPos: number) {
  const list = others.slice();
  list.splice(correctPos, 0, correct);
  const ids = 'abcdefgh';
  return { choices: list.map((c, i) => ({ id: ids[i], ...c })), answer: ids[correctPos] };
}

/* polygon/irregular points computed once (deterministic) */
function regularish(n: number, r: number, rotDeg: number, wobble: number[]): { x: number; y: number }[] {
  return Array.from({ length: n }, (_, i) => {
    const a = ((rotDeg + (i * 360) / n) * Math.PI) / 180;
    const rr = r * (wobble[i % wobble.length] ?? 1);
    return { x: Math.cos(a) * rr, y: Math.sin(a) * rr };
  });
}

export function buildLessons(): Record<TopicId, Lesson> {
  const types = angleTypes();
  const sides = polygonSides();
  const pn = CONFIG.polygonNames;

  const L: Record<TopicId, Lesson> = {
    /* ------------------------------------------------ מבנה עשרוני */
    placeValue: {
      topic: 'placeValue',
      skills: [
        {
          title: 'פירוק לאלפים, מאות, עשרות ויחידות',
          explain: 'כל ספרה נכנסת ל{{drawer}} שלה ב{{chest}}: אלפים, מאות, עשרות או יחידות. בפירוק כותבים בכל שורה את הספרה של אותה מגירה, ואם המגירה ריקה – כותבים 0.',
          example: {
            task: 'מפרקים את המספר 7639.',
            figure: cargoBays(7639, { interactive: true, highlight: 1, id: 'pv-ex', prompt: 'לוחצים על {{drawerOf}} העשרות (מסומנת בחץ) – {{opener}} תפתח אותה' }) + notebookRows(7639),
            steps: [
              'מעבירים כל ספרה לשורה שלה: 7 אלפים, 6 מאות, 3 עשרות ו־9 יחידות.',
              `כמה שווה כל {{drawer}}? {{opener}} פותחת את {{drawerOf}} העשרות: 3 חבילות של 10, ${m('10 + 10 + 10 = 30')}.`,
              `באותו אופן: 7 אלפים הם ${m('7,000')}, ו־6 מאות הן ${m('600')}.`,
            ],
            answer: `לפי ערכים: ${m('7,639 = 7,000 + 600 + 30 + 9')}`,
          },
          tryIt: lessonQ(qFields('placeValue', 1, 7052), 'pv1'),
        },
        {
          title: 'הרכבת מספר',
          explain: 'כותבים ספרה אחת לכל {{drawer}}, לפי הסדר: אלפים, מאות, עשרות, יחידות. אם {{drawer}} ריקה – כותבים בה 0.',
          example: {
            task: 'לכתוב את המספר: 2 אלפים, 4 עשרות ו־9 יחידות',
            figure: cargoBays(2049, { highlight: 2 }),
            steps: ['אלפים: 2. מאות: אין – {{theDrawer}} ריקה, כותבים 0 (מסומנת בחץ).', 'עשרות: 4. יחידות: 9.'],
            answer: m('2,049'),
          },
          tryIt: tq('placeValue', 'pv2', 'כותבים את המספר: <b>5 אלפים, 3 מאות ו־8 יחידות</b>.', [num(5308, 'אין עשרות במספר. מה כותבים במקום העשרות?')],
            `אלפים 5, מאות 3, עשרות – אין, לכן 0, יחידות 8. המספר: ${m('5,308')}.`, { hintFigure: cargoBays(5308, { highlight: 1 }) }),
        },
      ],
    },

    /* ------------------------------------------------ ערך הספרה */
    digitValue: {
      topic: 'digitValue',
      skills: [
        {
          title: 'באיזה מקום נמצאת הספרה?',
          explain: 'המקום הוא השם של {{theDrawer}}: יחידות, עשרות, מאות או אלפים. מתחילים מימין – הספרה הימנית היא היחידות.',
          example: {
            task: 'באיזה מקום נמצאת הספרה 3 במספר 7639?',
            figure: cargoBays(7639, { highlight: 1 }),
            steps: ['מתחילים מימין: 9 ביחידות, 3 בעשרות, 6 במאות, 7 באלפים.', 'הספרה 3 נמצאת ב{{drawerOf}} העשרות (מסומנת בחץ).'],
            answer: 'התשובה: <b>עשרות</b> – זה המקום.',
          },
          tryIt: lessonQ(qPlaceChoice('digitValue', 1, 2514, 2), 'dv1'),
        },
        {
          title: 'מה הערך של הספרה?',
          explain: 'הערך הוא כמה הספרה שווה במקום שלה. קודם מוצאים את המקום, ואחר כך סופרים את החבילות שב{{drawer}}.',
          example: {
            task: 'מה הערך של הספרה 3 במספר 7639?',
            figure: cargoBays(7639, { interactive: true, highlight: 1, id: 'dv-ex', prompt: 'לוחצים על {{drawerOf}} העשרות' }),
            steps: ['הספרה 3 נמצאת במקום העשרות.', `{{opener}} פותחת את {{drawerOf}} העשרות: יש בה 3 חבילות של 10, ${m('3 × 10 = 30')}.`],
            answer: 'המקום הוא <b>עשרות</b>, והערך הוא <b>30</b>.',
          },
          tryIt: lessonQ(qValueChoice('digitValue', 1, 473, 1), 'dv2', {
            hint: 'מתחילים מימין. הספרה הראשונה היא ספרת היחידות. באיזה מקום נמצאת הספרה 7?',
            hintFigure: cargoBays(473, { highlight: 1, open: 1 }),
          }),
        },
      ],
    },

    /* ------------------------------------------------ קודם ועוקב */
    prevNext: {
      topic: 'prevNext',
      skills: [
        {
          title: 'המספר העוקב',
          explain: 'המספר העוקב בא מיד אחרי המספר – הוא גדול ב־1. מוסיפים 1. אם ביחידות יש 9, עוברים לעשרת הבאה.',
          example: {
            task: 'מה המספר העוקב של 299?',
            steps: [`מוסיפים 1: ${m('299 + 1')}.`, '9 יחידות ועוד 1 הן עשרת שלמה, ו־9 עשרות ועוד 1 הן מאה שלמה.'],
            answer: m('299 + 1 = 300'),
          },
          tryIt: tq('prevNext', 'pn1', 'מה המספר <b>העוקב</b> של <b>4,099</b>?', [num(4100, 'מוסיפים 1. מה קורה כשיש 9 ביחידות ו־9 בעשרות?')],
            `העוקב גדול ב־1: ${m('4,099 + 1 = 4,100')}. היחידות והעשרות נהיות 0, והמאות גדלות ב־1.`),
        },
        {
          title: 'המספר הקודם',
          explain: 'המספר הקודם בא ממש לפני המספר – הוא קטן ב־1. מורידים 1. אם ביחידות יש 0, הספרה הופכת ל־9.',
          example: {
            task: 'מה המספר הקודם של 600?',
            steps: [`מורידים 1: ${m(`600 ${MINUS} 1`)}.`, 'ממש לפני 600 בא 599 (סופרים אחורה: 601, 600, 599).'],
            answer: m(`600 ${MINUS} 1 = 599`),
          },
          tryIt: tq('prevNext', 'pn2', 'מה המספר <b>הקודם</b> של <b>3,000</b>?', [num(2999, 'מורידים 1 מ־3,000. איזה מספר בא ממש לפני 3,000?')],
            `הקודם קטן ב־1: ${m(`3,000 ${MINUS} 1 = 2,999`)}.`),
        },
      ],
    },

    /* ------------------------------------------------ זוגי ואי־זוגי */
    evenOdd: {
      topic: 'evenOdd',
      skills: [
        {
          title: 'זוגי או אי־זוגי?',
          explain: 'מסתכלים רק על ספרת היחידות – הספרה הימנית. אם היא 0, 2, 4, 6 או 8 – המספר זוגי. אם היא 1, 3, 5, 7 או 9 – אי־זוגי.',
          example: {
            task: 'האם 3,476 זוגי או אי־זוגי?',
            figure: cargoBays(3476, { highlight: 0 }),
            steps: ['ספרת היחידות היא 6 (מסומנת בחץ).', '6 הוא מספר זוגי.'],
            answer: 'לכן 3,476 הוא מספר זוגי.',
          },
          tryIt: (() => {
            const { choices, answer } = fixedChoices(textChoice('אי־זוגי'), [textChoice('זוגי')], 1);
            return tq('evenOdd', 'eo1', 'האם המספר <b>2,583</b> זוגי או אי־זוגי?', [{ kind: 'choice', choices, answer, hint: 'מסתכלים רק על ספרת היחידות – הספרה הימנית ביותר. מה היא?' }],
              'ספרת היחידות היא 3. 3 אי־זוגי, ולכן 2,583 אי־זוגי.');
          })(),
        },
      ],
    },

    /* ------------------------------------------------ כפל וחילוק */
    multDiv: {
      topic: 'multDiv',
      skills: [
        {
          title: 'כפל',
          explain: `כפל הוא חיבור של אותו מספר כמה פעמים. ${m(`4 ${X} 6`)} פירושו 4 פעמים 6. אפשר להיעזר בתרגיל שכבר יודעים.`,
          example: {
            task: m(`4 ${X} 6 = ${BLANK}`),
            figure: bowlGroups(4, 6, { numbered: true }),
            steps: [`יש 4 {{bowls}}, ו{{sharer}} שם 6 {{items}} בכל {{bowl}}: ${m('6 + 6 + 6 + 6')}.`, `או: ${m(`2 ${X} 6 = 12`)}, ופעמיים 12 זה 24.`],
            answer: m(`4 ${X} 6 = 24`),
          },
          tryIt: tq('multDiv', 'md1', 'פותרים את התרגיל.', [num(21, 'מחברים 7 שלוש פעמים: 7 + 7 + 7.')],
            `${m(`3 ${X} 7`)} = 3 פעמים 7: ${m('7 + 7 + 7 = 21')}.`, { math: `3 ${X} 7 = ${BLANK}` }),
        },
        {
          title: 'חילוק',
          explain: `חילוק הוא הפעולה ההפוכה לכפל. כדי לפתור ${m(`24 ${D} 6`)} שואלים: 6 כפול כמה שווה 24?`,
          example: {
            task: m(`24 ${D} 6 = ${BLANK}`),
            figure: bowlGroups(6, 4, { numbered: true }),
            steps: [`{{sharer}} מחלק 24 {{items}} ל־6 {{bowls}} שווה בשווה. שואלים: ${m(`6 ${X} ${BLANK} = 24`)}.`, `${m(`6 ${X} 4 = 24`)} – בכל {{bowl}} 4 {{items}}.`],
            answer: m(`24 ${D} 6 = 4`),
          },
          tryIt: tq('multDiv', 'md2', 'פותרים את תרגיל החילוק.', [num(6, 'חושבים: 7 כפול כמה שווה 42?')],
            `${m(`7 ${X} 6 = 42`)}, לכן ${m(`42 ${D} 7 = 6`)}.`, { math: `42 ${D} 7 = ${BLANK}` }),
        },
      ],
    },

    /* ------------------------------------------------ מספר חסר */
    missing: {
      topic: 'missing',
      skills: [
        {
          title: 'מספר חסר בכפל',
          explain: 'כשחסר מספר בתרגיל כפל, שואלים: כמה פעמים? אפשר לספור בקפיצות או לחלק.',
          example: {
            task: m(`${BLANK} ${X} 8 = 56`),
            steps: ['שואלים: כמה פעמים 8 זה 56?', `${m(`7 ${X} 8 = 56`)} (או: ${m(`56 ${D} 8 = 7`)}).`],
            answer: 'המספר החסר הוא 7.',
          },
          tryIt: tq('missing', 'ms1', 'איזה מספר חסר?', [num(9, 'סופרים בקפיצות של 6 עד 54: 6, 12, 18... כמה קפיצות?')],
            `${m(`54 ${D} 6 = 9`)}. בדיקה: ${m(`6 ${X} 9 = 54`)}.`, { math: `6 ${X} ${BLANK} = 54` }),
        },
        {
          title: 'מספר חסר בחילוק',
          explain: 'חילוק הפוך לכפל. הופכים את תרגיל החילוק לתרגיל כפל ומוצאים את המספר החסר.',
          example: {
            task: m(`36 ${D} ${BLANK} = 4`),
            steps: [`הופכים לכפל: ${m(`${BLANK} ${X} 4 = 36`)}.`, `${m(`9 ${X} 4 = 36`)}.`],
            answer: `המספר החסר הוא 9: ${m(`36 ${D} 9 = 4`)}.`,
          },
          tryIt: tq('missing', 'ms2', 'איזה מספר חסר?', [num(40, 'המספר החסר הוא המספר שמחלקים. כמה זה 5 × 8?')],
            `${m(`5 ${X} 8 = 40`)}, לכן ${m(`40 ${D} 5 = 8`)}.`, { math: `${BLANK} ${D} 5 = 8` }),
        },
      ],
    },

    /* ------------------------------------------------ ישר המספרים */
    numberLine: {
      topic: 'numberLine',
      skills: [
        {
          title: 'מספר חסר על ישר המספרים',
          explain: 'קודם מוצאים בכמה המספרים גדלים מכל שנתה לשנתה – זה גודל הקפיצה. אחר כך קופצים עד סימן השאלה.',
          example: {
            task: 'איזה מספר מתאים לסימן השאלה?',
            figure: numberLine({ start: 200, step: 50, count: 6, labeled: [0, 2], unknown: 3, jumps: true }),
            steps: [`בין 200 ל־300 יש 2 קפיצות (הקשתות). ${m(`100 ${D} 2 = 50`)} – כל קפיצה היא 50.`, `סימן השאלה נמצא 3 קפיצות אחרי 200: ${m('200 + 50 + 50 + 50')}.`],
            answer: 'התשובה: 350.',
          },
          tryIt: tq('numberLine', 'nl1', 'איזה מספר מתאים לשנתה עם סימן השאלה?', [num(80, 'בין 30 ל־50 יש 2 קפיצות. כמה כל קפיצה? ממשיכים לקפוץ עד סימן השאלה.')],
            `${m(`50 ${MINUS} 30 = 20`)}, ובשתי קפיצות – כל קפיצה 10. סימן השאלה 5 קפיצות אחרי 30: ${m('30 + 50 = 80')}.`,
            { figure: numberLine({ start: 30, step: 10, count: 7, labeled: [0, 2], unknown: 5 }) }),
        },
      ],
    },

    /* ------------------------------------------------ סדרות */
    sequences: {
      topic: 'sequences',
      skills: [
        {
          title: 'השלמת סדרה',
          explain: 'בודקים בכמה כל מספר גדל או קטן לעומת המספר שלפניו. ממשיכים באותו כלל עד המקום החסר.',
          example: {
            task: 'משלימים את הסדרה היורדת:',
            figure: sequenceFigure([75, 70, 65, 60, 55], 3, { steps: true, showAnswer: true }),
            steps: [`מ־75 ל־70 קטן ב־5, ומ־70 ל־65 גם קטן ב־5 (מסומן בין המספרים).`, `${m(`65 ${MINUS} 5 = 60`)}. בדיקה: ${m(`60 ${MINUS} 5 = 55`)} ✓`],
            answer: 'המספר החסר: 60.',
          },
          tryIt: tq('sequences', 'sq1', 'משלימים את המספר החסר בסדרה העולה.', [num(280, 'בכמה גדל כל מספר? בודקים מ־240 ל־260.')],
            `בכל צעד המספר גדל ב־20. ${m('260 + 20 = 280')}, ובדיקה: ${m('280 + 20 = 300')}.`,
            { figure: sequenceFigure([240, 260, 280, 300, 320], 2) }),
        },
      ],
    },

    /* ------------------------------------------------ משמעות הכפל */
    multMeaning: {
      topic: 'multMeaning',
      skills: [
        {
          title: 'קבוצות שוות ותרגיל כפל',
          explain: 'בציור של כפל יש קבוצות שוות. סופרים כמה קבוצות יש, וכמה יש בכל קבוצה. התרגיל: מספר הקבוצות × כמה בכל קבוצה.',
          example: {
            task: 'איזה תרגיל מתאים לציור?',
            figure: groupsFigure([4, 4, 4], { numbered: true, perLabel: true, item: 'treat' }),
            steps: ['סופרים {{baskets}}: 3 קבוצות (המספר מעל כל {{basket}}).', 'בכל {{basket}} 4 {{items}} (המספר מתחת לכל {{basket}}).'],
            answer: `התרגיל: ${m(`3 ${X} 4 = 12`)}.`,
          },
          tryIt: (() => {
            const { choices, answer } = fixedChoices(mathChoice(`5 ${X} 2`), [mathChoice('5 + 2'), mathChoice(`2 ${X} 2`), mathChoice(`5 ${X} 5`)], 2);
            return tq('multMeaning', 'mm1', 'איזה תרגיל מתאים לציור?', [{ kind: 'choice', choices, answer, hint: 'כמה {{baskets}} (קבוצות) יש? וכמה {{items}} בכל {{basket}}?' }],
              `יש 5 קבוצות, ובכל אחת 2 {{items}}. התרגיל: ${m(`5 ${X} 2 = 10`)}.`,
              { figure: groupsFigure([2, 2, 2, 2, 2], { item: 'treat' }) });
          })(),
        },
      ],
    },

    /* ------------------------------------------------ בעיות מילוליות */
    wordProblems: {
      topic: 'wordProblems',
      skills: [
        {
          title: 'לבחור תרגיל ולפתור',
          explain: 'קוראים ושואלים: מה יודעים ומה צריך למצוא? אחר כך בוחרים פעולה: קבוצות שוות ← כפל, מחלקים שווה בשווה ← חילוק, מוסיפים ← חיבור, לוקחים ← חיסור.',
          example: {
            task: 'בכל שקית יש 6 תפוחים. יש 4 שקיות. כמה תפוחים יש בסך הכל?',
            steps: ['יש 4 קבוצות שוות (שקיות), ובכל אחת 6 ← כפל.', `התרגיל: ${m(`4 ${X} 6`)}.`],
            answer: `${m(`4 ${X} 6 = 24`)} – יש 24 תפוחים.`,
          },
          tryIt: (() => {
            const { choices, answer } = fixedChoices(mathChoice(`28 ${D} 4`), [mathChoice(`28 ${MINUS} 4`), mathChoice(`28 ${X} 4`), mathChoice('28 + 4')], 0);
            return tq('wordProblems', 'wp1', '28 עוגיות חולקו שווה בשווה ל־4 ילדים. כמה עוגיות קיבל כל ילד?', [
              { kind: 'choice', prompt: 'איזה תרגיל פותר את הבעיה?', choices, answer, hint: 'המילים "שווה בשווה" רומזות על איזו פעולה?' },
              num(7, 'חושבים: 4 כפול כמה שווה 28?', { prompt: 'מה התשובה?', suffix: 'עוגיות' }),
            ], `מחלקים שווה בשווה ← חילוק: ${m(`28 ${D} 4 = 7`)}. כל ילד קיבל 7 עוגיות.`);
          })(),
        },
      ],
    },

    /* ------------------------------------------------ זוויות */
    angles: {
      topic: 'angles',
      skills: [
        {
          title: 'חדה, ישרה או קהה?',
          explain: 'משווים את הזווית לפינה של דף, שהיא זווית ישרה. אם הזווית צרה מהפינה – היא חדה, אם היא בדיוק כמו הפינה – ישרה, ואם היא רחבה מהפינה – קהה' + (CONFIG.includeStraightAngle ? ', ואם היא נראית כמו קו ישר – שטוחה.' : '.'),
          example: {
            task: 'איזו זווית מסומנת בקשתות?',
            figure: angleFigure({ deg: 130, rot: 20, guide: true }),
            steps: ['שמים פינה של דף על הקודקוד – הקו המקווקו מראה את הפינה (זווית ישרה).', 'הקשתות מסמנות את הזווית. היא פתוחה יותר מהפינה המקווקוות.'],
            answer: 'לכן זו זווית <b>קהה</b>.',
          },
          tryIt: (() => {
            const order = types;
            const correct = 'acute';
            const { choices, answer } = fixedChoices(textChoice(ANGLE_NAMES[correct]), order.filter((t) => t !== correct).map((t) => textChoice(ANGLE_NAMES[t])), order.indexOf(correct));
            return tq('angles', 'an1', 'איזו זווית מסומנת בציור?', [{ kind: 'choice', choices, answer, hint: 'מדמיינים פינה של דף בקודקוד. האם הזווית צרה מהפינה, שווה לה, או רחבה ממנה?' }],
              'הזווית צרה מפינה של דף, ולכן היא <b>חדה</b>. גם כשהזווית מסובבת, סוג הזווית לא משתנה.',
              { figure: angleFigure({ deg: 45, rot: 200 }) });
          })(),
        },
      ],
    },

    /* ------------------------------------------------ מצולעים */
    polygons: {
      topic: 'polygons',
      skills: [
        {
          title: 'שם המצולע לפי מספר הצלעות',
          explain: `מצולע הוא צורה סגורה שכל הצלעות שלה ישרות. סופרים צלעות, ולפי המספר יודעים את השם: ${sides.map((s) => `${s} – ${pn[s]}`).join(', ')}.`,
          example: {
            task: 'מה שם המצולע?',
            figure: polygonFigure(regularish(5, 85, -80, [1, 0.85, 0.95, 0.8, 1]), { numberSides: true }),
            steps: ['סופרים את הצלעות סביב הצורה ומסמנים כל צלע שספרנו (המספרים בעיגולים).', 'יש 5 צלעות.'],
            answer: `לכן זה <b>${pn[5] ?? 'מחומש'}</b>.`,
          },
          tryIt: (() => {
            const opts = sides.filter((s) => s !== 6).slice(0, 3);
            const all = [...opts, 6].sort((a, b) => a - b);
            const { choices, answer } = fixedChoices(textChoice(pn[6]), all.filter((s) => s !== 6).map((s) => textChoice(pn[s])), all.indexOf(6));
            return tq('polygons', 'pg1', 'מה שם המצולע?', [{ kind: 'choice', choices, answer, hint: 'סופרים את הצלעות. מתחילים מצלע אחת וממשיכים סביב הצורה עד שחוזרים אליה.' }],
              `יש 6 צלעות, ולכן זה <b>${pn[6]}</b>.`,
              { figure: polygonFigure(regularish(6, 90, 15, [1, 0.8, 0.95, 0.85, 1, 0.9])) });
          })(),
        },
      ],
    },

    /* ------------------------------------------------ משולשים */
    triangles: {
      topic: 'triangles',
      skills: [
        {
          title: 'מיון משולשים לפי הצלעות',
          explain: `משווים את אורכי הצלעות: 3 צלעות שוות – ${TRI_NAMES.equilateral}, 2 צלעות שוות – ${TRI_NAMES.isosceles}, וכל הצלעות שונות – ${TRI_NAMES.scalene}. קו קטן זהה על צלעות מסמן שהן שוות.`,
          example: {
            task: 'איזה משולש זה? (אורכים בס״מ)',
            figure: triangleFigure({ sides: [5, 5, 3], rot: 0, lengths: true, ticks: true, highlightEqual: true }),
            steps: ['אורכי הצלעות: 5, 5 ו־3 ס״מ.', 'שתי צלעות שוות – 5 ו־5. הן מסומנות בקו קטן, והמספרים שלהן מודגשים.'],
            answer: `לכן זה משולש <b>${TRI_NAMES.isosceles}</b>.`,
          },
          tryIt: (() => {
            const opts = triangleOptions('scalene');
            const { choices, answer } = fixedChoices(textChoice(TRI_NAMES.scalene), opts.filter((o) => o !== 'scalene').map((o) => textChoice(TRI_NAMES[o])), opts.indexOf('scalene'));
            return tq('triangles', 'tr1', 'איזה משולש זה? (אורכים בס״מ)', [{ kind: 'choice', choices, answer, hint: 'משווים את שלושת המספרים. האם יש שני אורכים זהים?' }],
              `האורכים 4, 6 ו־7 ס״מ – כולם שונים. לכן זה משולש <b>${TRI_NAMES.scalene}</b>.`,
              { figure: triangleFigure({ sides: [6, 7, 4], rot: 25, lengths: true, ticks: true }) });
          })(),
        },
      ],
    },
  };
  return L;
}

let cache: Record<TopicId, Lesson> | null = null;
export function getLesson(t: TopicId): Lesson {
  // no typing: number answers of "עכשיו תורך" become answer buttons too
  cache = cache ?? Object.fromEntries(Object.entries(buildLessons()).map(([k, l]) => [k, { ...l, skills: l.skills.map((s) => ({ ...s, tryIt: numbersToChoices(s.tryIt) })) }])) as Record<TopicId, Lesson>;
  return cache[t];
}

