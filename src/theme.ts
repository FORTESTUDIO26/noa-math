/**
 * Two looks for the same app: "מועדון החיות" and "כדורגל בחלל".
 * Questions and lessons are theme-neutral; words that belong to a look are written as {{tokens}}
 * and resolved when the screen is drawn – so switching the look never changes a saved question.
 */
export type ThemeId = 'club' | 'space';

export const THEMES: { id: ThemeId; name: string; blurb: string }[] = [
  { id: 'club', name: 'מועדון החיות', blurb: 'חתלתולה, כלבלב ובובת ארנבת' },
  { id: 'space', name: 'כדורגל בחלל', blurb: 'מגרש על הירח ואסטרונאוטים' },
];

const WORDS: Record<string, Record<ThemeId, string>> = {
  items: { club: 'חטיפים', space: 'כדורים' },
  bowls: { club: 'קערות', space: 'שקים' },
  bowl: { club: 'קערה', space: 'שק' },
  sharer: { club: 'הכלבלב', space: 'השוער' },
  baskets: { club: 'סלים', space: 'חישוקים' },
  basket: { club: 'סל', space: 'חישוק' },
  drawer: { club: 'מגירה', space: 'ארונית' },
  drawerOf: { club: 'מגירת', space: 'ארונית' },
  theDrawer: { club: 'המגירה', space: 'הארונית' },
  drawers: { club: 'מגירות', space: 'ארוניות' },
  opener: { club: 'הארנבת', space: 'הקפטנית' },
  chest: { club: 'השידה של הארנבת', space: 'חדר ההלבשה של הקבוצה' },
  pathMarks: { club: 'אבני דריכה בשביל', space: 'סימונים על המגרש' },
  geoNote: { club: 'חלק פאזל מהמועדון', space: 'צורה מהמגרש על הירח' },
  geoPick: { club: 'מוצאים את חלק הפאזל הנכון', space: 'מוצאים את הצורה הנכונה מהמגרש' },
  cheerA: { club: 'הכלבלב מכשכש בזנב.', space: 'השוער קופץ משמחה.' },
  cheerB: { club: 'החתלתולה מרימה כפה.', space: 'החלוצה בועטת גול!' },
  welcome: { club: 'ברוכים הבאים למועדון החיות.', space: 'ברוכים הבאים למגרש הכדורגל על הירח.' },
  place: { club: 'המועדון', space: 'המגרש' },
};

export function themeText(html: string, theme: ThemeId): string {
  return html.replace(/\{\{(\w+)\}\}/g, (all, k: string) => WORDS[k]?.[theme] ?? all);
}

export const tokenNames = () => Object.keys(WORDS);
