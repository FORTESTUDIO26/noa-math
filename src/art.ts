/**
 * Original illustrations in one style: navy outlines, cream / teal / mango / coral fills.
 * Topic icons, practice-mode icons and the home-screen space-station scene.
 */
import type { TopicId } from './types';
import { friendAt, ball } from './club';

const wrap = (body: string, size = 40, label = '') =>
  `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 40 40" ${label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"'} focusable="false">${body}</svg>`;

const ICONS: Record<TopicId, string> = {
  placeValue: '<rect x="5" y="12" width="13" height="13" rx="2" class="i-mango"/><rect x="21" y="12" width="13" height="13" rx="2" class="i-teal"/><rect x="5" y="27" width="29" height="7" rx="2" class="i-cream"/><path d="M5 18.5h13M11.5 12v13" class="i-line-thin"/>',
  digitValue: '<rect x="7" y="6" width="26" height="28" rx="6" class="i-cream"/><text x="20" y="27" class="i-digit">7</text><path d="M14 34 l6 -5 l6 5" class="i-coral-line"/>',
  prevNext: '<path d="M6 20 h28" class="i-line"/><circle cx="20" cy="20" r="5" class="i-mango"/><path d="M12 14 l-6 6 l6 6 M28 14 l6 6 l-6 6" class="i-line"/>',
  evenOdd: '<circle cx="12" cy="13" r="4.5" class="i-teal"/><circle cx="12" cy="27" r="4.5" class="i-teal"/><circle cx="27" cy="13" r="4.5" class="i-coral"/><circle cx="27" cy="27" r="4.5" class="i-cream"/>',
  multDiv: '<circle cx="20" cy="20" r="14" class="i-cream"/><path d="M13 13 l14 14 M27 13 l-14 14" class="i-line"/>',
  missing: '<rect x="8" y="8" width="24" height="24" rx="5" class="i-mango" stroke-dasharray="4 3"/><text x="20" y="27" class="i-digit">?</text>',
  numberLine: '<path d="M4 24 h32" class="i-line"/><path d="M33 20 l4 4 l-4 4" class="i-line"/><circle cx="9" cy="24" r="3.5" class="i-cream"/><circle cx="20" cy="24" r="3.5" class="i-coral"/><circle cx="31" cy="24" r="3.5" class="i-cream"/><path d="M10 17 q5 -7 10 0" class="i-teal-line"/>',
  sequences: '<rect x="4" y="25" width="9" height="9" rx="2" class="i-teal"/><rect x="15.5" y="18" width="9" height="16" rx="2" class="i-mango"/><rect x="27" y="10" width="9" height="24" rx="2" class="i-coral"/>',
  multMeaning: '<rect x="4" y="9" width="14" height="22" rx="4" class="i-cream"/><rect x="22" y="9" width="14" height="22" rx="4" class="i-cream"/><circle cx="11" cy="15" r="2.6" class="i-coral"/><circle cx="11" cy="24" r="2.6" class="i-coral"/><circle cx="29" cy="15" r="2.6" class="i-coral"/><circle cx="29" cy="24" r="2.6" class="i-coral"/>',
  wordProblems: '<path d="M6 9 h28 v18 h-15 l-7 6 v-6 h-6 z" class="i-cream"/><path d="M11 15 h18 M11 21 h12" class="i-line-thin"/>',
  angles: '<path d="M8 32 h26 M8 32 L26 9" class="i-line"/><path d="M17 32 a9 9 0 0 0 -3.5 -7" class="i-coral-line"/>',
  polygons: '<path d="M20 5 L35 16 L29 34 L11 34 L5 16 Z" class="i-teal"/>',
  triangles: '<path d="M20 6 L35 33 L5 33 Z" class="i-mango"/><path d="M10 19 l4 2 M30 19 l-4 2" class="i-line-thin"/>',
};

export function topicIcon(t: TopicId, size = 40): string {
  return wrap(ICONS[t], size);
}

export function puzzleIcon(size = 24): string {
  return wrap('<path d="M8 12 h7 a4 4 0 1 1 8 0 h7 v7 a4 4 0 1 0 0 8 v7 h-22 z" class="i-pink"/>', size);
}

export function modeIcon(kind: 'topics' | 'mixed' | 'exam', size = 44): string {
  const body = {
    topics: '<rect x="6" y="7" width="13" height="27" rx="3" class="i-teal"/><rect x="21" y="7" width="13" height="27" rx="3" class="i-mango"/><path d="M10 14 h5 M25 14 h5" class="i-line-thin"/>',
    mixed: '<circle cx="13" cy="14" r="7" class="i-coral"/><rect x="20" y="17" width="14" height="14" rx="3" class="i-teal"/><path d="M9 30 l5 -5 M22 8 l6 0" class="i-line"/>',
    exam: '<rect x="8" y="5" width="24" height="31" rx="4" class="i-cream"/><rect x="15" y="3" width="10" height="6" rx="2" class="i-mango"/><path d="M13 17 l3 3 l6 -6 M13 28 h14" class="i-line"/>',
  }[kind];
  return wrap(body, size);
}

/** Home scene for the current look (both are rendered; CSS shows the chosen one). */
export function homeScene(): string {
  return `<div class="th-club">${clubScene()}</div><div class="th-space">${spaceScene()}</div>`;
}

