import type { DisciplineLog, Discipline } from '../types';

/**
 * Real per-attribute progression.
 *
 * Attributes are NOT stored — they are DERIVED from discipline_logs so there is
 * a single source of truth (the same logs that drive global XP and history).
 * This avoids the desync class of bug that plagued the global counters.
 *
 * Each attribute accumulates the NET xp_delta (gains minus losses) of every log
 * whose discipline maps to it, floored at 0 so an attribute never goes negative.
 * Failing a trial therefore drags its attribute back down, same as the global pool.
 */

export type Attribute = 'Willpower' | 'Strength' | 'Vitality' | 'Knowledge';

export const ATTRIBUTES: Attribute[] = ['Willpower', 'Strength', 'Vitality', 'Knowledge'];

/** Which core discipline codes feed which attribute. */
export const ATTRIBUTE_CODES: Record<Attribute, string[]> = {
  Willpower: ['SILENCE', 'PRESENCE', 'WEALTH', 'PLAN'],
  Strength: ['FORGE', 'RISE'],
  Vitality: ['NOURISH', 'REST', 'RITUAL', 'WALK', 'DIANA'],
  Knowledge: ['KNOWLEDGE', 'ACE', 'CAREER'],
};

/** XP needed to advance one attribute level. */
export const ATTR_XP_PER_LEVEL = 300;

/** Map any discipline code to its attribute. Custom/unknown → Willpower. */
export function attributeForCode(code: string): Attribute {
  for (const attr of ATTRIBUTES) {
    if (ATTRIBUTE_CODES[attr].includes(code)) return attr;
  }
  return 'Willpower';
}

export interface AttributeProgress {
  attribute: Attribute;
  xp: number;
  level: number;
  /** XP earned inside the current level (0..ATTR_XP_PER_LEVEL). */
  xpIntoLevel: number;
  /** XP required to clear the current level. */
  xpForLevel: number;
  /** Fraction toward next level, 0..1. */
  pct: number;
}

export function attributeProgressFromXP(attribute: Attribute, xp: number): AttributeProgress {
  const safeXp = Math.max(0, xp);
  const level = 1 + Math.floor(safeXp / ATTR_XP_PER_LEVEL);
  const xpIntoLevel = safeXp % ATTR_XP_PER_LEVEL;
  return {
    attribute,
    xp: safeXp,
    level,
    xpIntoLevel,
    xpForLevel: ATTR_XP_PER_LEVEL,
    pct: xpIntoLevel / ATTR_XP_PER_LEVEL,
  };
}

/**
 * Compute every attribute's progress from a set of logs.
 *
 * @param logs       discipline_logs (any range — caller decides, e.g. all-time
 *                   or since the last relapse)
 * @param disciplines disciplines used to resolve log.discipline_id → code
 */
export function computeAttributes(
  logs: Pick<DisciplineLog, 'discipline_id' | 'xp_delta'>[],
  disciplines: Pick<Discipline, 'id' | 'code'>[]
): Record<Attribute, AttributeProgress> {
  const codeById = new Map(disciplines.map((d) => [d.id, d.code]));
  const xpByAttr: Record<Attribute, number> = {
    Willpower: 0, Strength: 0, Vitality: 0, Knowledge: 0,
  };

  for (const log of logs) {
    if (!log.xp_delta) continue; // skip no-ops
    const code = codeById.get(log.discipline_id);
    if (!code) continue;
    xpByAttr[attributeForCode(code)] += log.xp_delta; // net: gains and losses
  }

  return {
    Willpower: attributeProgressFromXP('Willpower', xpByAttr.Willpower),
    Strength: attributeProgressFromXP('Strength', xpByAttr.Strength),
    Vitality: attributeProgressFromXP('Vitality', xpByAttr.Vitality),
    Knowledge: attributeProgressFromXP('Knowledge', xpByAttr.Knowledge),
  };
}
