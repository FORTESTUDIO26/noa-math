// End-to-end check in a real browser at Samsung phone width (360px).
// Usage: npm run build && npm run e2e
import { createRequire } from 'module';
import { spawn } from 'child_process';
import { mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const shots = path.join(here, 'screenshots');
mkdirSync(shots, { recursive: true });

const PORT = 4179;
const URL = `http://localhost:${PORT}/`;
const KEY = 'noa-math-v1';
const results = [];
let failed = 0;
function check(name, cond, extra = '') {
  results.push(`${cond ? '✔' : '✘'} ${name}${extra ? ' — ' + extra : ''}`);
  if (!cond) failed++;
}

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: path.join(here, '..'), stdio: 'pipe' });
await new Promise((res) => setTimeout(res, 2500));

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 360, height: 760 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true, locale: 'he-IL' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

const state = () => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
const noHScroll = async (where) => {
  const w = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  check(`no horizontal scroll: ${where}`, w.sw <= w.cw, `${w.sw}/${w.cw}`);
};
const shot = (name) => page.screenshot({ path: path.join(shots, name + '.png'), fullPage: true });
const text = (sel) => page.locator(sel).first().innerText();

/** fill decomposition boxes with the on-screen digit pad (no phone keyboard) */
async function fillBoxes(pg, group, values) {
  for (let i = 0; i < values.length; i++) {
    await pg.click(`[data-field="${group}-${i}"]`);
    if (values[i] === '') await pg.click(`[data-act=kp-del][data-group="${group}"]`);
    else await pg.click(`[data-act=kp][data-group="${group}"][data-d="${values[i]}"]`);
  }
}
const boxValue = (pg, group, i) => pg.locator(`[data-field="${group}-${i}"]`).innerText().then((t) => t.trim());
/** type a name with the on-screen letter pad */
async function typeName(pg, name) {
  if ((await pg.locator('[data-act=nm]').count()) === 0) await pg.click('[data-act=nm-toggle]');
  while ((await pg.locator('#kid-name').innerText()) !== 'בלי שם' && (await pg.locator('#kid-name').innerText()).length) {
    if ((await pg.locator('.name-box.empty').count()) === 1) break;
    await pg.click('[data-act=nm-del]');
  }
  for (const ch of name) await pg.click(ch === ' ' ? '[data-act=nm-space]' : `[data-act=nm][data-l="${ch}"]`);
}
const noKeyboardInputs = (pg) => pg.locator('main input, main textarea, main [contenteditable]').count();

/** answer the current practice question; mode: 'right' | 'wrongThenRight' | 'wrongTwice' */
async function answerPractice(mode = 'right') {
  const s = await state();
  const p = s.practice;
  const q = p.questions[p.index];
  for (let pi = 0; pi < q.parts.length; pi++) {
    const part = q.parts[pi];
    const tries = mode === 'right' ? ['R'] : mode === 'wrongThenRight' ? ['W', 'R'] : ['W', 'W'];
    for (let k = 0; k < tries.length; k++) {
      const t = tries[k];
      if (part.kind === 'number' || part.kind === 'text') {
        const v = t === 'R' ? (part.kind === 'text' ? part.accept[0] : part.answer) : part.kind === 'text' ? 'משהו אחר' : String(Number(part.answer) + 1);
        await page.fill(`[data-input="P-${pi}"]`, v);
        await page.click(`form[data-key="P"][data-part="${pi}"] button[type=submit]`);
      } else if (part.kind === 'fields') {
        await fillBoxes(page, `P|P|${pi}`, part.fields.map((f, i) => (t === 'R' || i > 0 ? f.answer : String((Number(f.answer) + 1) % 10))));
        await page.click(`form.fields-form[data-key="P"][data-part="${pi}"] button[type=submit]`);
      } else {
        const id = t === 'R' ? part.answer : await page.locator(`[data-act=choose][data-key=P][data-part="${pi}"]:not([disabled])`).evaluateAll((els, ans) => els.map((e) => e.dataset.choice).find((c) => c !== ans), part.answer);
        await page.click(`[data-act=choose][data-key=P][data-part="${pi}"][data-choice="${id}"]`);
      }
      if (t === 'W' && k === 0) {
        const hint = await page.locator('.hint').count();
        check(`hint after first mistake (${q.topic})`, hint === 1);
      }
    }
  }
  return q;
}

