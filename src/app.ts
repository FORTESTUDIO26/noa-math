import { CONFIG } from './config';
import type { Part, Question, TopicId } from './types';
import { Rng } from './rng';
import { TOPICS, topicById } from './topics';
import { buildTopicRound, buildMixed, buildExam, isCorrectAnswer, type Stats } from './rounds';
import { getLesson } from './lessons';
import { esc, renderBlank } from './format';
import { checkPart, splitFields, isFilled } from './answers';
import { friend, packs } from './club';
import { topicIcon, modeIcon, homeScene, puzzleIcon } from './art';

/* ================================================================== state */

interface PartProg { attempts: number; status: 'open' | 'correct' | 'failed'; wrong: string[]; values?: string[]; bad?: boolean[]; hintText?: string }
type Screen =
  | { name: 'home' }
  | { name: 'topics' }
  | { name: 'lesson'; topic: TopicId; from: 'topics' | 'practice' | 'results'; step?: number }
  | { name: 'practice' }
  | { name: 'summary' }
  | { name: 'exam' }
  | { name: 'examResults' }
  | { name: 'review' };

interface Practice { mode: 'topic' | 'mixed'; topic?: TopicId; questions: Question[]; prog: PartProg[][]; index: number; counted: boolean[]; finished: boolean }
interface Exam { questions: Question[]; answers: string[][]; index: number; submitted: boolean; correct?: boolean[]; confirm?: boolean }

export interface AppState {
  v: 1;
  screen: Screen;
  stats: Stats;
  recent: string[];
  practice: Practice | null;
  exam: Exam | null;
  lessonTry: Record<string, PartProg[]>;
}

const fresh = (): AppState => ({ v: 1, screen: { name: 'home' }, stats: {}, recent: [], practice: null, exam: null, lessonTry: {} });

function load(): AppState {
  try {
    const raw = localStorage.getItem(CONFIG.storageKey);
    if (!raw) return fresh();
    const s = JSON.parse(raw) as AppState;
    if (s.v !== 1 || !s.screen) return fresh();
    return { ...fresh(), ...s };
  } catch { return fresh(); }
}
function save() {
  try { localStorage.setItem(CONFIG.storageKey, JSON.stringify(state)); } catch { /* private mode – keep working */ }
}

let state: AppState = load();
const rng = new Rng();
let root: HTMLElement;
let focusSel: string | null = null;
let scrollTop = false;

const newProg = (q: Question): PartProg[] => q.parts.map(() => ({ attempts: 0, status: 'open', wrong: [] }));
function remember(qs: Question[]) {
  state.recent = [...state.recent, ...qs.map((q) => q.sig)].slice(-CONFIG.recentMemory);
}

/* ================================================================== navigation */

function go(screen: Screen) { state.screen = screen; scrollTop = true; openBays.clear(); save(); render(); }
/** cargo bays opened in worked examples (cargo id → place) – kept while the screen stays open */
const openBays = new Map<string, string>();

function startTopic(topic: TopicId) {
  const questions = buildTopicRound(rng, topic, state.recent);
  remember(questions);
  state.practice = { mode: 'topic', topic, questions, prog: questions.map(newProg), index: 0, counted: questions.map(() => false), finished: false };
  go({ name: 'practice' });
}
function startMixed() {
  const questions = buildMixed(rng, state.stats, state.recent);
  remember(questions);
  state.practice = { mode: 'mixed', questions, prog: questions.map(newProg), index: 0, counted: questions.map(() => false), finished: false };
  go({ name: 'practice' });
}
function startExam() {
  const questions = buildExam(rng, state.recent);
  remember(questions);
  state.exam = { questions, answers: questions.map((q) => q.parts.map(() => '')), index: 0, submitted: false };
  go({ name: 'exam' });
}

/* ================================================================== answer checking */

function runnerFor(key: string): { q: Question; prog: PartProg[] } | null {
  if (key === 'P' && state.practice) {
    const p = state.practice;
    return { q: p.questions[p.index], prog: p.prog[p.index] };
  }
  if (key.startsWith('L:')) {
    const [, topic, idx] = key.split(':');
    const q = getLesson(topic as TopicId).skills[Number(idx)].tryIt;
    state.lessonTry[key] = state.lessonTry[key] ?? newProg(q);
    return { q, prog: state.lessonTry[key] };
  }
  return null;
}

function answer(key: string, partIdx: number, value: string) {
  const r = runnerFor(key);
  if (!r) return;
  const pp = r.prog[partIdx];
  const part = r.q.parts[partIdx];
  if (pp.status !== 'open') return;
  const res = checkPart(part, value);
  if (part.kind === 'fields') pp.values = splitFields(value, part.fields!.length);
  const firstField = `[data-field="${key}-${partIdx}-0"]`;
  if (res.empty) {
    focusSel = part.kind === 'fields' ? firstField : `[data-input="${key}-${partIdx}"]`;
    pp.hintText = part.kind === 'fields' ? 'מלאי ספרה בכל אחת מארבע השורות ואז לחצי על ״בדיקה״.' : pp.hintText;
    save(); render(); return;
  }
  if (res.ok) {
    pp.status = 'correct';
    pp.bad = undefined;
  } else {
    pp.attempts += 1;
    pp.wrong.push(value);
    pp.bad = res.bad;
    pp.hintText = res.emptyZero && part.zeroHint ? part.zeroHint : res.trap ?? part.hint;
    if (pp.attempts >= 2) pp.status = 'failed';
    else if (part.kind === 'fields') {
      const i = (res.bad ?? []).findIndex(Boolean);
      focusSel = `[data-field="${key}-${partIdx}-${Math.max(0, i)}"]`;
    } else focusSel = `[data-input="${key}-${partIdx}"]`;
  }
  // next part gets focus
  const next = r.q.parts[partIdx + 1];
  if (pp.status !== 'open' && next && next.kind !== 'choice') focusSel = next.kind === 'fields' ? `[data-field="${key}-${partIdx + 1}-0"]` : `[data-input="${key}-${partIdx + 1}"]`;
  if (key === 'P' && r.prog.every((p) => p.status !== 'open')) countStats();
  save();
  render();
}

