import type { TopicId } from './types';

export interface TopicMeta { id: TopicId; name: string; area: 'numbers' | 'geometry'; icon: string; teacherItem: string }

/** The teacher's list – order and wording as given. */
export const TOPICS: TopicMeta[] = [
  { id: 'placeValue', name: 'מבנה עשרוני – פירוק והרכבה', area: 'numbers', icon: '🧱', teacherItem: 'מבנה עשרוני' },
  { id: 'digitValue', name: 'ערך הספרה במספר', area: 'numbers', icon: '🔢', teacherItem: 'ערך הספרה במספר' },
  { id: 'prevNext', name: 'מספר קודם ועוקב', area: 'numbers', icon: '↔️', teacherItem: 'מספר קודם ועוקב' },
  { id: 'evenOdd', name: 'זוגי ואי־זוגי', area: 'numbers', icon: '⚖️', teacherItem: 'מספר זוגי ואי־זוגי' },
  { id: 'multDiv', name: 'כפל וחילוק', area: 'numbers', icon: '✖️', teacherItem: 'כפל וחילוק' },
  { id: 'missing', name: 'השלמת מספר חסר', area: 'numbers', icon: '❓', teacherItem: 'השלמת מספר חסר בתרגילים' },
  { id: 'numberLine', name: 'ישר המספרים', area: 'numbers', icon: '📏', teacherItem: 'ישר המספרים' },
  { id: 'sequences', name: 'סדרות עולות ויורדות', area: 'numbers', icon: '📈', teacherItem: 'סדרות' },
  { id: 'multMeaning', name: 'משמעות הכפל', area: 'numbers', icon: '🍪', teacherItem: 'משמעות הכפל' },
  { id: 'wordProblems', name: 'בעיות מילוליות', area: 'numbers', icon: '📖', teacherItem: 'בעיות מילוליות' },
  { id: 'angles', name: 'סוגי זוויות', area: 'geometry', icon: '📐', teacherItem: 'סוגי זוויות' },
  { id: 'polygons', name: 'מצולעים ושמותיהם', area: 'geometry', icon: '⬟', teacherItem: 'הכרת מצולעים ושמותיהם' },
  { id: 'triangles', name: 'מיון משולשים לפי צלעות', area: 'geometry', icon: '🔺', teacherItem: 'מיון משולשים לפי צלעות' },
];

export const topicById = (id: TopicId) => TOPICS.find((t) => t.id === id)!;
