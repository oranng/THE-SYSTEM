import type { Rank } from '../types';

export const XP_TABLE: Record<number, number> = {
  1: 0, 2: 300, 3: 700, 4: 1200, 5: 1800,
  6: 2500, 7: 3400, 8: 4400, 9: 5600, 10: 7000,
  11: 8600, 12: 10400, 13: 12400, 14: 14600, 15: 17000,
  16: 19600, 17: 22500, 18: 25700, 19: 29200, 20: 33000,
  21: 37100, 22: 41500, 23: 46200, 24: 51200, 25: 56500,
  26: 62100, 27: 68000, 28: 74200, 29: 80700, 30: 87500,
};

export function getStreakMultiplier(streakDays: number): number {
  if (streakDays >= 90) return 4.0;
  if (streakDays >= 30) return 3.0;
  if (streakDays >= 14) return 2.0;
  if (streakDays >= 7) return 1.5;
  return 1.0;
}

export function getRankForLevel(level: number): Rank {
  if (level <= 5) return 'E';
  if (level <= 10) return 'D';
  if (level <= 15) return 'C';
  if (level <= 20) return 'B';
  if (level <= 25) return 'A';
  return 'S';
}

export function getXpForLevel(level: number): number | null {
  return XP_TABLE[level] ?? null;
}

export const RANK_TITLES: Record<Rank, string> = {
  E: 'Пробуждение', D: 'Испытание', C: 'Дисциплина',
  B: 'Закалка', A: 'Владычество', S: 'Превосхождение',
};
