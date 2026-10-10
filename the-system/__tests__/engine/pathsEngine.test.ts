import { initDatabase, getDb } from '../../src/db/database';
import { createHero, getHero, setSystemState } from '../../src/db/queries';
import {
  loadQuestState, completePathStep, undoPathStep, defeatBoss,
  changeSavings, setSavingsGoal, bossForWeek, currentWeekKey, formatUah,
} from '../../src/engine/pathsEngine';
import { PATHS, BOSSES, BOSS_XP, stepXp } from '../../src/data/paths';

beforeAll(async () => { await initDatabase(); });

beforeEach(async () => {
  const db = getDb();
  await db.runAsync('DELETE FROM hero');
  await db.runAsync('DELETE FROM mandates');
  await db.runAsync(
    "DELETE FROM system_state WHERE key IN ('paths_progress','boss_week_done','boss_kills','savings_uah','savings_goal_uah')"
  );
  await createHero('Игрок', 'Warrior', '2026-10-01');
});

describe('story paths', () => {
  it('completes steps in order and grants growing XP', async () => {
    const first = await completePathStep('body');
    expect(first?.xpGained).toBe(stepXp(0));
    const second = await completePathStep('body');
    expect(second?.xpGained).toBe(stepXp(1));

    const state = await loadQuestState();
    expect(state.progress.body).toBe(2);
    expect((await getHero())?.global_xp).toBe(stepXp(0) + stepXp(1));
  });

  it('levels the hero up across several levels from one big reward', async () => {
    await getDb().runAsync('UPDATE hero SET global_xp = 650 WHERE id = 1'); // level 1, 700 = level 3
    const result = await completePathStep('ace'); // +150 → 800
    expect(result?.levelUp?.newLevel).toBe(3);
    expect((await getHero())?.global_level).toBe(3);
  });

  it('undo returns the step and takes its XP back', async () => {
    await completePathStep('wealth');
    expect(await undoPathStep('wealth')).toBe(true);
    expect((await loadQuestState()).progress.wealth).toBe(0);
    expect((await getHero())?.global_xp).toBe(0);
    expect(await undoPathStep('wealth')).toBe(false);
  });

  it('stops at the end of a path and ignores unknown keys', async () => {
    const home = PATHS.find((p) => p.key === 'home')!;
    await setSystemState('paths_progress', JSON.stringify({ home: home.steps.length }));
    expect(await completePathStep('home')).toBeNull();
    expect(await completePathStep('nope')).toBeNull();
  });

  it('survives a corrupted progress value', async () => {
    await setSystemState('paths_progress', '{not json');
    expect((await loadQuestState()).progress).toEqual({});
  });
});

describe('weekly boss', () => {
  it('can be defeated once per week', async () => {
    const now = new Date(2026, 9, 14); // Wednesday
    const first = await defeatBoss(now);
    expect(first?.xpGained).toBe(BOSS_XP);
    expect(await defeatBoss(now)).toBeNull();

    const state = await loadQuestState(now);
    expect(state.bossDone).toBe(true);
    expect(state.bossKills).toBe(1);

    const nextWeek = await loadQuestState(new Date(2026, 9, 20)); // following Tuesday
    expect(nextWeek.bossDone).toBe(false);
  });

  it('keeps the same boss for the whole ISO week', () => {
    expect(currentWeekKey(new Date(2026, 9, 12))).toBe('2026-10-12'); // Monday
    expect(currentWeekKey(new Date(2026, 9, 18))).toBe('2026-10-12'); // Sunday
    expect(BOSSES).toContain(bossForWeek('2026-10-12'));
    expect(bossForWeek('2026-10-12')).toBe(bossForWeek('2026-10-12'));
  });
});

describe('savings jar (UAH)', () => {
  it('adds, withdraws and never goes negative', async () => {
    expect(await changeSavings(1500)).toBe(1500);
    expect(await changeSavings(-400)).toBe(1100);
    expect(await changeSavings(-5000)).toBe(0);
  });

  it('stores a goal', async () => {
    await setSavingsGoal(60000);
    await changeSavings(15000);
    const s = await loadQuestState();
    expect(s.savingsGoal).toBe(60000);
    expect(s.savings).toBe(15000);
  });

  it('formats hryvnias', () => {
    expect(formatUah(0)).toBe('0 ₴');
    expect(formatUah(1250000)).toBe('1 250 000 ₴');
  });
});