function countStats() {
  const p = state.practice!;
  if (p.counted[p.index]) return;
  p.counted[p.index] = true;
  const q = p.questions[p.index];
  const firstTry = p.prog[p.index].every((x) => x.status === 'correct' && x.attempts === 0);
  addStat(q.topic, firstTry);
}
function addStat(topic: TopicId, ok: boolean) {
  const s = state.stats[topic] ?? { seen: 0, firstTry: 0, wrong: 0 };
  s.seen += 1;
  if (ok) s.firstTry += 1; else s.wrong += 1;
  state.stats[topic] = s;
}

/* ================================================================== rendering helpers */

const btn = (act: string, label: string, cls = 'btn', extra = '') => `<button type="button" class="${cls}" data-act="${act}" ${extra}>${label}</button>`;
const arrowL = '<span class="arr" aria-hidden="true">←</span>';

function header(title: string, back: string | null = 'home', icon = '') {
  return `<header class="top">${back ? btn(back === 'home' ? 'home' : back, `<span aria-hidden="true">→</span> ${back === 'home' ? 'לבית' : 'חזרה'}`, 'btn-back') : ''}<div class="top-title">${icon}<span>${title}</span></div></header>`;
}

function progressBar(i: number, n: number, label = 'שאלה') {
  return `<div class="progress" aria-live="polite"><div class="progress-text">${label} ${i + 1} מתוך ${n}</div><div class="bar" role="progressbar" aria-valuemin="1" aria-valuemax="${n}" aria-valuenow="${i + 1}"><span style="width:${((i + 1) / n) * 100}%"></span></div></div>`;
}

const GEO: TopicId[] = ['angles', 'polygons', 'triangles'];

function questionHead(q: Question) {
  const geo = GEO.includes(q.topic);
  return `<div class="q-prompt">${q.prompt}</div>` +
    (q.math ? `<div class="q-math${q.math.length > 17 ? ' q-math-long' : ''}" dir="ltr">${renderBlank(esc(q.math))}</div>` : '') +
    (q.figure ? `<div class="q-figure${geo ? ' q-figure-part' : ''}">${q.figure}</div>` : '') +
    (geo ? `<div class="part-note">${puzzleIcon(22)}<span>${q.figure ? 'חלק פאזל מהמועדון' : 'מצאי את חלק הפאזל הנכון'}</span></div>` : '');
}

function choiceGridClass(q: Question, pi: number) {
  const cs = q.parts[pi].choices ?? [];
  if (cs.some((c) => c.isFigure && c.html.includes('class="grp"'))) return 'choices choices-fig choices-1';
  if (cs.some((c) => c.isFigure)) return 'choices choices-fig';
  if (cs.some((c) => c.text.length > 13)) return 'choices choices-1';
  if (cs.length === 3) return cs.every((c) => c.text.length <= 6) ? 'choices choices-3' : 'choices choices-1';
  return cs.length <= 2 ? 'choices choices-2' : 'choices';
}

function inputAttrs(kind: 'number' | 'text'): string {
  return kind === 'number'
    ? 'type="text" inputmode="numeric" pattern="[0-9]*" data-numeric="1" dir="ltr"'
    : 'type="text" inputmode="text" lang="he" dir="rtl" autocapitalize="off" autocorrect="off" spellcheck="false"';
}

/** number (or old text) answer box + the short instruction under it */
function answerBox(part: Part, attrs: string, value = ''): string {
  const kind = part.kind === 'text' ? 'text' : 'number';
  const hintId = attrs.match(/data-(?:input|exam-input)="([^"]+)"/)?.[1] ?? '';
  return `<div class="answer-box"><div class="num-form-row"><input class="num-input${kind === 'text' ? ' text-input' : ''}" ${inputAttrs(kind)} ${attrs} enterkeyhint="done" autocomplete="off" aria-label="התשובה שלך" ${part.fieldHint ? `aria-describedby="fh-${esc(hintId)}"` : ''} value="${esc(value)}" />${part.suffix ? `<span class="suffix">${part.suffix}</span>` : ''}</div>${part.fieldHint ? `<div class="field-hint" id="fh-${esc(hintId)}">${part.fieldHint}</div>` : ''}</div>`;
}

/**
 * notebook rows: [ box ] label — box first, in Hebrew reading order.
 * An empty box and a wrong digit are two different states with their own message.
 */
