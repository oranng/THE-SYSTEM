import { applyCosmeticTheme, AURA_COLORS, BACKGROUND_COLORS } from '../../src/engine/cosmeticEffects';
import { getThemeForRank } from '../../src/theme/rankThemes';
import type { Cosmetic } from '../../src/types';

const cos = (over: Partial<Cosmetic>): Cosmetic => ({
  id: 1, type: 'aura', tier: 1, name: 'X', unlocked: 1, equipped: 1, unlocked_at: null, ...over,
});

const base = getThemeForRank('E');

describe('applyCosmeticTheme', () => {
  it('returns the base theme when nothing is equipped', () => {
    const t = applyCosmeticTheme(base, []);
    expect(t.background).toBe(base.background);
    expect(t.auraColor).toBe(base.auraColor);
  });

  it('overrides background colour for an equipped background', () => {
    const t = applyCosmeticTheme(base, [cos({ type: 'background', name: 'Глубины океана', equipped: 1 })]);
    expect(t.background).toBe(BACKGROUND_COLORS['Глубины океана']);
  });

  it('overrides aura colour for an equipped aura', () => {
    const t = applyCosmeticTheme(base, [cos({ type: 'aura', name: 'Морозная аура', equipped: 1 })]);
    expect(t.auraColor).toBe(AURA_COLORS['Морозная аура']);
  });

  it('ignores unequipped cosmetics', () => {
    const t = applyCosmeticTheme(base, [cos({ type: 'aura', name: 'Морозная аура', equipped: 0 })]);
    expect(t.auraColor).toBe(base.auraColor);
  });
});
