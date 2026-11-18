import type { Question } from './types';

/** Returns a list of problems. Empty list = question is safe to show. */
export function validateQuestion(q: Question): string[] {
  const errs: string[] = [];
  const all = JSON.stringify(q);
  if (/NaN|undefined|Infinity|null/.test(all)) errs.push('bad token in question');
  if (!q.sig) errs.push('missing sig');
  if (!q.prompt) errs.push('missing prompt');
  if (!q.explanation) errs.push('missing explanation');
  if (!q.parts.length) errs.push('no parts');
  // division by zero in any arithmetic shown (q.math and inline math spans)
  const mathBits = [q.math ?? ''];
  for (const t of [q.explanation, q.prompt, ...q.parts.map((p) => p.hint)]) {
    for (const mm of t.matchAll(/<span class="m" dir="ltr">([\s\S]*?)<\/span>(?!<\/span>)/g)) mathBits.push(mm[1]);
  }
  for (const p of q.parts) mathBits.push(p.hint);
  for (const t of mathBits) if (/\d\s*:\s*0(?![\d,])/.test(t.replace(/<[^>]+>/g, ' '))) errs.push('division by zero: ' + t);
  for (const p of q.parts) {
    if (!p.hint) errs.push('missing hint');
    if (p.kind === 'number') {
      if (!/^\d+$/.test(p.answer)) errs.push('number answer not a non-negative integer: ' + p.answer);
    } else {
      const cs = p.choices ?? [];
      if (cs.length < 2) errs.push('fewer than 2 choices');
      const ids = new Set(cs.map((c) => c.id));
      if (ids.size !== cs.length) errs.push('duplicate choice ids');
      const texts2 = new Set(cs.map((c) => c.text));
      if (texts2.size !== cs.length) errs.push('duplicate choices');
      const htmls = new Set(cs.map((c) => c.html));
      if (htmls.size !== cs.length) errs.push('duplicate choice html');
      if (!ids.has(p.answer)) errs.push('answer not among choices');
    }
  }
  return errs;
}