function fieldRows(part: Part, values: string[], attr: (i: number) => string, st: { bad?: boolean[]; locked?: boolean; reveal?: boolean } = {}): string {
  return `<div class="frows">${part.fields!.map((f, i) => {
    const bad = st.bad?.[i];
    const typed = values[i] ?? '';
    const v = st.reveal && bad ? f.answer : typed;
    let mark = '';
    if (st.locked) mark = bad ? `<span class="fmark fmark-bad">✗ התשובה: ${esc(f.answer)}</span>` : '<span class="fmark fmark-ok">✓ נכון</span>';
    else if (bad) mark = typed.trim() === '' ? '<span class="fmark fmark-empty">○ השורה ריקה</span>' : '<span class="fmark fmark-bad">✗ לתיקון</span>';
    const cls = bad ? (typed.trim() === '' && !st.locked ? ' frow-empty' : ' frow-bad') : st.locked ? ' frow-ok' : '';
    return `<div class="frow${cls}"><input class="num-input field-input" ${inputAttrs('number')} ${attr(i)} enterkeyhint="${i < part.fields!.length - 1 ? 'next' : 'done'}" autocomplete="off" aria-label="${f.label}" value="${esc(v)}" ${st.locked ? 'readonly' : ''} /><span class="flabel">${f.label}</span>${mark}</div>`;
  }).join('')}</div>`;
}

function feedbackGood(first: boolean, seed: string): string {
  // the puppy wags its tail or the kitten raises a paw
  const puppy = seed.length % 2 === 0;
  return `<div class="good" role="status">${friend(puppy ? 'puppy' : 'kitten', 'cheer', 58, puppy)}<div><b>${first ? 'נכון! כל הכבוד!' : 'נכון! הצלחת בניסיון השני.'}</b><span>${puppy ? 'הכלבלב מכשכש בזנב.' : 'החתלתולה מרימה כפה.'}</span></div></div>`;
}

/** Interactive question with hints (practice + lesson "עכשיו תורך") */
function renderRunner(q: Question, prog: PartProg[], key: string): string {
  let h = questionHead(q);
  const active = prog.findIndex((p) => p.status === 'open');
  const done = active === -1;
  const hinted = prog.some((p) => p.attempts > 0);
  q.parts.forEach((part, pi) => {
    if (!done && pi > active) return;
    const pp = prog[pi];
    h += `<div class="part" data-part-box="${pi}">`;
    if (part.prompt) h += `<div class="part-prompt">${part.prompt}</div>`;
    if (part.kind === 'number' || part.kind === 'text') {
      if (pp.status === 'open') {
        h += `<form class="num-form" data-key="${key}" data-part="${pi}" autocomplete="off">${answerBox(part, `data-input="${key}-${pi}"`)}<button type="submit" class="btn btn-primary">בדיקה</button></form>`;
      } else {
        const shown = part.kind === 'text' ? esc(part.answer) : `<b class="m" dir="ltr">${esc(part.answer)}</b>`;
        h += `<div class="num-result ${pp.status}" dir="rtl"><span class="mark" aria-hidden="true">${pp.status === 'correct' ? '✓' : '✗'}</span> ${pp.status === 'correct' ? 'נכון' : 'התשובה הנכונה'}: <b>${shown}</b>${part.suffix ? ' ' + part.suffix : ''}</div>`;
      }
    } else if (part.kind === 'fields') {
      const vals = pp.values ?? part.fields!.map(() => '');
      if (pp.status === 'open') {
        h += `<form class="fields-form" data-key="${key}" data-part="${pi}" autocomplete="off">${fieldRows(part, vals, (i) => `data-field="${key}-${pi}-${i}"`, { bad: pp.bad })}${part.fieldHint ? `<div class="field-hint">${part.fieldHint}</div>` : ''}<button type="submit" class="btn btn-primary btn-wide">בדיקה</button></form>`;
      } else {
        h += fieldRows(part, vals, (i) => `data-field-done="${i}"`, { bad: pp.status === 'failed' ? pp.bad : part.fields!.map(() => false), locked: true, reveal: pp.status === 'failed' });
      }
    } else {
      h += `<div class="${choiceGridClass(q, pi)}" role="group" aria-label="אפשרויות תשובה">`;
      for (const c of part.choices!) {
        const wasWrong = pp.wrong.includes(c.id);
        const isAns = c.id === part.answer;
        let cls = 'choice';
        let mark = '';
        if (wasWrong) { cls += ' wrong'; mark = '<span class="mark">✗ לא נכון</span>'; }
        if (pp.status !== 'open' && isAns) { cls += ' right'; mark = '<span class="mark">✓ נכון</span>'; }
        const disabled = pp.status !== 'open' || wasWrong;
        h += `<button type="button" class="${cls}" data-act="choose" data-key="${key}" data-part="${pi}" data-choice="${c.id}" ${disabled ? 'disabled' : ''}><span class="choice-body">${c.html}</span>${mark}</button>`;
      }
      h += `</div>`;
    }
    if (pp.status === 'open' && (pp.attempts === 1 || (pp.attempts === 0 && pp.hintText))) {
      h += `<div class="hint" role="status">${friend('bunny', 'think', 48)}<div class="bubble"><b>${pp.attempts ? 'רמז' : 'שימי לב'}:</b> ${pp.hintText ?? part.hint}${pp.attempts ? '<div class="try-again">נסי שוב!</div>' : ''}</div></div>`;
    }
    if (pp.status !== 'open' && part.after) h += `<div class="after">${part.after}</div>`;
    if (pp.status === 'correct') h += feedbackGood(pp.attempts === 0, q.sig);
    h += `</div>`;
  });
  // a picture that gives the answer away appears only with the hint or after checking
  // (for the 4-box decomposition only after checking – it would show all four digits)
  if (q.hintFigure && (done || (hinted && !q.parts.some((p) => p.kind === 'fields')))) h += `<div class="hint-figure"><div class="hint-figure-label">${done ? 'ככה זה נראה:' : 'רמז בציור:'}</div>${q.hintFigure}</div>`;
  if (done) {
    const anyFail = prog.some((p) => p.status === 'failed');
    h += anyFail
      ? `<div class="explain" role="status">${friend('kitten', 'oops', 46)}<div><b>פתרון מוסבר:</b> ${q.explanation}</div></div>`
      : `<details class="explain-more"><summary>איך פותרים?</summary><div>${q.explanation}</div></details>`;
  }
  return h;
}