/** "מועדון החיות": the kitten peeks from the window, the puppy waits at the door, the bunny doll sits by the toy basket. */
export function clubScene(): string {
  return `<div class="scene" role="img" aria-label="מועדון החיות: חתלתולה בחלון, כלבלב בכניסה ובובת ארנבת ליד סל המשחקים">
  <svg viewBox="0 0 360 200" class="scene-svg" aria-hidden="true" focusable="false">
    <rect x="0" y="0" width="360" height="200" rx="24" class="sc-sky"/>
    <path d="M40 40 q8 -14 22 -8 q10 -10 22 2 q12 0 10 12 h-58 q-6 -4 4 -6 z" class="sc-cloud"/>
    <path d="M262 30 q6 -10 17 -6 q8 -8 17 1 q10 0 8 10 h-46 q-5 -3 4 -5 z" class="sc-cloud"/>
    <path d="M0 158 q90 -14 180 -4 q100 10 180 -6 v28 q0 24 -24 24 h-312 q-24 0 -24 -24 z" class="sc-grass"/>
    <rect x="96" y="70" width="176" height="104" rx="10" class="sc-wall"/>
    <path d="M84 76 L184 22 L284 76 Z" class="sc-roof" stroke-linejoin="round"/>
    <path d="M110 66 h148" class="sc-roof-scallop"/>
    <rect x="150" y="40" width="68" height="20" rx="10" class="sc-sign"/>
    <text x="184" y="55" class="sc-sign-text">מועדון</text>
    <rect x="112" y="88" width="62" height="50" rx="10" class="sc-window"/>
    ${friendAt('kitten', 'happy', 116, 90, 54, false, 'club')}
    <rect x="108" y="134" width="70" height="8" rx="4" class="sc-sill"/>
    <ellipse cx="132" cy="136" rx="6" ry="4" class="k-fur"/><ellipse cx="154" cy="136" rx="6" ry="4" class="k-fur"/>
    <path d="M112 92 q14 18 0 40 M174 92 q-14 18 0 40" class="sc-curtain"/>
    <path d="M200 174 v-58 q0 -20 22 -20 q22 0 22 20 v58 z" class="sc-door"/>
    <circle cx="236" cy="140" r="2.8" class="sc-knob"/>
    ${friendAt('puppy', 'wave', 192, 112, 66, true, 'club')}
    ${friendAt('bunny', 'happy', 20, 104, 70, true, 'club')}
    <path d="M82 160 h44 l-5 22 h-34 z" class="sc-basket"/>
    <path d="M86 166 h36 M88 173 h32" class="sc-basket-line"/>
    <circle cx="96" cy="154" r="9" class="sc-ball"/><path d="M87 154 h18" class="sc-ball-line"/>
    <rect x="108" y="146" width="13" height="13" rx="3" class="sc-block"/>
    <path d="M300 160 q4 -12 0 -24 M300 148 q8 -6 12 0 q-6 6 -12 0 M300 140 q-8 -6 -12 0 q6 6 12 0" class="sc-flower-stem"/>
    <circle cx="300" cy="134" r="5" class="sc-flower"/>
    <circle cx="322" cy="146" r="4" class="sc-flower sc-flower-2"/>
  </svg>
</div>`;
}

/** "כדורגל בחלל": a soccer pitch on the moon, astronauts in team kits, a ball with a trail of stars. */
export function spaceScene(): string {
  const stars = [[22, 22], [70, 14], [110, 40], [160, 18], [205, 34], [250, 14], [40, 64], [330, 92], [12, 100]]
    .map(([x, y], i) => `<path d="M${x} ${y - 4} l1.2 2.8 l2.8 1.2 l-2.8 1.2 l-1.2 2.8 l-1.2 -2.8 l-2.8 -1.2 l2.8 -1.2 z" class="ss-star${i % 3 === 0 ? ' ss-star-y' : ''}"/>`).join('');
  const trail = [[300, 84, 3.4], [286, 76, 2.8], [272, 70, 2.3], [259, 66, 1.9]]
    .map(([x, y, r]) => `<path d="M${x} ${y - r * 1.6} l${r * 0.45} ${r * 1.1} l${r * 1.15} ${r * 0.5} l${-r * 1.15} ${r * 0.5} l${-r * 0.45} ${r * 1.1} l${-r * 0.45} ${-r * 1.1} l${-r * 1.15} ${-r * 0.5} l${r * 1.15} ${-r * 0.5} z" class="ss-trail"/>`).join('');
  return `<div class="scene" role="img" aria-label="כדורגל בחלל: מגרש על הירח, אסטרונאוטים במדי קבוצה וכדור עם שובל של כוכבים">
  <svg viewBox="0 0 360 200" class="scene-svg" aria-hidden="true" focusable="false">
    <rect x="0" y="0" width="360" height="200" rx="24" class="ss-sky"/>
    ${stars}
    <circle cx="306" cy="38" r="22" class="ss-earth"/>
    <path d="M292 30 q8 -8 14 0 q4 8 -6 10 q-8 2 -8 -10 z M310 46 q8 -4 10 4 q-6 6 -10 -4 z" class="ss-land"/>
    <path d="M0 122 q70 -18 180 -10 q110 6 180 -6 v70 q0 24 -24 24 h-312 q-24 0 -24 -24 z" class="ss-moon"/>
    <ellipse cx="40" cy="176" rx="14" ry="4" class="ss-crater"/><ellipse cx="320" cy="170" rx="11" ry="3.4" class="ss-crater"/>
    <path d="M70 182 L290 182 L262 128 L98 128 Z" class="ss-pitch"/>
    <path d="M180 128 V182 M70 182 L290 182 L262 128 L98 128 Z" class="ss-lines"/>
    <ellipse cx="180" cy="154" rx="20" ry="8" class="ss-lines"/>
    <path d="M84 162 v-14 h14 v22" class="ss-goal"/>
    ${friendAt('puppy', 'wave', 50, 104, 64, true, 'space')}
    ${friendAt('kitten', 'happy', 146, 92, 72, true, 'space')}
    ${friendAt('bunny', 'happy', 262, 100, 66, true, 'space')}
    ${trail}
    ${ball(244, 64, 8)}
  </svg>
</div>`;
}
