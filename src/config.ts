/**
 * כל ההגדרות שאפשר לשנות במקום אחד.
 * Central settings — change here to adapt range, tables, shapes and round sizes.
 */
export const CONFIG = {
  /** "מספרים בתחום הרבבה" – the Part 1 volume title. Numbers go up to 10,000. */
  maxNumber: 10000,
  /** Times-table scope (1..timesTableMax × 1..timesTableMax). */
  timesTableMax: 10,
  /** Smallest divisor used in division / missing-number questions (never 0). */
  minDivisor: 2,
  /** How 4-digit numbers are written: "3,406". Use '' for "3406". */
  thousandsSeparator: ',',
  multSymbol: '×',
  divSymbol: ':',
  minusSymbol: '−',

  /** Polygons that appear (number of sides → Hebrew name). Add 7: 'משובע' if taught. */
  polygonNames: { 3: 'משולש', 4: 'מרובע', 5: 'מחומש', 6: 'משושה', 8: 'מתומן' } as Record<number, string>,

  /**
   * Angle types. The teacher's list has acute/right/obtuse.
   * The Ministry's grade-3 unit also mentions a straight angle (שטוחה) – set true to add it.
   */
  includeStraightAngle: false,

  /**
   * In Israeli school geometry an equilateral triangle is also isosceles.
   * When true, a single-choice question never offers "שווה־שוקיים" next to an equilateral triangle.
   */
  equilateralCountsAsIsosceles: true,

  /** Questions per topic round (levels go easy → harder). */
  topicRoundLevels: [1, 1, 2, 2, 3, 3] as (1 | 2 | 3)[],
  /** Questions in a mixed round. */
  mixedLength: 8,
  /** localStorage key */
  storageKey: 'noa-math-v1',
  /** How many recent question signatures to avoid repeating. */
  recentMemory: 80,
} as const;

export type ConfigType = typeof CONFIG;