/* ================================================================== screens */

function daysToExam(): number {
  const exam = new Date(2026, 11, 3);
  const now = new Date();
  const d0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((exam.getTime() - d0.getTime()) / 86400000);
}

function homeView(): string {
  const d = daysToExam();
  let resume = '';
  const p = state.practice;
  if (p && !p.finished) {
    const what = p.mode === 'topic' ? topicById(p.topic!).name : 'תרגול מעורב';
    resume += `<button class="resume" data-act="continue-practice"><span class="resume-dot" aria-hidden="true">▶</span><span><b>להמשיך מאיפה שעצרת</b><small>${what} · שאלה ${p.index + 1} מתוך ${p.questions.length}</small></span></button>`;
  }
  if (state.exam && !state.exam.submitted) {
    const done = state.exam.questions.filter((q, i) => q.parts.every((pp, pi) => isFilled(pp, state.exam!.answers[i][pi]))).length;
    resume += `<button class="resume" data-act="continue-exam"><span class="resume-dot" aria-hidden="true">▶</span><span><b>להמשיך את המבחן לדוגמה</b><small>ענית על ${done} מתוך ${state.exam.questions.length}</small></span></button>`;
  }
  const weak = TOPICS.filter((t) => (state.stats[t.id]?.wrong ?? 0) > 0)
    .sort((a, b) => (state.stats[b.id]!.wrong / state.stats[b.id]!.seen) - (state.stats[a.id]!.wrong / state.stats[a.id]!.seen)).slice(0, 3);
  const mode = (act: string, icon: string, title: string, sub: string) =>
    `<button class="card mode" data-act="${act}">${icon}<span class="mode-text"><b>${title}</b><small>${sub}</small></span><span class="mode-go" aria-hidden="true">←</span></button>`;
  return `<main class="screen home">
    <div class="home-head">
      <h1 class="app-title">המתמטיקה של נועה</h1>
      <span class="countdown">${d > 0 ? `עוד ${d} ימים למבחן · יום חמישי 3.12` : d === 0 ? 'היום המבחן – בהצלחה!' : 'בהצלחה בהמשך!'}</span>
    </div>
    ${homeScene()}
    <p class="hello-text">שלום נועה! ברוכה הבאה למועדון החיות. במה נתרגל היום?</p>
    ${resume}
    <nav class="modes" aria-label="דרכי תרגול">
      ${mode('topics', modeIcon('topics'), 'תרגול לפי נושא', 'הסבר, דוגמה ו־6 שאלות')}
      ${mode('start-mixed', modeIcon('mixed'), 'תרגול מעורב', `${CONFIG.mixedLength} שאלות מכל הנושאים, יותר ממה שקשה לך`)}
      ${mode('start-exam', modeIcon('exam'), 'מבחן לדוגמה', 'כל נושאי המבחן, פתרונות בסוף')}
    </nav>
    ${weak.length ? `<section class="weak"><h2>כדאי לחזק</h2><div class="chips">${weak.map((t) => btn('open-topic', `${topicIcon(t.id, 22)}<span>${t.name}</span>`, 'chip', `data-topic="${t.id}"`)).join('')}</div></section>` : ''}
  </main>`;
}

function topicsView(): string {
  const group = (area: 'numbers' | 'geometry', title: string) =>
    `<h2 class="group-title">${title}</h2><div class="topic-list">` +
    TOPICS.filter((t) => t.area === area).map((t) => {
      const s = state.stats[t.id];
      const badge = s && s.seen ? `${s.firstTry} מתוך ${s.seen} בניסיון ראשון` : 'עוד לא תרגלת';
      return `<button class="topic" data-act="open-topic" data-topic="${t.id}">${topicIcon(t.id, 38)}<span class="topic-text"><b>${t.name}</b><small class="topic-stat">${badge}</small></span><span class="mode-go" aria-hidden="true">←</span></button>`;
    }).join('') + `</div>`;
  return `${header('תרגול לפי נושא')}<main class="screen"><p class="lead">בחרי נושא. לפני התרגול יש הסבר קצר ודוגמה.</p>${group('numbers', 'מספרים ופעולות')}${group('geometry', 'גיאומטריה')}</main>`;
}

/** lesson = steps: for every skill an example screen, then a "עכשיו תורך" screen */
function lessonSteps(topic: TopicId) {
  const L = getLesson(topic);
  return L.skills.flatMap((s, i) => [{ skill: i, kind: 'ex' as const, s }, { skill: i, kind: 'try' as const, s }]);
}

