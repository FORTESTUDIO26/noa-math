import { describe, it, expect } from 'vitest';
import { Rng } from '../src/rng';
import { GENERATORS } from '../src/generators';
import { TOPICS } from '../src/topics';
import { buildLessons } from '../src/lessons';
import { homeScene, topicIcon } from '../src/art';
import { friend } from '../src/club';

const SPACE = /רובוט|רובי|חלל|חללית|מטען|כוכב/;
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

describe('"מועדון החיות של נועה" theme', () => {
  it('no space words or emoji in lessons and generated questions', () => {
    const lessons = JSON.stringify(buildLessons());
    expect(lessons).not.toMatch(SPACE);
    for (const t of TOPICS) for (const lv of [1, 2, 3] as const) {
      const rng = new Rng(lv * 13 + t.id.length);
      for (let i = 0; i < 60; i++) {
        const q = JSON.stringify(GENERATORS[t.id](rng, lv));
        expect(q, t.id).not.toMatch(SPACE);
        expect(q.replace(/[✓✗☐]/g, ''), t.id).not.toMatch(EMOJI); // ☐ is the blank box in an exercise
      }
    }
  });

  it('the home scene has the kitten, the puppy and the bunny', () => {
    const s = homeScene();
    for (const who of ['kitten', 'puppy', 'bunny']) expect(s).toContain(`friend-${who}`);
    expect(s).toContain('aria-label="מועדון החיות');
  });

  it('characters have expressions and every topic has its own drawn icon', () => {
    for (const mood of ['happy', 'cheer', 'think', 'oops', 'wave'] as const) for (const who of ['kitten', 'puppy', 'bunny'] as const) {
      expect(friend(who, mood)).toContain(`mood-${mood}`);
    }
    expect(new Set(TOPICS.map((t) => topicIcon(t.id))).size).toBe(TOPICS.length);
  });

  it('multiplication / division hints show the puppy sharing treats into bowls', () => {
    const rng = new Rng(4);
    let found = 0;
    for (let i = 0; i < 100; i++) {
      const q = GENERATORS.multDiv(rng, 1);
      if (q.hintFigure) { expect(q.hintFigure).toContain('friend-puppy'); expect(q.hintFigure).toContain('class="bowl"'); found++; }
    }
    expect(found).toBeGreaterThan(20);
  });
});
