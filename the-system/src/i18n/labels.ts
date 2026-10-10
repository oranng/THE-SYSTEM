// Russian display labels for internal enum values. Internal codes stay in
// English (DB rows, logic and tests key off them); only the UI uses these.

export const TIER_LABELS: Record<string, string> = {
  BRONZE: 'БРОНЗА',
  SILVER: 'СЕРЕБРО',
  GOLD: 'ЗОЛОТО',
};

export const DIFFICULTY_LABELS: Record<string, string> = {
  EASY: 'ЛЕГКО',
  NORMAL: 'НОРМА',
  HARD: 'ТЯЖЕЛО',
  LEGENDARY: 'ЛЕГЕНДА',
};

export const ATTRIBUTE_LABELS: Record<string, string> = {
  Willpower: 'Воля',
  Strength: 'Сила',
  Vitality: 'Живучесть',
  Knowledge: 'Знание',
};

export const COSMETIC_TYPE_LABELS: Record<string, string> = {
  weapon: 'Оружие',
  armor: 'Броня',
  crown: 'Корона',
  title: 'Титул',
  background: 'Фон',
  accessory: 'Аксессуар',
  aura: 'Аура',
};

export const MOOD_LABELS: Record<string, string> = {
  radiant: 'Сияние',
  steady: 'Устойчивость',
  worn: 'Усталость',
  broken: 'Надлом',
};

/** Russian plural: plural(5, ['день', 'дня', 'дней']) → 'дней'. */
export function plural(n: number, forms: [string, string, string]): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}