function lessonView(topic: TopicId, from: 'topics' | 'practice' | 'results', stepIdx: number): string {
  const t = topicById(topic);
  const steps = lessonSteps(topic);
  const st = steps[Math.min(stepIdx, steps.length - 1)];
  const multi = steps.length > 2;
  const p = state.practice;
  const primary = from === 'practice' && p
    ? btn('back-to-practice', `חזרה לתרגול (שאלה ${p.index + 1}) ${arrowL}`, 'btn btn-primary btn-sm')
    : btn('start-topic', `ישר לתרגול ${arrowL}`, 'btn btn-primary btn-sm', `data-topic="${topic}"`);
  const backAct = from === 'practice' ? 'back-to-practice' : from === 'results' ? 'back-to-results' : 'topics';
  const dots = `<nav class="steps-nav" aria-label="שלבי ההסבר">${steps.map((x, i) =>
    `<button class="step-dot${i === stepIdx ? ' current' : ''}" data-act="lesson-step" data-step="${i}" aria-label="${x.kind === 'ex' ? 'דוגמה' : 'עכשיו תורך'}${multi ? ` – ${x.s.title}` : ''}" ${i === stepIdx ? 'aria-current="step"' : ''}>${x.kind === 'ex' ? 'דוגמה' : 'תורך'}${multi ? ` ${x.skill + 1}` : ''}</button>`).join('')}</nav>`;
  let h = `${header(t.name, backAct, topicIcon(topic, 28))}<main class="screen lesson">
    <div class="lesson-bar"><h1 class="lesson-title">איך עושים את זה?</h1><div class="lesson-top">${primary}</div></div>
    ${dots}`;
  const s = st.s;
  if (st.kind === 'ex') {
    h += `<section class="ex" aria-label="דוגמה פתורה">
      <h2 class="skill-title">${multi ? `${st.skill + 1}. ` : ''}${s.title}</h2>
      <p class="skill-explain">${s.explain}</p>
      <div class="example"><div class="example-label">דוגמה פתורה</div>
        <div class="example-task">${s.example.task}</div>
        ${s.example.figure ? `<div class="q-figure">${s.example.figure}</div>` : ''}
        <ol class="steps">${s.example.steps.map((x) => `<li>${x}</li>`).join('')}</ol>
        <div class="example-answer">${s.example.answer}</div>
      </div>
      <div class="step-buttons">${btn('lesson-step', `עכשיו תורך ${arrowL}`, 'btn btn-primary btn-wide', `data-step="${stepIdx + 1}"`)}</div>
    </section>`;
  } else {
    const key = `L:${topic}:${st.skill}`;
    const prog = state.lessonTry[key] ?? newProg(s.tryIt);
    const done = prog.every((x) => x.status !== 'open');
    const last = stepIdx === steps.length - 1;
    h += `<section class="your-turn" data-runner="${key}" aria-label="עכשיו תורך">
      <div class="your-turn-label">${friend('bunny', 'happy', 36)}<span>עכשיו תורך${multi ? ` · ${s.title}` : ''}</span></div>
      ${renderRunner(s.tryIt, prog, key)}
      <div class="step-buttons">
        ${btn('lesson-step', '→ לדוגמה', 'btn', `data-step="${stepIdx - 1}"`)}
        ${done ? btn('retry-lesson', 'לנסות שוב', 'btn', `data-key="${key}"`) : ''}
        ${done && !last ? btn('lesson-step', `לחלק הבא ${arrowL}`, 'btn btn-primary', `data-step="${stepIdx + 1}"`) : ''}
        ${done && last ? primary.replace('btn-sm', '') : ''}
      </div>
    </section>`;
  }
  h += `</main>`;
  return h;
}

function practiceView(): string {
  const p = state.practice!;
  const q = p.questions[p.index];
  const prog = p.prog[p.index];
  const done = prog.every((x) => x.status !== 'open');
  const last = p.index === p.questions.length - 1;
  const title = p.mode === 'topic' ? topicById(p.topic!).name : 'תרגול מעורב';
  return `${header(title, 'home', p.mode === 'topic' ? topicIcon(p.topic!, 28) : modeIcon('mixed', 28))}<main class="screen practice">
    ${progressBar(p.index, p.questions.length)}
    <div class="q-tools">${p.mode === 'mixed' ? `<span class="tag">${topicIcon(q.topic, 20)}${topicById(q.topic).name}</span>` : '<span></span>'}
      ${btn('lesson-from-practice', p.mode === 'topic' ? 'להסבר ולדוגמה' : 'להסבר', 'btn-link')}</div>
    <div class="q-card" data-runner="P">${renderRunner(q, prog, 'P')}</div>
    ${done ? `<div class="next-row">${btn('next-q', `${last ? 'לסיכום' : 'לשאלה הבאה'} ${arrowL}`, 'btn btn-primary btn-wide')}</div>` : ''}
  </main>`;
}

function summaryView(): string {
  const p = state.practice!;
  const res = p.prog.map((pr) => pr.every((x) => x.status === 'correct') ? (pr.every((x) => x.attempts === 0) ? 'first' : 'second') : 'fail');
  const first = res.filter((r) => r === 'first').length;
  const ok = res.filter((r) => r !== 'fail').length;
  const n = p.questions.length;
  const msg = first === n ? 'מושלם!' : ok >= n - 1 ? 'עבודה יפה מאוד!' : 'כל תרגול מקדם אותך!';
  return `${header('סיכום הסבב')}<main class="screen summary">
    <div class="result-hero">${friend('puppy', ok >= n - 1 ? 'cheer' : 'wave', 84, true)}<div><div class="big-score">${msg}</div>
    <p class="score-line">ענית נכון על <b>${ok}</b> מתוך <b>${n}</b> שאלות${first < ok ? ` (${first} בניסיון הראשון)` : ''}.</p></div></div>
    <ol class="sum-list">${p.questions.map((q, i) => `<li class="sum-${res[i]}"><span class="mark">${res[i] === 'fail' ? '✗' : '✓'}</span><span>${topicById(q.topic).name}${res[i] === 'second' ? ' · בניסיון השני' : res[i] === 'fail' ? ' · כדאי לחזור על זה' : ''}</span></li>`).join('')}</ol>
    <div class="col">
      ${btn('again', 'סבב נוסף', 'btn btn-primary btn-wide')}
      ${p.mode === 'topic' ? btn('open-topic', 'להסבר ולדוגמה', 'btn btn-wide', `data-topic="${p.topic}"`) : ''}
      ${btn('home', 'למסך הבית', 'btn btn-wide')}
    </div></main>`;
}

