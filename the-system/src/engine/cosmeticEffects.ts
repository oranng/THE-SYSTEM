import type { Cosmetic } from '../types';
import type { RankTheme } from '../theme/rankThemes';

/**
 * Visual effects of equipped cosmetics. Backgrounds tint the whole app
 * background; auras recolor the ambient embers + avatar glow. Both are applied
 * by overlaying onto the rank theme in one place (store.refresh), so every
 * screen that reads `currentTheme` picks them up automatically.
 */

// Equipped background → app background colour (dark tints to stay readable).
export const BACKGROUND_COLORS: Record<string, string> = {
  'Вулканические руины': '#241715',
  'Ледяной трон': '#141A24',
  'Цитадель пустыни': '#241F15',
  'Глубины океана': '#102126',
};

// Equipped aura → ember/glow colour.
export const AURA_COLORS: Record<string, string> = {
  'Багровая аура': '#D9534F',
  'Морозная аура': '#6CC6E0',
  'Теневая аура': '#9B8CCB',
  'Божественная аура': '#F0C419',
};

/** Overlay equipped background/aura cosmetics onto a base rank theme. */
export function applyCosmeticTheme(base: RankTheme, cosmetics: Cosmetic[]): RankTheme {
  let theme = base;
  const bg = cosmetics.find((c) => c.type === 'background' && c.equipped);
  const aura = cosmetics.find((c) => c.type === 'aura' && c.equipped);
  if (bg && BACKGROUND_COLORS[bg.name]) {
    theme = { ...theme, background: BACKGROUND_COLORS[bg.name] };
  }
  if (aura && AURA_COLORS[aura.name]) {
    theme = { ...theme, auraColor: AURA_COLORS[aura.name] };
  }
  return theme;
}