try {
  /* ---------------------------------------------------------------- home */
  await page.goto(URL);
  /* ---------------------------------------------------------------- first visit: name + look */
  check('first visit opens the welcome screen', (await page.locator('#kid-name').count()) === 1 && (await page.locator('[data-act=pick-theme]').count()) === 2);
  check('welcome keeps the app name', (await text('h1')) === 'המתמטיקה של נועה');
  const themeNames = (await page.locator('.theme-name b').allInnerTexts()).join(',');
  check('two looks offered: מועדון החיות, כדורגל בחלל', themeNames === 'מועדון החיות,כדורגל בחלל', themeNames);
  check('each look has a small picture', (await page.locator('.theme-thumb .scene-svg').count()) === 2);
  check('welcome: no text box that needs the phone keyboard', (await noKeyboardInputs(page)) === 0);
  await noHScroll('welcome');
  await shot('00-welcome');
  await typeName(page, 'אורי');
  check('name typed with the on-screen letters', (await page.locator('#kid-name').innerText()) === 'אורי');
  await page.click('form[data-form=welcome] button[type=submit]');
  check('home greets by name: "היי, אורי!" under the app name', (await text('.greet')) === 'היי, אורי!' && (await text('h1')) === 'המתמטיקה של נועה');
  check('default look is מועדון החיות', (await page.evaluate(() => document.documentElement.dataset.theme)) === 'club');
  check('"שינוי שם ועיצוב" link on home', (await page.locator('[data-act=settings]').count()) === 1);
  {
    const ctxS = await browser.newContext({ viewport: { width: 360, height: 760 }, isMobile: true, hasTouch: true });
    const pS = await ctxS.newPage();
    await pS.goto(URL);
    await pS.click('[data-act=welcome-skip]');
    check('can start without a name', (await pS.locator('.modes .card').count()) === 3 && (await pS.locator('.greet').innerText()) === 'היי!');
    await pS.click('[data-act=start-mixed]');
    check('…and practise right away', (await pS.locator('.progress-text').innerText()) === 'שאלה 1 מתוך 8');
    await pS.reload();
    check('no welcome screen again after a refresh', (await pS.locator('#kid-name').count()) === 0);
    await ctxS.close();
  }
  {
    // a child who practised with the old version keeps progress and gets מועדון החיות
    const ctxO = await browser.newContext({ viewport: { width: 360, height: 760 } });
    const pO = await ctxO.newPage();
    await pO.goto(URL);
    await pO.evaluate((k) => localStorage.setItem(k, JSON.stringify({ v: 1, screen: { name: 'home' }, stats: { angles: { seen: 3, firstTry: 1, wrong: 2 } }, recent: [], practice: null, exam: null, lessonTry: {} })), KEY);
    await pO.reload();
    check('existing users: no welcome, club look, progress kept', (await pO.locator('#kid-name').count()) === 0 && (await pO.evaluate(() => document.documentElement.dataset.theme)) === 'club' && (await pO.locator('.weak .chip').count()) === 1);
    await ctxO.close();
  }
  check('home title', (await text('h1')) === 'המתמטיקה של נועה');
  check('three practice modes on home', (await page.locator('.modes .card').count()) === 3);
  check('html is RTL Hebrew', await page.evaluate(() => document.documentElement.dir === 'rtl' && document.documentElement.lang === 'he'));
  await noHScroll('home');
  await shot('01-home');

  /* ---------------------------------------------------------------- lessons exist for all topics */
  await page.click('[data-act=topics]');
  await noHScroll('topics');
  await shot('02-topics');
  const topicIds = await page.locator('[data-act=open-topic]').evaluateAll((els) => els.map((e) => e.dataset.topic));
  check('13 teacher topics listed', topicIds.length === 13, topicIds.join(','));
  for (const t of topicIds) {
    await page.click(`[data-act=open-topic][data-topic=${t}]`);
    const exOk = (await page.locator('.lesson-title').innerText()).includes('איך עושים את זה') &&
      (await page.locator('.lesson-top [data-act=start-topic]').innerText()).includes('ישר לתרגול') &&
      (await page.locator('.example').count()) === 1 && (await page.locator('.your-turn').count()) === 0;
    const sentences = (await text('.skill-explain')).split(/[.!?](?:\s|$)/).filter((x) => x.trim().length > 3).length;
    await noHScroll('lesson example ' + t);
    await shot('L-' + t);
    await page.click('.ex [data-act=lesson-step]');
    const tryOk = (await page.locator('.your-turn').count()) === 1 && (await page.locator('.example').count()) === 0 &&
      (await page.locator('.lesson-top [data-act=start-topic]').count()) === 1;
    check(`lesson: example screen, then a separate "עכשיו תורך" screen: ${t}`, exOk && tryOk && sentences <= 3, `explain sentences: ${sentences}`);
    await noHScroll('lesson try ' + t);
    await page.click('[data-act=topics]');
  }

  /* ---------------------------------------------------------------- lesson try-it: choice in words, hint then solve */
  await page.click('[data-act=open-topic][data-topic=digitValue]');
  await page.click('[data-act=lesson-step][data-step="3"]'); // "תורך 2": value of 7 in 473
  {
    const opts = await page.locator('[data-runner="L:digitValue:1"] [data-act=choose]').allInnerTexts();
    check('value choices are 7, 70, 700 (only values that make sense)', opts.map((o) => o.trim()).join(',') === '7,70,700', opts.join(','));
    await page.click('[data-runner="L:digitValue:1"] [data-act=choose] >> nth=0');
    const lh = await text('[data-runner="L:digitValue:1"] .hint');
    check('focused hint after choosing the digit itself', lh.includes('הספרה עצמה'), lh);
    check('the wrong button says "לא נכון" (not only colour)', (await text('[data-runner="L:digitValue:1"] .choice.wrong')).includes('לא נכון'));
    await page.click('[data-runner="L:digitValue:1"] [data-act=choose] >> nth=1');
    check('lesson accepts the right value (70) with "✓ נכון"', (await text('[data-runner="L:digitValue:1"] .choice.right')).includes('נכון'));
    check('a friend cheers (puppy wags / kitten raises a paw) after a correct answer', (await page.locator('[data-runner="L:digitValue:1"] .good .friend.mood-cheer').count()) === 1);
    await page.click('[data-act=retry-lesson][data-key="L:digitValue:1"]');
    check('"לנסות שוב" resets the lesson question', (await page.locator('[data-runner="L:digitValue:1"] .choice.right').count()) === 0);
    await page.click('[data-act=lesson-step][data-step="2"]');
    check('can go back to the worked example', (await page.locator('.example').count()) === 1);
  }

  /* ---------------------------------------------------------------- topic round: number line */
  await page.click('[data-act=topics]');
  await page.click('[data-act=open-topic][data-topic=numberLine]');
  await page.click('.lesson-top [data-act=start-topic]');
  check('progress "שאלה 1 מתוך 6"', (await text('.progress-text')) === 'שאלה 1 מתוך 6');
  await noHScroll('practice number line');
  await shot('03-practice-numberline');
  // number line: labels go left → right in increasing order, ticks equally spaced
  const nl = await page.evaluate(() => {
    const ticks = [...document.querySelectorAll('.q-figure line.nl-tick')].map((l) => l.getBoundingClientRect().x);
    const labels = [...document.querySelectorAll('.q-figure .nl-label')].map((t) => ({ x: t.getBoundingClientRect().x, v: Number(t.textContent.replace(/,/g, '')) }));
    return { ticks, labels };
  });
  const gaps = nl.ticks.slice(1).map((x, i) => Math.round(x - nl.ticks[i]));
  check('number line ticks equally spaced', Math.max(...gaps) - Math.min(...gaps) <= 1, gaps.join(','));
  const lab = nl.labels.sort((a, b) => a.x - b.x);
  check('number line numbers increase left → right', lab.every((l, i) => i === 0 || l.v > lab[i - 1].v), lab.map((l) => l.v).join(' < '));

  // Q1: wrong then right → hint must be the step hint
  {
    const s = await state();
    const q = s.practice.questions[0];
    const p0 = q.parts[0];
    check('number answer is shown as 4 buttons (no typing)', p0.kind === 'choice' && (await page.locator('[data-act=choose][data-key=P]').count()) === 4 && (await noKeyboardInputs(page)) === 0);
    const nums = (await page.locator('[data-act=choose][data-key=P]').allInnerTexts()).map((x) => Number(x.replace(/[^0-9]/g, '')));
    check('number buttons go from small to big', nums.every((x, i) => i === 0 || x > nums[i - 1]), nums.join(','));
    const wrongId = p0.choices.find((c) => c.id !== p0.answer).id;
    await page.click(`[data-act=choose][data-key=P][data-choice="${wrongId}"]`);
    const h = await text('.hint');
    check('number line hint: "בודקים בכמה המספרים גדלים בין שתי שנתות"', h.includes('בודקים בכמה המספרים גדלים בין שתי שנתות'), h);
    check('can try again after hint (wrong button marked, others still open)', (await page.locator('[data-act=choose][data-key=P]:not([disabled])').count()) === 3);
    await page.click(`[data-act=choose][data-key=P][data-choice="${p0.answer}"]`);
    check('correct answer accepted (2nd try)', (await page.locator('.choice.right').count()) === 1);
    await shot('04-after-hint-correct');
    await page.click('[data-act=next-q]');
  }
  // Q2: wrong twice → explained solution
  await answerPractice('wrongTwice');
  check('explained solution after 2nd mistake', (await page.locator('.explain').count()) === 1 && (await text('.explain')).includes('פתרון מוסבר'));
  check('correct answer shown after 2nd mistake', (await page.locator('.choice.right, .frow-ok, .frow-bad').count()) >= 1);
  await shot('05-explained-solution');
  await page.click('[data-act=next-q]');
  // Q3: open lesson and come back to the same question
  check('"להסבר ולדוגמה" button in topic practice', (await text('[data-act=lesson-from-practice]')).includes('להסבר ולדוגמה'));
  await page.click('[data-act=lesson-from-practice]');
  check('lesson return button names question 3', (await text('.lesson-top [data-act=back-to-practice]')).includes('שאלה 3'));
  await page.click('.lesson-top [data-act=back-to-practice]');
  check('back to the same question (3 of 6)', (await text('.progress-text')) === 'שאלה 3 מתוך 6');
  await answerPractice('right');
  await page.click('[data-act=next-q]');
  // reload in the middle → progress kept
  await page.reload();
  check('progress kept after refresh (question 4 of 6)', (await text('.progress-text')) === 'שאלה 4 מתוך 6');
  await page.click('[data-act=home]');
  check('home offers "להמשיך מאיפה שעצרת"', (await page.locator('[data-act=continue-practice]').count()) === 1);
  await page.click('[data-act=continue-practice]');
  for (let i = 4; i <= 6; i++) { await answerPractice(i === 5 ? 'wrongThenRight' : 'right'); await page.click('[data-act=next-q]'); }
  check('round summary shown', (await text('.score-line')).includes('מתוך 6'), await text('.score-line'));
  await shot('06-summary');

  /* ---------------------------------------------------------------- arithmetic shown left-to-right */
  await page.click('[data-act=home]');
  await page.click('[data-act=topics]');
  await page.click('[data-act=open-topic][data-topic=missing]');
  await page.click('.lesson-top [data-act=start-topic]');
  const order = await page.evaluate(() => {
    const el = document.querySelector('.q-math');
    const tn = el.firstChild;
    const r = document.createRange();
    const pos = (i) => { r.setStart(tn, i); r.setEnd(tn, i + 1); return r.getBoundingClientRect().x; };
    const s = tn.textContent;
    return { s, first: pos(0), last: pos(s.length - 1), eq: pos(s.indexOf('=')) };
  }).catch(() => null);
  if (order) check('exercise reads left → right (first char left of "=")', order.first < order.eq, order.s);
  // check any inline LTR math in the explanation too
  await answerPractice('wrongTwice');
  const inline = await page.evaluate(() => [...document.querySelectorAll('.explain .m')].map((m) => {
    const tn = [...m.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim().length > 2);
    if (!tn) return true;
    const r = document.createRange();
    r.setStart(tn, 0); r.setEnd(tn, 1); const a = r.getBoundingClientRect().x;
    r.setStart(tn, tn.textContent.length - 1); r.setEnd(tn, tn.textContent.length); const b = r.getBoundingClientRect().x;
    return a < b;
  }));
  check('inline math inside Hebrew explanations is left → right', inline.length > 0 && inline.every(Boolean), String(inline));
  await shot('07-missing-explained');

  // sequence boxes in DOM order are placed left → right
  await page.click('[data-act=home]');
  await page.click('[data-act=topics]');
  await page.click('[data-act=open-topic][data-topic=sequences]');
  await page.click('.lesson-top [data-act=start-topic]');
  const seqX = await page.evaluate(() => [...document.querySelectorAll('.q-figure .seq-box')].map((b) => b.getBoundingClientRect().x));
  check('sequence displayed left → right', seqX.every((x, i) => i === 0 || x > seqX[i - 1]), seqX.map(Math.round).join(','));
  await shot('08-sequence');

  /* ---------------------------------------------------------------- mixed round */
  await page.click('[data-act=home]');
  await page.click('[data-act=start-mixed]');
  const mixed = (await state()).practice;
  const geoInMixed = mixed.questions.filter((q) => ['angles', 'polygons', 'triangles'].includes(q.topic)).length;
  check('mixed round has arithmetic + geometry', geoInMixed >= 2 && geoInMixed < mixed.questions.length, `${geoInMixed} geometry of ${mixed.questions.length}`);
  check('mixed round prioritises numberLine (had mistakes) ', mixed.questions.some((q) => q.topic === 'numberLine' || q.topic === 'missing'));
  check('"להסבר" available in mixed', (await page.locator('[data-act=lesson-from-practice]').count()) === 1);
  for (let i = 0; i < mixed.questions.length; i++) {
    await noHScroll('mixed q' + (i + 1));
    if (i === 0) await shot('09-mixed-q1');
    await answerPractice('right');
    if (i === 1) await shot('10-mixed-answered');
    await page.click('[data-act=next-q]');
  }
  check('mixed summary all correct', (await text('.score-line')).includes(`ענית נכון על ${mixed.questions.length} מתוך ${mixed.questions.length}`), await text('.score-line'));

  /* ---------------------------------------------------------------- exam */
  await page.click('[data-act=home]');
  await page.click('[data-act=start-exam]');
  let exam = (await state()).exam;
  const covered = new Set(exam.questions.map((q) => q.topic));
  check('exam covers all 13 teacher topics', covered.size === 13, [...covered].join(','));
  check('exam has more than one question for some topics', exam.questions.length > 13, String(exam.questions.length));
  await shot('11-exam-q1');
  const wrongTopic = 'triangles';
  let wrongIdx = -1;
  for (let i = 0; i < exam.questions.length; i++) {
    const q = exam.questions[i];
    const makeWrong = q.topic === wrongTopic && wrongIdx === -1;
    if (makeWrong) wrongIdx = i;
    for (let pi = 0; pi < q.parts.length; pi++) {
      const part = q.parts[pi];
      if (part.kind === 'number' || part.kind === 'text') {
        const right = part.kind === 'text' ? part.accept[0] : part.answer;
        await page.fill(`[data-exam-input="${pi}"]`, makeWrong ? (part.kind === 'text' ? 'לא' : String(Number(part.answer) + 1)) : right);
      } else if (part.kind === 'fields') {
        await fillBoxes(page, `E|${i}|${pi}`, part.fields.map((f, k) => (makeWrong && k === 0 ? String((Number(f.answer) + 1) % 10) : f.answer)));
      } else {
        const id = makeWrong ? part.choices.find((c) => c.id !== part.answer).id : part.answer;
        await page.click(`[data-act=exam-choose][data-part="${pi}"][data-choice="${id}"]`);
      }
    }
    check(`no solution/hint visible during exam (q${i + 1})`, (await page.locator('.explain, .hint, .num-result, .hint-figure, .after').count()) === 0);
    await noHScroll('exam q' + (i + 1));
    if (i < exam.questions.length - 1) await page.click('[data-act=exam-next]');
  }
  // go back to question 1, change answer to wrong and back to right (editing works)
  await page.click('[data-act=exam-go][data-i="0"]');
  check('can return to question 1', (await text('.progress-text')) === `שאלה 1 מתוך ${exam.questions.length}`);
  const q0 = exam.questions[0];
  check('exam question 1 is the 4-box decomposition', q0.parts[0].kind === 'fields');
  {
    const f = q0.parts[0].fields;
    check('previous answers kept in all four boxes', (await Promise.all(f.map((_, i) => boxValue(page, 'E|0|0', i)))).join('|') === f.map((x) => x.answer).join('|'));
    await page.click('[data-field="E|0|0-2"]');
    await page.click('[data-act=kp-del][data-group="E|0|0"]');
    await page.reload();
    check('exam boxes saved after refresh (one emptied)', (await boxValue(page, 'E|0|0', 2)) === '' && (await boxValue(page, 'E|0|0', 0)) === f[0].answer);
    check('question chip shows "not answered" while a box is empty', !(await page.locator('.qchip[data-i="0"]').getAttribute('class')).includes('answered'));
    await page.click('[data-field="E|0|0-2"]');
    await page.click(`[data-act=kp][data-group="E|0|0"][data-d="${f[2].answer}"]`);
    check('chip is "answered" again', (await page.locator('.qchip[data-i="0"]').getAttribute('class')).includes('answered'));
  }
  await page.click('.submit-row [data-act=exam-submit], .exam-buttons [data-act=exam-submit]');
  check('submit asks for confirmation', (await page.locator('.confirm').count()) === 1);
  await page.click('[data-act=exam-submit-yes]');
  await noHScroll('exam results');
  await shot('12-exam-results');
  const rows = await page.locator('.by-topic tbody tr').count();
  check('results by topic: 13 rows', rows === 13, String(rows));
  const score = await text('.big-score');
  check('score = all but one', score.startsWith(`${exam.questions.length - 1} מתוך ${exam.questions.length}`), score);
  const triRow = page.locator('.by-topic tr', { has: page.locator('[data-topic=triangles]') });
  check('"תרגול נוסף" next to topic with mistakes', (await triRow.locator('[data-act=results-practice]').count()) === 1);
  check('no "תרגול נוסף" for perfect topics', (await page.locator('[data-act=results-practice]').count()) === 1);
  check('explanation links on results', (await page.locator('[data-act=results-lesson]').count()) === 13);
  await page.click('[data-act=results-lesson][data-topic=angles]');
  check('results → lesson', (await page.locator('.lesson-title').count()) === 1);
  await page.click('[data-act=back-to-results]');
  await page.click('[data-act=review]');
  check('solutions shown after submit', (await page.locator('.rev .explain').count()) === exam.questions.length);
  check('review marks the wrong question', (await page.locator('.rev-bad').count()) === 1);
  await noHScroll('exam review');
  await shot('13-exam-review');
  await page.click('.col [data-act=back-to-results]');
  await triRow.locator('[data-act=results-practice]').click();
  check('"תרגול נוסף" starts topic practice', (await text('.top-title')).includes('משולשים') && (await text('.progress-text')) === 'שאלה 1 מתוך 6');

  /* ---------------------------------------------------------------- word answers as buttons, 4 boxes with 0, cargo bays */
  {
    await page.click('[data-act=home]');
    await page.click('[data-act=topics]');
    await page.click('[data-act=open-topic][data-topic=digitValue]');
    await page.click('[data-act=lesson-step][data-step="2"]'); // example 2: value of 3 in 7639
    await page.click('[data-cargo-id="dv-ex"] [data-act=bay][data-place="1"]');
    const packsN = await page.locator('[data-cargo-id="dv-ex"] .pk-10').count();
    const cap = await text('[data-cargo-id="dv-ex"] .packs-caption');
    check('tapping the 3-tens bay opens 3 packs of 10 → 30', packsN === 3 && cap.includes('30'), `${packsN} packs, "${cap}"`);
    const capLtr = await page.evaluate(() => {
      const el = document.querySelector('[data-cargo-id="dv-ex"] .packs-caption .m:last-of-type'); const tn = el.firstChild; const r = document.createRange();
      r.setStart(tn, 0); r.setEnd(tn, 1); const a = r.getBoundingClientRect().x; r.setStart(tn, tn.length - 1); r.setEnd(tn, tn.length); return { ok: a < r.getBoundingClientRect().x, t: tn.textContent };
    });
    check('"3 × 10 = 30" reads left → right', capLtr.ok, capLtr.t);
    const bayDigits = await page.evaluate(() => [...document.querySelectorAll('[data-cargo-id="dv-ex"] .bay')].map((b) => ({ x: b.getBoundingClientRect().x, d: b.querySelector('.bay-digit').textContent, n: b.querySelector('.bay-name').textContent })));
    check('cargo bays read 7 6 3 9 left → right (אלפים … יחידות)', bayDigits.sort((a, b) => a.x - b.x).map((b) => b.d).join('') === '7639' && bayDigits[0].n === 'אלפים' && bayDigits[3].n === 'יחידות');
    await shot('14-worked-example-bays');

    // "עכשיו תורך" 1: place of 5 in 2,514 – four place-name buttons, no typing
    await page.click('[data-act=lesson-step][data-step="1"]');
    const runner = '[data-runner="L:digitValue:0"]';
    check('no text box for a word answer', (await page.locator(`${runner} input`).count()) === 0);
    const names = (await page.locator(`${runner} [data-act=choose]`).allInnerTexts()).map((x) => x.trim());
    check('place buttons: אלפים, מאות, עשרות, יחידות', names.join(',') === 'אלפים,מאות,עשרות,יחידות', names.join(','));
    await page.click(`${runner} [data-act=choose]:has-text("עשרות")`);
    check('wrong word choice → hint and try again', (await page.locator(`${runner} .hint`).count()) === 1 && (await text(`${runner} .choice.wrong`)).includes('לא נכון'));
    check('answer picture appears only with the hint', (await page.locator(`${runner} .hint-figure .cargo`).count()) === 1);
    await page.click(`${runner} [data-act=choose]:has-text("מאות")`);
    check('"מאות" accepted and marked "✓ נכון"', (await text(`${runner} .choice.right`)).includes('מאות'));
    await shot('15-word-choice');

    // place-value card: 4 boxes with a 0 (7052) – empty and 0 are different states
    await page.click('[data-act=topics]');
    await page.click('[data-act=open-topic][data-topic=placeValue]');
    await page.click('.ex [data-act=lesson-step]');
    const fr = '[data-runner="L:placeValue:0"]';
    const G = 'P|L:placeValue:0|0';
    const rows = await page.evaluate((fr) => [...document.querySelectorAll(`${fr} .frow`)].map((r) => {
      const i = r.querySelector('.fbox').getBoundingClientRect(), l = r.querySelector('.flabel').getBoundingClientRect();
      return { label: r.querySelector('.flabel').textContent, inputRight: i.x > l.x };
    }), fr);
    check('4 rows אלפים/מאות/עשרות/יחידות', rows.map((r) => r.label).join(',') === 'אלפים,מאות,עשרות,יחידות');
    check('box comes before the word in Hebrew reading order (box on the right)', rows.every((r) => r.inputRight));
    check('boxes are filled with the on-screen digit pad – no phone keyboard', (await page.locator(`${fr} .keypad .kp`).count()) === 12 && (await noKeyboardInputs(page)) === 0);
    await fillBoxes(page, G, ['7', '', '6', '2']); // hundreds empty, tens wrong (5)
    await page.click(`${fr} form.fields-form button[type=submit]`);
    const st = await page.evaluate((fr) => [...document.querySelectorAll(`${fr} .frow`)].map((r) => r.className + '|' + (r.querySelector('.fmark')?.textContent ?? '')), fr);
    check('empty hundreds row: "השורה ריקה"; wrong tens row: "לתיקון"; others unmarked', st[1].includes('frow-empty') && st[1].includes('השורה ריקה') && st[2].includes('frow-bad') && st[2].includes('לתיקון') && !st[0].includes('frow-') && !st[3].includes('frow-'), st.join(' / '));
    check('what was filled is kept', (await boxValue(page, G, 0)) === '7' && (await boxValue(page, G, 3)) === '2');
    const zh = await text(`${fr} .hint`);
    check('zero hint explains why 0 must be written', zh.includes('צריך לכתוב 0') && zh.includes('מאות'), zh);
    check('picture of the boxes not shown before solving', (await page.locator(`${fr} .hint-figure`).count()) === 0);
    await shot('16-fields-zero-hint');
    await page.click(`[data-field="${G}-1"]`);
    await page.click(`[data-act=kp][data-group="${G}"][data-d="0"]`);
    await page.click(`[data-field="${G}-2"]`);
    await page.click(`[data-act=kp][data-group="${G}"][data-d="5"]`);
    await page.click(`${fr} form.fields-form button[type=submit]`);
    check('all four boxes accepted with an explicit 0', (await page.locator(`${fr} .good`).count()) === 1);
    const after = await text(`${fr} .after`);
    check('after solving: 7,000 + 50 + 2', after.includes('7,000 + 50 + 2'), after);
    const afterLtr = await page.evaluate((fr) => {
      const el = document.querySelector(`${fr} .after .m`); const tn = el.firstChild; const r = document.createRange();
      r.setStart(tn, 0); r.setEnd(tn, 1); const a = r.getBoundingClientRect().x; r.setStart(tn, tn.length - 1); r.setEnd(tn, tn.length); return a < r.getBoundingClientRect().x;
    }, fr);
    check('decomposition by values reads left → right', afterLtr);
    await shot('17-fields-solved');

    // a real topic round: same numbers in several forms
    await page.click('.lesson-top [data-act=start-topic]');
    const pr = (await state()).practice;
    const sigNums = pr.questions.map((q) => (q.sig.match(/-(\d{4})(?:-|$)/) || [])[1]);
    check('placeValue round: same number met in several forms', new Set(sigNums.filter(Boolean)).size < sigNums.filter(Boolean).length, pr.questions.map((q) => q.sig).join(' '));
    check('placeValue round mixes number boxes and choices', pr.questions.some((q) => q.parts[0].kind === 'choice') && pr.questions.some((q) => q.parts[0].kind !== 'choice'));
    check('hint picture hidden while answering', (await page.locator('.hint-figure').count()) === 0);
    for (let i = 0; i < 6; i++) { await answerPractice(i === 3 ? 'wrongThenRight' : 'right'); await noHScroll('placeValue round q' + (i + 1)); await page.click('[data-act=next-q]'); }
    check('placeValue round finished', (await text('.score-line')).includes('מתוך 6'));

    // geometry question in practice
    await page.click('[data-act=home]');
    await page.click('[data-act=topics]');
    await page.click('[data-act=open-topic][data-topic=triangles]');
    await page.click('.lesson-top [data-act=start-topic]');
    const tq = (await state()).practice.questions[0];
    const lens = await page.locator('.q-figure .len').allInnerTexts();
    check('triangle drawn with 3 labelled sides', lens.length === 3, lens.join(','));
    const wrongId = tq.parts[0].choices.find((c) => c.id !== tq.parts[0].answer).id;
    await page.click(`[data-act=choose][data-key=P][data-choice="${wrongId}"]`);
    check('geometry: wrong type → hint + "לא נכון"', (await page.locator('.hint').count()) === 1 && (await text('.choice.wrong')).includes('לא נכון'));
    await page.click(`[data-act=choose][data-key=P][data-choice="${tq.parts[0].answer}"]`);
    check('geometry: right type → "✓ נכון" and a friend cheers (puppy wags / kitten raises a paw)', (await text('.choice.right')).includes('נכון') && (await page.locator('.good .friend.mood-cheer').count()) === 1);
    await shot('18-geometry-practice');
  }

  /* ---------------------------------------------------------------- layout sweep: 2 rounds × 13 topics at 360px */
  {
    const bad = [];
    let seen = 0;
    for (const t of topicIds) for (let r = 0; r < 2; r++) {
      await page.click('[data-act=home]');
      await page.click('[data-act=topics]');
      await page.click(`[data-act=open-topic][data-topic=${t}]`);
      await page.click('.lesson-top [data-act=start-topic]');
      for (let i = 0; i < 6; i++) {
        const w = await page.evaluate(() => {
          const over = [...document.querySelectorAll('.q-card *')].filter((e) => e.getBoundingClientRect().right > document.documentElement.clientWidth + 1 || e.getBoundingClientRect().left < -1).length;
          return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, over };
        });
        seen++;
        if (w.sw > w.cw || w.over) { const s = await state(); bad.push(`${s.practice.questions[i].sig} (${w.sw}px, ${w.over} el)`); await shot('overflow-' + bad.length); }
        await answerPractice('right');
        await page.click('[data-act=next-q]');
      }
    }
    check(`layout sweep: ${seen} questions fit 360px without horizontal scroll`, bad.length === 0, bad.join('; '));
  }
  /* ---------------------------------------------------------------- switching the look keeps question + answer */
  {
    await page.click('[data-act=home]');
    await page.click('[data-act=topics]');
    await page.click('[data-act=open-topic][data-topic=multMeaning]');
    await page.click('.lesson-top [data-act=start-topic]');
    await answerPractice('right');          // q1 answered
    await page.click('[data-act=next-q]');
    const q2 = (await state()).practice.questions[1];
    const p0 = q2.parts[0];
    if (p0.kind === 'choice') await page.click(`[data-act=choose][data-key=P][data-choice="${p0.answer}"]`);
    else await fillBoxes(page, 'P|P|0', p0.fields.map((f) => f.answer)), await page.click('form.fields-form[data-key="P"] button[type=submit]');
    await shot('20-same-question-club');
    const before = await page.locator('.q-card').innerText();
    await page.click('[data-act=home]');
    await page.click('[data-act=settings]');
    check('settings screen keeps the name', (await page.locator('#kid-name').innerText()) === 'אורי');
    await page.click('[data-act=pick-theme][data-theme-id=space]');
    await page.click('form[data-form=welcome] button[type=submit]');
    check('look switched to כדורגל בחלל', (await page.evaluate(() => document.documentElement.dataset.theme)) === 'space');
    check('greeting kept after the switch', (await text('.greet')) === 'היי, אורי!');
    await page.click('[data-act=continue-practice]');
    const after = await page.locator('.q-card').innerText();
    check('same question (2 of 6) and the same answer after switching the look', (await text('.progress-text')) === 'שאלה 2 מתוך 6' && (await page.locator('.q-card .choice.right, .q-card .num-result.correct').count()) >= 1, `${before.slice(0, 40)} | ${after.slice(0, 40)}`);
    check('astronauts shown, animals hidden', (await page.locator('.q-card .astro:visible').count()) >= 1 && (await page.locator('.q-card .friend:visible').count()) === 0);
    check('theme words switched (חטיפים → כדורים)', !(await page.locator('.q-card').innerText()).includes('חטיפים'));
    await page.reload();
    check('after refresh: still question 2, answer kept, still כדורגל בחלל', (await text('.progress-text')) === 'שאלה 2 מתוך 6' && (await page.locator('.q-card .choice.right, .q-card .num-result.correct').count()) >= 1 && (await page.evaluate(() => document.documentElement.dataset.theme)) === 'space');
    await shot('21-same-question-space');
    // exam answer survives a switch too
    await page.click('[data-act=home]');
    await page.click('[data-act=start-exam]');
    const ex = (await state()).exam;
    const f = ex.questions[0].parts[0].fields;
    await fillBoxes(page, 'E|0|0', f.map((x) => x.answer));
    await page.click('[data-act=home]');
    await page.click('[data-act=settings]');
    await page.click('[data-act=pick-theme][data-theme-id=club]');
    await page.click('form[data-form=welcome] button[type=submit]');
    await page.click('[data-act=continue-exam]');
    check('exam answer kept after switching back to מועדון החיות', (await boxValue(page, 'E|0|0', 0)) === f[0].answer && (await page.evaluate(() => document.documentElement.dataset.theme)) === 'club');
    await page.click('[data-act=home]');
  }

  /* ---------------------------------------------------------------- 390px pass */
  {
    const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true, locale: 'he-IL' });
    const p2 = await ctx2.newPage();
    p2.on('pageerror', (e) => errors.push(String(e)));
    const bad = [];
    const fits = async (where) => {
      const w = await p2.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      if (w.sw > w.cw) bad.push(`${where} ${w.sw}/${w.cw}`);
      if ((await noKeyboardInputs(p2)) > 0) bad.push(`${where}: has a text box`);
    };
    await p2.goto(URL);
    await p2.click('[data-act=pick-theme][data-theme-id=space]');
    await typeName(p2, 'מאיה');
    await p2.click('form[data-form=welcome] button[type=submit]');
    check('390px pass runs in the "כדורגל בחלל" look', (await p2.evaluate(() => document.documentElement.dataset.theme)) === 'space' && (await p2.locator('.scene .astro').count()) >= 3);
    await fits('home');
    await p2.screenshot({ path: path.join(shots, '390-home.png'), fullPage: true });
    await p2.click('[data-act=topics]');
    await fits('topics');
    const ids = await p2.locator('[data-act=open-topic]').evaluateAll((els) => els.map((e) => e.dataset.topic));
    let screens = 0;
    for (const t of ids) {
      await p2.click(`[data-act=open-topic][data-topic=${t}]`);
      const n = await p2.locator('[data-act=lesson-step].step-dot').count();
      for (let i = 0; i < n; i++) { await p2.click(`.step-dot[data-step="${i}"]`); await fits(`lesson ${t} step ${i}`); screens++; }
      if (t === 'placeValue') await p2.screenshot({ path: path.join(shots, '390-lesson.png'), fullPage: true });
      await p2.click('.lesson-top [data-act=start-topic]');
      for (let i = 0; i < 6; i++) {
        await fits(`${t} q${i + 1}`); screens++;
        const st = await p2.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
        const q = st.practice.questions[i];
        for (let pi = 0; pi < q.parts.length; pi++) {
          const part = q.parts[pi];
          if (part.kind === 'choice') await p2.click(`[data-act=choose][data-key=P][data-part="${pi}"][data-choice="${part.answer}"]`);
          else if (part.kind === 'fields') { await fillBoxes(p2, `P|P|${pi}`, part.fields.map((f) => f.answer)); await p2.click(`form.fields-form[data-part="${pi}"] button[type=submit]`); }
          else { await p2.fill(`[data-input="P-${pi}"]`, part.answer); await p2.click(`form[data-key="P"][data-part="${pi}"] button`); }
        }
        await fits(`${t} q${i + 1} solved`);
        if (t === 'angles' && i === 0) await p2.screenshot({ path: path.join(shots, '390-practice.png'), fullPage: true });
        await p2.click('[data-act=next-q]');
      }
      await fits(`${t} summary`);
      await p2.click('[data-act=home]');
      await p2.click('[data-act=topics]');
    }
    await p2.click('[data-act=home]');
    await p2.click('[data-act=start-exam]');
    const nEx = (await p2.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY)).exam.questions.length;
    for (let i = 0; i < nEx; i++) { await fits(`exam q${i + 1}`); screens++; if (i < nEx - 1) await p2.click('[data-act=exam-next]'); }
    await p2.click('.exam-buttons [data-act=exam-submit]');
    await p2.click('[data-act=exam-submit-yes]');
    await fits('exam results');
    await p2.click('[data-act=review]');
    await fits('exam review');
    check(`390px, כדורגל בחלל: ${screens} screens (all lesson steps, 13 rounds, exam, results, review) – no horizontal scroll, no text box needing the phone keyboard`, bad.length === 0, bad.join('; '));
    await ctx2.close();
  }

  check('no JS errors in console', errors.length === 0, errors.join(' | '));
} catch (e) {
  check('e2e run finished without exception', false, String(e && e.stack || e));
} finally {
  await browser.close();
  server.kill();
}
console.log(results.join('\n'));
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