function examView(): string {
  const e = state.exam!;
  const q = e.questions[e.index];
  const n = e.questions.length;
  const answered = (i: number) => e.questions[i].parts.every((p, pi) => isFilled(p, e.answers[i][pi]));
  if (e.confirm) {
    const missing = e.answers.map((_, i) => i).filter((i) => !answered(i));
    return `${header('מבחן לדוגמה', null, modeIcon('exam', 28))}<main class="screen"><div class="confirm">
      ${friend('bunny', 'think', 66, true)}
      <h2>להגיש את המבחן?</h2>
      ${missing.length ? `<p>עוד לא ענית על ${missing.length === 1 ? 'שאלה' : 'השאלות'}: ${missing.map((i) => i + 1).join(', ')}.</p>` : '<p>ענית על כל השאלות. אחרי ההגשה תראי את התוצאות והפתרונות.</p>'}
      <div class="col">${btn('exam-submit-yes', 'כן, להגיש', 'btn btn-primary btn-wide')}${btn('exam-cancel', 'לא, אני רוצה לחזור לשאלות', 'btn btn-wide')}</div></div></main>`;
  }
  let h = `${header('מבחן לדוגמה', 'home', modeIcon('exam', 28))}<main class="screen exam">
    ${progressBar(e.index, n)}
    <nav class="exam-nav" aria-label="מעבר בין שאלות">${e.questions.map((_, i) =>
      `<button class="qchip${i === e.index ? ' current' : ''}${answered(i) ? ' answered' : ''}" data-act="exam-go" data-i="${i}" aria-label="שאלה ${i + 1}${answered(i) ? ', נענתה' : ''}">${i + 1}</button>`).join('')}</nav>
    <p class="exam-note">אפשר לחזור לכל שאלה ולשנות תשובה. הפתרונות יוצגו אחרי ההגשה.</p>
    <div class="q-card">${questionHead(q)}`;
  q.parts.forEach((part, pi) => {
    const val = e.answers[e.index][pi];
    h += `<div class="part">${part.prompt ? `<div class="part-prompt">${part.prompt}</div>` : ''}`;
    if (part.kind === 'number' || part.kind === 'text') {
      h += `<div class="num-form">${answerBox(part, `data-exam-input="${pi}"`, val)}</div>`;
    } else if (part.kind === 'fields') {
      h += fieldRows(part, splitFields(val, part.fields!.length), (i) => `data-exam-field="${pi}:${i}"`) + (part.fieldHint ? `<div class="field-hint">${part.fieldHint}</div>` : '');
    } else {
      h += `<div class="${choiceGridClass(q, pi)}" role="group" aria-label="אפשרויות תשובה">` + part.choices!.map((c) =>
        `<button type="button" class="choice${val === c.id ? ' selected' : ''}" aria-pressed="${val === c.id}" data-act="exam-choose" data-part="${pi}" data-choice="${c.id}"><span class="choice-body">${c.html}</span>${val === c.id ? '<span class="mark">● נבחר</span>' : ''}</button>`).join('') + `</div>`;
    }
    h += `</div>`;
  });
  h += `</div><div class="exam-buttons">
      ${e.index > 0 ? btn('exam-prev', '→ הקודמת', 'btn') : '<span></span>'}
      ${e.index < n - 1 ? btn('exam-next', `הבאה ${arrowL}`, 'btn btn-primary') : btn('exam-submit', 'להגשת המבחן', 'btn btn-primary')}
    </div>
    ${e.index < n - 1 ? `<div class="submit-row">${btn('exam-submit', 'להגשת המבחן', 'btn-link')}</div>` : ''}
  </main>`;
  return h;
}

function examTopicRows(e: Exam) {
  const rows: { topic: TopicId; ok: number; total: number }[] = [];
  for (const t of TOPICS) {
    const idx = e.questions.map((q, i) => (q.topic === t.id ? i : -1)).filter((i) => i >= 0);
    if (idx.length) rows.push({ topic: t.id, ok: idx.filter((i) => e.correct![i]).length, total: idx.length });
  }
  return rows;
}

