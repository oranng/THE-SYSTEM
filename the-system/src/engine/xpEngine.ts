import { getDb } from '../db/database';
import {
  getHero,
  getDiscipline,
  getStreak,
  insertLog,
  updateHero,
  getSilenceStreak,
  updateSilenceStreak,
  setSystemState,
  createMandate,
  getPendingMandate,
} from '../db/queries';
import { getStreakMultiplier, getRankForLevel, getXpForLevel } from './xpConstants';
import { format, addDays, parseISO } from 'date-fns';
import type { Hero, Rank } from '../types';

export interface LevelUpEvent {
  newLevel: number;
  newRank: Rank;
  rankChanged: boolean;
}

export async function completeDiscipline(
  disciplineId: number,
  date: string
): Promise<{ xpGained: number; levelUp: LevelUpEvent | null }> {
  const discipline = await getDiscipline(disciplineId);
  if (!discipline) throw new Error(`Discipline ${disciplineId} not found`);

  const streak = await getStreak(disciplineId, date);
  const multiplier = getStreakMultiplier(streak);
  const xpGained = Math.round(discipline.xp_gain * multiplier);

  await insertLog(disciplineId, date, true, false, xpGained);
  await addGlobalXP(xpGained);

  const levelUp = await checkLevelUp();
  return { xpGained, levelUp };
}

export async function failDiscipline(
  disciplineId: number,
  date: string
): Promise<void> {
  const discipline = await getDiscipline(disciplineId);
  if (!discipline) throw new Error(`Discipline ${disciplineId} not found`);

  if (discipline.code === 'SILENCE') {
    await triggerRelapse(date);
    return;
  }

  const xpLost = discipline.xp_loss;
  await insertLog(disciplineId, date, false, true, -xpLost);
  await deductGlobalXP(xpLost);
}

/**
 * Break the Silence Protocol. Keeps the hero's identity (name, star/class) but
 * resets all progress to zero and erases history: XP/level/rank reset, every
 * log, mandate, and cosmetic wiped, and the journey restarts today. The ONLY
 * thing preserved is the silence streak record — current streak resets to 0 and
 * the lifetime relapse count ticks up, so the Archive streak page reflects it.
 */
export async function triggerRelapse(date: string): Promise<void> {
  const db = getDb();

  // Erase progress + history (identity row stays).
  await db.runAsync('DELETE FROM discipline_logs');
  await db.runAsync('DELETE FROM mandates');
  await db.runAsync('DELETE FROM cosmetics');
  // Clear the petition cooldown so a fresh start can request a mandate again.
  await db.runAsync("DELETE FROM system_state WHERE key = 'last_manual_mandate_date'");

  // Zero the hero but keep name/class. The fresh journey's Day 1 is TOMORROW —
  // today is the fall (shown as "Fallen", not counted), so no Day 1 is wasted.
  const tomorrow = format(addDays(parseISO(date), 1), 'yyyy-MM-dd');
  await db.runAsync(
    "UPDATE hero SET global_xp = 0, global_level = 1, rank = 'E', journey_start_date = ?, journey_complete = 0 WHERE id = 1",
    [tomorrow]
  );

  // Silence streak: reset current run, record the relapse (count + date).
  await updateSilenceStreak({ current_streak: 0, last_relapse_date: date });
  await db.runAsync(
    'UPDATE silence_streak SET total_relapses = total_relapses + 1 WHERE id = 1'
  );

  // Lock the rest of today: while relapse_lock_date == today, every trial's
  // check buttons are disabled (no fake logs, no re-farming). Tomorrow the date
  // no longer matches and trials open normally.
  await setSystemState('relapse_lock_date', date);

  // Anchor the settler at today so the relapse day is NOT auto-failed (it's
  // pre-journey) and Day 1 (tomorrow) settles on the day after.
  await setSystemState('last_midnight_date', date);
}

/**
 * Award XP that is not tied to a daily trial (story path steps, weekly boss).
 * Large rewards can cross several levels at once, so level-ups are applied
 * until the hero catches up; the returned event describes the final level and
 * whether the rank changed anywhere along the way.
 */
export async function grantBonusXP(amount: number): Promise<LevelUpEvent | null> {
  if (amount <= 0) return null;
  const before = await getHero();
  if (!before) return null;
  await addGlobalXP(amount);

  let last: LevelUpEvent | null = null;
  for (let guard = 0; guard < 50; guard++) {
    const event = await checkLevelUp();
    if (!event) break;
    last = event;
  }
  if (!last) return null;
  return { ...last, rankChanged: last.newRank !== before.rank };
}

/** Take back bonus XP (undoing a path step). Levels are never lost, like fails. */
export async function revokeBonusXP(amount: number): Promise<void> {
  if (amount <= 0) return;
  await deductGlobalXP(amount);
}

async function addGlobalXP(amount: number): Promise<void> {
  const hero = await getHero();
  if (!hero) return;
  const newXP = hero.global_xp + amount;
  await updateHero({ global_xp: newXP });
}

async function deductGlobalXP(amount: number): Promise<void> {
  const hero = await getHero();
  if (!hero) return;
  const newXP = Math.max(0, hero.global_xp - amount);
  await updateHero({ global_xp: newXP });
}

async function checkLevelUp(): Promise<LevelUpEvent | null> {
  const hero = await getHero();
  if (!hero) return null;

  const nextLevelXP = getXpForLevel(hero.global_level + 1);
  if (nextLevelXP === null) return null;
  if (hero.global_xp < nextLevelXP) return null;

  const newLevel = hero.global_level + 1;
  const newRank = getRankForLevel(newLevel);
  const rankChanged = newRank !== hero.rank;

  await updateHero({ global_level: newLevel, rank: newRank });

  const pendingMandate = await getPendingMandate();
  if (!pendingMandate) {
    await grantMandate(newLevel);
  }

  return { newLevel, newRank, rankChanged };
}

async function grantMandate(newLevel: number): Promise<void> {
  let tier = 'BRONZE';
  if (newLevel % 10 === 0) tier = 'GOLD';
  else if (newLevel % 5 === 0) tier = 'SILVER';
  await createMandate(tier);
}
