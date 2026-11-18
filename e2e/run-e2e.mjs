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
        for (let i = 0; i < part.fields.length; i++) {
          const a = part.fields[i].answer;
          await page.fill(`[data-field="P-${pi}-${i}"]`, t === 'R' ? a : i === 0 ? String((Number(a) + 1) % 10) : a);
        }
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
    const ok = (await page.locator('.lesson-title').innerText()).includes('איך עושים את זה') &&
      (await page.locator('.lesson-top [data-act=start-topic]').innerText()).includes('ישר לתרגול') &&
      (await page.locator('.example').count()) >= 1 && (await page.locator('.your-turn').count()) >= 1;
    check(`lesson card with example + "עכשיו תורך": ${t}`, ok);
    await noHScroll('lesson ' + t);
    await shot('L-' + t);
    await page.click('[data-act=topics]');
  }

  /* ---------------------------------------------------------------- lesson try-it: hint then solve */
  await page.click('[data-act=open-topic][data-topic=digitValue]');
  await page.fill('[data-input="L:digitValue:1-0"]', '700');
  await page.click('form[data-key="L:digitValue:1"] button[type=submit]');
  const lh = await text('[data-runner="L:digitValue:1"] .hint');
  check('lesson focused hint after mistake', lh.includes('התחילי מימין'), lh);
  await page.fill('[data-input="L:digitValue:1-0"]', '70');
  await page.click('form[data-key="L:digitValue:1"] button[type=submit]');
  check('lesson accepts correct answer (70)', (await page.locator('[data-runner="L:digitValue:1"] .num-result.correct').count()) === 1);
  await page.click('[data-act=retry-lesson][data-key="L:digitValue:1"]');
  check('"לנסות שוב" resets the lesson question', (await page.locator('[data-input="L:digitValue:1-0"]').count()) === 1);

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
    await page.fill('[data-input="P-0"]', String(Number(q.parts[0].answer) + 1));
    await page.click('form[data-key="P"] button[type=submit]');
    const h = await text('.hint');
    check('number line hint: "בדקי בכמה המספרים גדלים בין שתי שנתות"', h.includes('בדקי בכמה המספרים גדלים בין שתי שנתות'), h);
    check('can try again after hint', (await page.locator('[data-input="P-0"]').count()) === 1);
    await page.fill('[data-input="P-0"]', Number(q.parts[0].answer).toLocaleString('en-US')); // with thousands comma too
    await page.click('form[data-key="P"] button[type=submit]');
    check('correct answer accepted (2nd try)', (await page.locator('.num-result.correct').count()) === 1);
    await shot('04-after-hint-correct');
    await page.click('[data-act=next-q]');
  }
  // Q2: wrong twice → explained solution
  await answerPractice('wrongTwice');
  check('explained solution after 2nd mistake', (await page.locator('.explain').count()) === 1 && (await text('.explain')).includes('פתרון מוסבר'));
  check('correct answer shown after 2nd mistake', (await page.locator('.num-result.failed').count()) >= 1);
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
        for (let i = 0; i < part.fields.length; i++) {
          const a = part.fields[i].answer;
          await page.fill(`[data-exam-field="${pi}:${i}"]`, makeWrong && i === 0 ? String((Number(a) + 1) % 10) : a);
        }
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
    check('previous answers kept in all four boxes', (await Promise.all(f.map((_, i) => page.inputValue(`[data-exam-field="0:${i}"]`)))).join('|') === f.map((x) => x.answer).join('|'));
    await page.fill('[data-exam-field="0:2"]', '');
    await page.reload();
    check('exam boxes saved after refresh (one emptied)', (await page.inputValue('[data-exam-field="0:2"]')) === '' && (await page.inputValue('[data-exam-field="0:0"]')) === f[0].answer);
    check('question chip shows "not answered" while a box is empty', !(await page.locator('.qchip[data-i="0"]').getAttribute('class')).includes('answered'));
    await page.fill('[data-exam-field="0:2"]', f[2].answer);
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

  /* ---------------------------------------------------------------- Hebrew answers, 4 boxes, cargo bays */
  {
    await page.click('[data-act=home]');
    await page.click('[data-act=topics]');
    await page.click('[data-act=open-topic][data-topic=digitValue]');
    // worked example: tap the bay of 3 tens → three packs of 10 = 30
    await page.click('[data-cargo-id="dv-ex"] [data-act=bay][data-place="1"]');
    const packsN = await page.locator('[data-cargo-id="dv-ex"] .pk-10').count();
    const cap = await text('[data-cargo-id="dv-ex"] .packs-caption');
    check('tapping the 3-tens bay shows 3 packs of 10 = 30', packsN === 3 && cap.includes('30'), `${packsN} packs, "${cap}"`);
    const bayDigits = await page.evaluate(() => [...document.querySelectorAll('[data-cargo-id="dv-ex"] .bay')].map((b) => ({ x: b.getBoundingClientRect().x, d: b.querySelector('.bay-digit').textContent, n: b.querySelector('.bay-name').textContent })));
    check('cargo bays read 7 6 3 9 left → right (אלפים … יחידות)', bayDigits.sort((a, b) => a.x - b.x).map((b) => b.d).join('') === '7639' && bayDigits[0].n === 'אלפים' && bayDigits[3].n === 'יחידות');
    // "עכשיו תורך" 1: typed place name with the regular (Hebrew) keyboard
    const placeInput = page.locator('[data-input="L:digitValue:0-0"]');
    const attrs = await placeInput.evaluate((el) => ({ im: el.getAttribute('inputmode'), lang: el.getAttribute('lang'), pattern: el.getAttribute('pattern'), dir: el.getAttribute('dir') }));
    check('place-name box opens the regular keyboard (inputmode=text, lang=he, no digit pattern)', attrs.im === 'text' && attrs.lang === 'he' && attrs.pattern === null && attrs.dir === 'rtl', JSON.stringify(attrs));
    check('instruction under the box: "כתבי את שם המקום"', (await text('[data-runner="L:digitValue:0"] .field-hint')).includes('כתבי את שם המקום'));
    await placeInput.pressSequentially('מֵאוֹת  ');
    await page.click('form[data-key="L:digitValue:0"] button[type=submit]');
    check('typed "מאות" (with niqqud + spaces) accepted', (await page.locator('[data-runner="L:digitValue:0"] .num-result.correct').count()) === 1);
    check('Robi waves after a correct answer', (await page.locator('[data-runner="L:digitValue:0"] .good .robot-wave').count()) === 1);
    check('opened bay stays open after the answer re-renders the screen', (await page.locator('[data-cargo-id="dv-ex"] .pk-10').count()) === 3);
    // "עכשיו תורך" 2: value — writing the place gives the focused hint, words are accepted
    await page.fill('[data-input="L:digitValue:1-0"]', 'עשרות');
    await page.click('form[data-key="L:digitValue:1"] button[type=submit]');
    const h2 = await text('[data-runner="L:digitValue:1"] .hint');
    check('"עשרות" in the value question → "מצאת את המקום. כמה הן 7 עשרות?"', h2.includes('מצאת את המקום. כמה הן 7 עשרות?'), h2);
    check('hint picture (cargo bay with packs) appears with the hint', (await page.locator('[data-runner="L:digitValue:1"] .hint-figure .pk-10').count()) === 7);
    await page.fill('[data-input="L:digitValue:1-0"]', 'שבעים');
    await page.click('form[data-key="L:digitValue:1"] button[type=submit]');
    check('"שבעים" accepted as the value', (await page.locator('[data-runner="L:digitValue:1"] .num-result.correct').count()) === 1);
    await shot('14-digit-value-card');

    // place-value card: 4 boxes with a 0 (7052)
    await page.click('[data-act=topics]');
    await page.click('[data-act=open-topic][data-topic=placeValue]');
    const rows = await page.evaluate(() => [...document.querySelectorAll('[data-runner="L:placeValue:0"] .frow')].map((r) => {
      const i = r.querySelector('input').getBoundingClientRect(), l = r.querySelector('.flabel').getBoundingClientRect();
      return { label: r.querySelector('.flabel').textContent, inputRight: i.x > l.x, im: r.querySelector('input').getAttribute('inputmode') };
    }));
    check('4 rows אלפים/מאות/עשרות/יחידות', rows.map((r) => r.label).join(',') === 'אלפים,מאות,עשרות,יחידות');
    check('box comes before the word in Hebrew reading order (box on the right)', rows.every((r) => r.inputRight));
    check('decomposition boxes open the numeric keyboard', rows.every((r) => r.im === 'numeric'));
    await page.fill('[data-field="L:placeValue:0-0-0"]', '7');
    await page.fill('[data-field="L:placeValue:0-0-2"]', '5');
    await page.fill('[data-field="L:placeValue:0-0-3"]', '2');
    await page.click('[data-runner="L:placeValue:0"] form.fields-form button[type=submit]');
    const badRows = await page.locator('[data-runner="L:placeValue:0"] .frow-bad').evaluateAll((els) => els.map((e) => e.querySelector('.flabel').textContent));
    check('only the empty hundreds row is marked for fixing', badRows.join(',') === 'מאות', badRows.join(','));
    check('what Noa typed is kept', (await page.inputValue('[data-field="L:placeValue:0-0-0"]')) === '7' && (await page.inputValue('[data-field="L:placeValue:0-0-3"]')) === '2');
    const zh = await text('[data-runner="L:placeValue:0"] .hint');
    check('zero hint explains why 0 must be written', zh.includes('צריך לכתוב 0') && zh.includes('מאות'), zh);
    check('hint picture of the boxes is not shown before solving', (await page.locator('[data-runner="L:placeValue:0"] .hint-figure').count()) === 0);
    await shot('15-fields-zero-hint');
    await page.fill('[data-field="L:placeValue:0-0-1"]', '0');
    await page.click('[data-runner="L:placeValue:0"] form.fields-form button[type=submit]');
    check('all four boxes accepted with an explicit 0', (await page.locator('[data-runner="L:placeValue:0"] .good').count()) === 1);
    const after = await text('[data-runner="L:placeValue:0"] .after');
    check('after solving: decomposition by values 7,000 + 50 + 2', after.includes('7,000 + 50 + 2'), after);
    const afterLtr = await page.evaluate(() => {
      const el = document.querySelector('[data-runner="L:placeValue:0"] .after .m'); const tn = el.firstChild; const r = document.createRange();
      r.setStart(tn, 0); r.setEnd(tn, 1); const a = r.getBoundingClientRect().x; r.setStart(tn, tn.length - 1); r.setEnd(tn, tn.length); return a < r.getBoundingClientRect().x;
    });
    check('decomposition by values reads left → right', afterLtr);
    await shot('16-fields-solved');

    // a real topic round: typed answers + choice, same numbers in several forms
    await page.click('.lesson-top [data-act=start-topic]');
    const pr = (await state()).practice;
    const sigNums = pr.questions.map((q) => (q.sig.match(/-(\d{4})(?:-|$)/) || [])[1]);
    check('placeValue round: same number met in several forms', new Set(sigNums.filter(Boolean)).size < sigNums.filter(Boolean).length, pr.questions.map((q) => q.sig).join(' '));
    check('placeValue round mixes typing and choice', pr.questions.some((q) => q.parts[0].kind === 'choice') && pr.questions.some((q) => q.parts[0].kind !== 'choice'));
    check('hint picture hidden while answering', (await page.locator('.hint-figure').count()) === 0);
    for (let i = 0; i < 6; i++) { await answerPractice(i === 3 ? 'wrongThenRight' : 'right'); await noHScroll('placeValue round q' + (i + 1)); await page.click('[data-act=next-q]'); }
    check('placeValue round finished', (await text('.score-line')).includes('מתוך 6'));
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