function examResultsView(): string {
  const e = state.exam!;
  const ok = e.correct!.filter(Boolean).length;
  const n = e.questions.length;
  const pct = Math.round((ok / n) * 100);
  return `${header('תוצאות המבחן')}<main class="screen results">
    <div class="result-hero">${friend('kitten', pct >= 70 ? 'cheer' : 'wave', 84, true)}<div><div class="big-score">${ok} מתוך ${n} <small>(${pct}%)</small></div>
    <p class="score-line">${pct >= 90 ? 'מצוין! את מוכנה.' : pct >= 70 ? 'יפה מאוד! עוד קצת תרגול בנושאים המסומנים.' : 'כדאי לתרגל את הנושאים המסומנים – את יכולה!'}</p></div></div>
    <table class="by-topic"><caption>תוצאה לפי נושא</caption><thead><tr><th>נושא</th><th>נכון</th><th><span class="sr">פעולות</span></th></tr></thead><tbody>
    ${examTopicRows(e).map((r) => `<tr class="${r.ok < r.total ? 'has-mistakes' : 'all-ok'}"><td><span class="row-topic">${topicIcon(r.topic, 24)}${topicById(r.topic).name}</span></td>
      <td class="nowrap score-cell">${r.ok < r.total ? '✗' : '✓'} ${r.ok}/${r.total}</td>
      <td class="row-actions">${r.ok < r.total ? btn('results-practice', 'תרגול נוסף', 'btn btn-small btn-primary', `data-topic="${r.topic}"`) : ''}${btn('results-lesson', 'הסבר', 'btn btn-small', `data-topic="${r.topic}"`)}</td></tr>`).join('')}
    </tbody></table>
    <div class="col">${btn('review', 'לצפייה בפתרונות', 'btn btn-primary btn-wide')}${btn('start-exam', 'מבחן חדש', 'btn btn-wide')}${btn('home', 'למסך הבית', 'btn btn-wide')}</div>
  </main>`;
}

function answerHtml(q: Question, pi: number, val: string): string {
  const part = q.parts[pi];
  if (!val || (part.kind === 'fields' && !val.replace(/\|/g, '').trim())) return '<i>לא נענתה</i>';
  if (part.kind === 'number') return `<b class="m" dir="ltr">${esc(val)}</b>`;
  if (part.kind === 'text') return `<b>${esc(val)}</b>`;
  if (part.kind === 'fields') {
    const vs = splitFields(val, part.fields!.length);
    return part.fields!.map((f, i) => `<span class="nowrap"><b>${esc(vs[i] || '–')}</b> ${f.label}</span>`).join(', ');
  }
  const c = part.choices!.find((x) => x.id === val);
  return c ? `<span class="ans-choice">${c.html}</span>` : '';
}

function reviewView(): string {
  const e = state.exam!;
  return `${header('פתרונות המבחן', 'back-to-results')}<main class="screen review">
  ${e.questions.map((q, i) => `<article class="rev ${e.correct![i] ? 'rev-ok' : 'rev-bad'}">
    <h2><span class="mark">${e.correct![i] ? '✓ נכון' : '✗ לא נכון'}</span> שאלה ${i + 1} · ${topicById(q.topic).name}</h2>
    ${questionHead(q)}
    ${q.parts.map((part, pi) => `<div class="rev-part">${part.prompt ? `<div class="part-prompt">${part.prompt}</div>` : ''}
      <div>התשובה שלך: ${answerHtml(q, pi, e.answers[i][pi])} ${isCorrectAnswer(q, pi, e.answers[i][pi]) ? '✓' : '✗'}</div>
      ${isCorrectAnswer(q, pi, e.answers[i][pi]) ? '' : `<div>התשובה הנכונה: ${answerHtml(q, pi, part.answer)}</div>`}</div>`).join('')}
    <div class="explain"><div><b>פתרון מוסבר:</b> ${q.explanation}</div></div>
  </article>`).join('')}
  <div class="col">${btn('back-to-results', 'חזרה לתוצאות', 'btn btn-primary btn-wide')}</div></main>`;
}

/* ================================================================== render + events */

export function render() {
  const s = state.screen;
  let html = '';
  switch (s.name) {
    case 'home': html = homeView(); break;
    case 'topics': html = topicsView(); break;
    case 'lesson': html = lessonView(s.topic, s.from, s.step ?? 0); break;
    case 'practice': html = state.practice ? practiceView() : homeView(); break;
    case 'summary': html = state.practice ? summaryView() : homeView(); break;
    case 'exam': html = state.exam ? examView() : homeView(); break;
    case 'examResults': html = state.exam?.correct ? examResultsView() : homeView(); break;
    case 'review': html = state.exam?.correct ? reviewView() : homeView(); break;
  }
  root.innerHTML = html;
  for (const [id, place] of openBays) {
    const bay = root.querySelector<HTMLElement>(`[data-cargo-id="${id}"] [data-act=bay][data-place="${place}"]`);
    if (bay) openBay(bay);
  }
  if (scrollTop) { window.scrollTo(0, 0); scrollTop = false; }
  if (focusSel) {
    const el = root.querySelector<HTMLInputElement>(focusSel);
    if (el) { el.focus({ preventScroll: true }); el.scrollIntoView({ block: 'center' }); }
    focusSel = null;
  }
}

