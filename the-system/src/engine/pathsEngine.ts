import { format, startOfISOWeek } from 'date-fns';
import { getSystemState, setSystemState } from '../db/queries';
import { PATHS, BOSSES, BOSS_XP, stepXp, type Boss } from '../data/paths';
import { grantBonusXP, revokeBonusXP, type LevelUpEvent } from './xpEngine';

/**
 * Story paths, the weekly boss and the hryvnia savings jar. Everything lives in
 * system_state (JSON / plain values) so it rides along with Settings → Export
 * and Import without a schema change. Path and boss XP go straight into the
 * global pool; they are real-life milestones, so a Silence relapse keeps them.
 */

const PATHS_KEY = 'paths_progress';
const BOSS_WEEK_KEY = 'boss_week_done';
const BOSS_KILLS_KEY = 'boss_kills';
const SAVINGS_KEY = 'savings_uah';
const SAVINGS_GOAL_KEY = 'savings_goal_uah';

export type PathProgress = Record<string, number>;

export interface QuestState {
  progress: PathProgress;
  bossWeek: string;
  boss: Boss;
  bossDone: boolean;
  bossKills: number;
  savings: number;
  savingsGoal: number;
}

/** Monday of the current ISO week, local calendar date. */
export function currentWeekKey(now: Date = new Date()): string {
  return format(startOfISOWeek(now), 'yyyy-MM-dd');
}

/** Deterministic boss for a week: same boss all week, a new one each Monday. */
export function bossForWeek(weekKey: string): Boss {
  let h = 0;
  for (let i = 0; i < weekKey.length; i++) h = (h * 31 + weekKey.charCodeAt(i)) >>> 0;
  return BOSSES[h % BOSSES.length];
}

function parseProgress(raw: string | null): PathProgress {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as PathProgress) : {};
  } catch {
    return {};
  }
}

function toNumber(raw: string | null): number {
  const n = raw === null ? 0 : Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export async function loadQuestState(now: Date = new Date()): Promise<QuestState> {
  const [progressRaw, bossDoneWeek, kills, savings, goal] = await Promise.all([
    getSystemState(PATHS_KEY),
    getSystemState(BOSS_WEEK_KEY),
    getSystemState(BOSS_KILLS_KEY),
    getSystemState(SAVINGS_KEY),
    getSystemState(SAVINGS_GOAL_KEY),
  ]);
  const bossWeek = currentWeekKey(now);
  return {
    progress: parseProgress(progressRaw),
    bossWeek,
    boss: bossForWeek(bossWeek),
    bossDone: bossDoneWeek === bossWeek,
    bossKills: toNumber(kills),
    savings: toNumber(savings),
    savingsGoal: toNumber(goal),
  };
}

/** Mark the current step of a path done. Returns XP granted and any level-up. */
export async function completePathStep(
  key: string
): Promise<{ xpGained: number; levelUp: LevelUpEvent | null } | null> {
  const path = PATHS.find((p) => p.key === key);
  if (!path) return null;
  const progress = parseProgress(await getSystemState(PATHS_KEY));
  const index = progress[key] ?? 0;
  if (index >= path.steps.length) return null;

  progress[key] = index + 1;
  await setSystemState(PATHS_KEY, JSON.stringify(progress));
  const xpGained = stepXp(index);
  const levelUp = await grantBonusXP(xpGained);
  return { xpGained, levelUp };
}

/** Undo the last completed step of a path (takes its XP back). */
export async function undoPathStep(key: string): Promise<boolean> {
  const progress = parseProgress(await getSystemState(PATHS_KEY));
  const index = (progress[key] ?? 0) - 1;
  if (index < 0) return false;
  progress[key] = index;
  await setSystemState(PATHS_KEY, JSON.stringify(progress));
  await revokeBonusXP(stepXp(index));
  return true;
}

/** Defeat this week's boss (once per week). */
export async function defeatBoss(
  now: Date = new Date()
): Promise<{ xpGained: number; levelUp: LevelUpEvent | null } | null> {
  const week = currentWeekKey(now);
  if ((await getSystemState(BOSS_WEEK_KEY)) === week) return null;
  await setSystemState(BOSS_WEEK_KEY, week);
  const kills = toNumber(await getSystemState(BOSS_KILLS_KEY));
  await setSystemState(BOSS_KILLS_KEY, String(kills + 1));
  const levelUp = await grantBonusXP(BOSS_XP);
  return { xpGained: BOSS_XP, levelUp };
}

/** Add (positive) or withdraw (negative) hryvnias. The jar never goes below 0. */
export async function changeSavings(delta: number): Promise<number> {
  if (!Number.isFinite(delta)) return toNumber(await getSystemState(SAVINGS_KEY));
  const current = toNumber(await getSystemState(SAVINGS_KEY));
  const next = Math.max(0, Math.round(current + delta));
  await setSystemState(SAVINGS_KEY, String(next));
  return next;
}

export async function setSavingsGoal(goal: number): Promise<void> {
  if (!Number.isFinite(goal) || goal < 0) return;
  await setSystemState(SAVINGS_GOAL_KEY, String(Math.round(goal)));
}

/** Format hryvnias with thin-space thousands: 12 500 ₴. */
export function formatUah(n: number): string {
  const s = String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${n < 0 ? '−' : ''}${s} ₴`;
}