function onClick(ev: Event) {
  const el = (ev.target as HTMLElement).closest<HTMLElement>('[data-act]');
  if (!el || (el as HTMLButtonElement).disabled) return;
  const act = el.dataset.act!;
  const topic = el.dataset.topic as TopicId | undefined;
  const e = state.exam;
  switch (act) {
    case 'home': go({ name: 'home' }); break;
    case 'topics': go({ name: 'topics' }); break;
    case 'open-topic': go({ name: 'lesson', topic: topic!, from: 'topics' }); break;
    case 'start-topic': startTopic(topic!); break;
    case 'start-mixed': startMixed(); break;
    case 'start-exam': startExam(); break;
    case 'continue-practice': go({ name: state.practice?.finished ? 'summary' : 'practice' }); break;
    case 'continue-exam': go({ name: 'exam' }); break;
    case 'lesson-from-practice': go({ name: 'lesson', topic: state.practice!.questions[state.practice!.index].topic, from: 'practice' }); break;
    case 'back-to-practice': go({ name: 'practice' }); break;
    case 'back-to-results': go({ name: 'examResults' }); break;
    case 'choose': answer(el.dataset.key!, Number(el.dataset.part), el.dataset.choice!); break;
    case 'bay': openBay(el); break;
    case 'lesson-step': {
      const sc = state.screen;
      if (sc.name === 'lesson') { const n = lessonSteps(sc.topic).length; go({ ...sc, step: Math.max(0, Math.min(n - 1, Number(el.dataset.step))) }); }
      break;
    }
    case 'retry-lesson': delete state.lessonTry[el.dataset.key!]; save(); render(); break;
    case 'next-q': {
      const p = state.practice!;
      if (p.index < p.questions.length - 1) { p.index += 1; go({ name: 'practice' }); }
      else { p.finished = true; go({ name: 'summary' }); }
      break;
    }
    case 'again': state.practice!.mode === 'topic' ? startTopic(state.practice!.topic!) : startMixed(); break;
    case 'exam-choose': e!.answers[e!.index][Number(el.dataset.part)] = el.dataset.choice!; save(); render(); break;
    case 'exam-go': e!.index = Number(el.dataset.i); go({ name: 'exam' }); break;
    case 'exam-prev': e!.index -= 1; go({ name: 'exam' }); break;
    case 'exam-next': e!.index += 1; go({ name: 'exam' }); break;
    case 'exam-submit': e!.confirm = true; go({ name: 'exam' }); break;
    case 'exam-cancel': e!.confirm = false; go({ name: 'exam' }); break;
    case 'exam-submit-yes': {
      e!.confirm = false;
      e!.submitted = true;
      e!.correct = e!.questions.map((q, i) => q.parts.every((_, pi) => isCorrectAnswer(q, pi, e!.answers[i][pi])));
      e!.questions.forEach((q, i) => addStat(q.topic, e!.correct![i]));
      go({ name: 'examResults' });
      break;
    }
    case 'results-practice': startTopic(topic!); break;
    case 'results-lesson': go({ name: 'lesson', topic: topic!, from: 'results' }); break;
    case 'review': go({ name: 'review' }); break;
  }
}

function onSubmit(ev: Event) {
  const ff = (ev.target as HTMLElement).closest<HTMLFormElement>('form.fields-form');
  if (ff) {
    ev.preventDefault();
    const vals = [...ff.querySelectorAll<HTMLInputElement>('input[data-field]')].map((i) => i.value.trim());
    answer(ff.dataset.key!, Number(ff.dataset.part), vals.join('|'));
    return;
  }
  const form = (ev.target as HTMLElement).closest<HTMLFormElement>('form.num-form');
  if (!form) return;
  ev.preventDefault();
  const input = form.querySelector<HTMLInputElement>('input')!;
  answer(form.dataset.key!, Number(form.dataset.part), input.value);
}

function onInput(ev: Event) {
  const t = ev.target as HTMLInputElement;
  if (t.dataset.numeric) {
    // numeric boxes keep digits only (the numeric keyboard may still allow other characters)
    const clean = t.value.replace(/[^\d]/g, '');
    if (clean !== t.value) t.value = clean;
  }
  const e = state.exam;
  if (t.dataset.examInput !== undefined && e) {
    e.answers[e.index][Number(t.dataset.examInput)] = t.value;
  } else if (t.dataset.examField !== undefined && e) {
    const [pi, i] = t.dataset.examField.split(':').map(Number);
    const part = e.questions[e.index].parts[pi];
    const vs = splitFields(e.answers[e.index][pi], part.fields!.length);
    vs[i] = t.value;
    e.answers[e.index][pi] = vs.join('|');
  } else if (t.dataset.field) {
    // keep what Noa typed in the decomposition boxes (survives leaving the screen)
    const [key, pi, i] = splitKey(t.dataset.field);
    const r = runnerFor(key);
    if (r) {
      const part = r.q.parts[pi];
      const pp = r.prog[pi];
      pp.values = pp.values ?? part.fields!.map(() => '');
      pp.values[i] = t.value;
    }
  } else return;
  save();
  if (e && (t.dataset.examInput !== undefined || t.dataset.examField !== undefined)) {
    const q = e.questions[e.index];
    root.querySelector(`.qchip[data-i="${e.index}"]`)?.classList.toggle('answered', q.parts.every((p, pi) => isFilled(p, e.answers[e.index][pi])));
  }
}

/** "L:digitValue:0-0-2" → ["L:digitValue:0", 0, 2] */
function splitKey(s: string): [string, number, number] {
  const m = s.match(/^(.*)-(\d+)-(\d+)$/)!;
  return [m[1], Number(m[2]), Number(m[3])];
}

function openBay(el: HTMLElement) {
  const cargo = el.closest('.cargo');
  if (!cargo) return;
  cargo.querySelectorAll('.bay').forEach((b) => { b.classList.remove('bay-open'); b.setAttribute('aria-pressed', 'false'); });
  el.classList.add('bay-open');
  el.setAttribute('aria-pressed', 'true');
  const panel = cargo.querySelector('.bay-packs');
  if (panel) panel.innerHTML = packs(Number(el.dataset.digit), Number(el.dataset.place));
  const id = (cargo as HTMLElement).dataset.cargoId;
  if (id) openBays.set(id, el.dataset.place!);
}

export function mount(el: HTMLElement) {
  root = el;
  root.addEventListener('click', onClick);
  root.addEventListener('submit', onSubmit);
  root.addEventListener('input', onInput);
  render();
}
