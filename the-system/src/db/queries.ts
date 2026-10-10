import { getDb } from './database';
import { parseISO, subDays, format } from 'date-fns';
import type {
  Hero,
  Discipline,
  DisciplineLog,
  SilenceStreak,
  Cosmetic,
  Mandate,
} from '../types';

export async function getHero(): Promise<Hero | null> {
  return getDb().getFirstAsync<Hero>('SELECT * FROM hero WHERE id = 1');
}

export async function createHero(
  name: string,
  heroClass: string,
  journeyStartDate: string
): Promise<void> {
  const db = getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO hero (id, name, hero_class, global_xp, global_level, rank, journey_start_date, journey_complete)
     VALUES (1, ?, ?, 0, 1, 'E', ?, 0)`,
    [name, heroClass, journeyStartDate]
  );
  // Re-seed the silence streak row. resetJourney() deletes it and migrations
  // only run once, so without this a hero created after a reset would have no
  // streak row at all — silently killing streak counting and relapse tracking.
  await db.runAsync(
    `INSERT OR IGNORE INTO silence_streak (id, current_streak, longest_streak, total_relapses)
     VALUES (1, 0, 0, 0)`
  );
}

export async function updateHero(
  fields: Partial<Pick<Hero, 'global_xp' | 'global_level' | 'rank' | 'journey_complete'>>
): Promise<void> {
  const sets: string[] = [];
  const values: (string | number)[] = [];
  for (const [key, value] of Object.entries(fields)) {
    sets.push(`${key} = ?`);
    values.push(value as string | number);
  }
  if (sets.length === 0) return;
  await getDb().runAsync(`UPDATE hero SET ${sets.join(', ')} WHERE id = 1`, values);
}

export async function getAllDisciplines(): Promise<Discipline[]> {
  return getDb().getAllAsync<Discipline>('SELECT * FROM disciplines ORDER BY id');
}

export async function getActiveDisciplines(): Promise<Discipline[]> {
  return getDb().getAllAsync<Discipline>(
    'SELECT * FROM disciplines WHERE is_active = 1 ORDER BY id'
  );
}

export async function getDiscipline(id: number): Promise<Discipline | null> {
  return getDb().getFirstAsync<Discipline>('SELECT * FROM disciplines WHERE id = ?', [id]);
}

export async function getDisciplineByCode(code: string): Promise<Discipline | null> {
  return getDb().getFirstAsync<Discipline>('SELECT * FROM disciplines WHERE code = ?', [code]);
}

export async function getLog(
  disciplineId: number,
  date: string
): Promise<DisciplineLog | null> {
  return getDb().getFirstAsync<DisciplineLog>(
    'SELECT * FROM discipline_logs WHERE discipline_id = ? AND log_date = ?',
    [disciplineId, date]
  );
}

export async function getLogsForDate(date: string): Promise<DisciplineLog[]> {
  return getDb().getAllAsync<DisciplineLog>(
    'SELECT * FROM discipline_logs WHERE log_date = ?',
    [date]
  );
}

export async function insertLog(
  disciplineId: number,
  date: string,
  completed: boolean,
  failed: boolean,
  xpDelta: number
): Promise<void> {
  await getDb().runAsync(
    `INSERT OR REPLACE INTO discipline_logs (discipline_id, log_date, completed, failed, xp_delta, logged_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [disciplineId, date, completed ? 1 : 0, failed ? 1 : 0, xpDelta, new Date().toISOString()]
  );
}

export async function getStreak(disciplineId: number, beforeDate: string): Promise<number> {
  const logs = await getDb().getAllAsync<DisciplineLog>(
    `SELECT * FROM discipline_logs
     WHERE discipline_id = ? AND log_date < ? AND completed = 1
     ORDER BY log_date DESC`,
    [disciplineId, beforeDate]
  );

  // Walk backwards day-by-day from beforeDate. Use date-fns throughout so the
  // arithmetic stays in local calendar days — mixing `new Date(str)` (UTC) with
  // local getters previously dropped a day in timezones behind UTC.
  let streak = 0;
  let cursor = subDays(parseISO(beforeDate), 1);
  for (let i = 0; i < logs.length; i++) {
    const expected = format(cursor, 'yyyy-MM-dd');
    if (logs[i].log_date === expected) {
      streak++;
      cursor = subDays(cursor, 1);
    } else {
      break;
    }
  }
  return streak;
}

export async function getSilenceStreak(): Promise<SilenceStreak | null> {
  return getDb().getFirstAsync<SilenceStreak>('SELECT * FROM silence_streak WHERE id = 1');
}

export async function updateSilenceStreak(
  fields: Partial<SilenceStreak>
): Promise<void> {
  const sets: string[] = [];
  const values: (string | number | null)[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (key === 'id') continue;
    sets.push(`${key} = ?`);
    values.push(value as string | number | null);
  }
  if (sets.length === 0) return;
  await getDb().runAsync(`UPDATE silence_streak SET ${sets.join(', ')} WHERE id = 1`, values);
}

export async function getPendingMandate(): Promise<Mandate | null> {
  return getDb().getFirstAsync<Mandate>(
    'SELECT * FROM mandates WHERE opened = 0 ORDER BY granted_at DESC LIMIT 1'
  );
}

export async function createMandate(tier: string): Promise<number> {
  const result = await getDb().runAsync(
    'INSERT INTO mandates (tier, opened, granted_at) VALUES (?, 0, ?)',
    [tier, new Date().toISOString()]
  );
  return result.lastInsertRowId;
}

export async function openMandate(
  id: number,
  lootType: string,
  lootId: number
): Promise<void> {
  await getDb().runAsync(
    'UPDATE mandates SET opened = 1, opened_at = ?, loot_type = ?, loot_id = ? WHERE id = ?',
    [new Date().toISOString(), lootType, lootId, id]
  );
}

export async function getSystemState(key: string): Promise<string | null> {
  const row = await getDb().getFirstAsync<{ value: string }>(
    'SELECT value FROM system_state WHERE key = ?',
    [key]
  );
  return row?.value ?? null;
}

export async function setSystemState(key: string, value: string): Promise<void> {
  await getDb().runAsync(
    'INSERT OR REPLACE INTO system_state (key, value) VALUES (?, ?)',
    [key, value]
  );
}

export async function getCosmetics(): Promise<Cosmetic[]> {
  return getDb().getAllAsync<Cosmetic>('SELECT * FROM cosmetics ORDER BY type, tier');
}

export async function getEquippedCosmetics(): Promise<Cosmetic[]> {
  return getDb().getAllAsync<Cosmetic>(
    'SELECT * FROM cosmetics WHERE equipped = 1 ORDER BY type'
  );
}

export async function findCosmetic(type: string, name: string): Promise<Cosmetic | null> {
  return getDb().getFirstAsync<Cosmetic>(
    'SELECT * FROM cosmetics WHERE type = ? AND name = ? LIMIT 1',
    [type, name]
  );
}

export async function addCosmetic(
  type: string,
  tier: number,
  name: string
): Promise<number> {
  const result = await getDb().runAsync(
    `INSERT INTO cosmetics (type, tier, name, unlocked, equipped, unlocked_at)
     VALUES (?, ?, ?, 1, 0, ?)`,
    [type, tier, name, new Date().toISOString()]
  );
  return result.lastInsertRowId;
}

export async function unlockCosmetic(id: number): Promise<void> {
  await getDb().runAsync(
    'UPDATE cosmetics SET unlocked = 1, unlocked_at = ? WHERE id = ?',
    [new Date().toISOString(), id]
  );
}

export async function equipCosmetic(id: number, type: string): Promise<void> {
  const db = getDb();
  await db.runAsync('UPDATE cosmetics SET equipped = 0 WHERE type = ?', [type]);
  await db.runAsync('UPDATE cosmetics SET equipped = 1 WHERE id = ?', [id]);
}

export async function getWeekCompletionRate(
  journeyStartDate: string,
  weekNumber: number
): Promise<number> {
  // 24 nodes span the full 180-day journey → 7.5 days each (rounded per node so
  // spans tile the days with no gaps/overlap).
  const SPAN = 180 / 24;
  const start = new Date(journeyStartDate);
  start.setDate(start.getDate() + Math.round((weekNumber - 1) * SPAN));
  const end = new Date(journeyStartDate);
  end.setDate(end.getDate() + Math.round(weekNumber * SPAN));

  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);

  const total = await getDb().getFirstAsync<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM discipline_logs
     WHERE log_date >= ? AND log_date < ?`,
    [startStr, endStr]
  );
  const completed = await getDb().getFirstAsync<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM discipline_logs
     WHERE log_date >= ? AND log_date < ? AND completed = 1`,
    [startStr, endStr]
  );

  const totalCount = total?.cnt ?? 0;
  if (totalCount === 0) return 0;
  return (completed?.cnt ?? 0) / totalCount;
}

export async function getLogsForRange(
  startDate: string,
  endDate: string
): Promise<DisciplineLog[]> {
  return getDb().getAllAsync<DisciplineLog>(
    `SELECT * FROM discipline_logs
     WHERE log_date >= ? AND log_date <= ?
     ORDER BY log_date, discipline_id`,
    [startDate, endDate]
  );
}

export async function getAllMandates(): Promise<Mandate[]> {
  return getDb().getAllAsync<Mandate>(
    'SELECT * FROM mandates ORDER BY granted_at DESC'
  );
}

export async function setDisciplineActive(id: number, active: boolean): Promise<void> {
  await getDb().runAsync(
    'UPDATE disciplines SET is_active = ? WHERE id = ?',
    [active ? 1 : 0, id]
  );
}

export async function createCustomDiscipline(data: {
  name: string;
  description: string;
  difficulty: string;
  xpGain: number;
  xpLoss: number;
  deadlineTime: string | null;
}): Promise<void> {
  await getDb().runAsync(
    `INSERT INTO disciplines (code, name, description, difficulty, xp_gain, xp_loss, deadline_time, is_active, is_custom, frequency, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, 'daily', ?)`,
    [
      `CUSTOM_${Date.now()}`,
      data.name,
      data.description,
      data.difficulty,
      data.xpGain,
      data.xpLoss,
      data.deadlineTime,
      new Date().toISOString(),
    ]
  );
}

export async function deleteDiscipline(id: number): Promise<void> {
  await getDb().runAsync(
    'DELETE FROM disciplines WHERE id = ? AND is_custom = 1',
    [id]
  );
  await getDb().runAsync(
    'DELETE FROM discipline_logs WHERE discipline_id = ?',
    [id]
  );
}

export async function getAllLogs(): Promise<DisciplineLog[]> {
  return getDb().getAllAsync<DisciplineLog>(
    'SELECT * FROM discipline_logs ORDER BY log_date'
  );
}

export async function getDisciplineLogsAll(disciplineId: number): Promise<DisciplineLog[]> {
  return getDb().getAllAsync<DisciplineLog>(
    'SELECT * FROM discipline_logs WHERE discipline_id = ? ORDER BY log_date DESC',
    [disciplineId]
  );
}

/** Shape of the JSON produced by Settings → Export data. */
export interface ExportBundle {
  exportedAt?: string;
  version?: number;
  hero?: Record<string, unknown>[];
  disciplines?: Record<string, unknown>[];
  logs?: Record<string, unknown>[];
  silenceStreak?: Record<string, unknown>[];
  mandates?: Record<string, unknown>[];
  cosmetics?: Record<string, unknown>[];
  systemState?: Record<string, unknown>[];
}

// Export key → table name. Order matters: parents before children so foreign
// keys (discipline_logs.discipline_id → disciplines.id) resolve on insert.
const IMPORT_TABLES: { key: keyof ExportBundle; table: string }[] = [
  { key: 'hero', table: 'hero' },
  { key: 'disciplines', table: 'disciplines' },
  { key: 'logs', table: 'discipline_logs' },
  { key: 'silenceStreak', table: 'silence_streak' },
  { key: 'mandates', table: 'mandates' },
  { key: 'cosmetics', table: 'cosmetics' },
  { key: 'systemState', table: 'system_state' },
];

/** Sanity-check a parsed export before wiping anything. */
export function validateImport(data: unknown): { ok: boolean; error?: string } {
  if (!data || typeof data !== 'object') return { ok: false, error: 'Это не файл экспорта СИСТЕМЫ.' };
  const d = data as ExportBundle;
  if (!Array.isArray(d.hero) || d.hero.length === 0) return { ok: false, error: 'В файле нет данных героя.' };
  if (!Array.isArray(d.disciplines)) return { ok: false, error: 'В файле нет испытаний.' };
  if (!Array.isArray(d.logs)) return { ok: false, error: 'В файле нет истории.' };
  return { ok: true };
}

/**
 * Replace ALL local data with the contents of an export bundle. Destructive —
 * the caller MUST confirm first. Runs in a transaction so a malformed row rolls
 * the whole thing back instead of leaving a half-wiped database.
 */
export async function importData(data: ExportBundle): Promise<void> {
  const db = getDb();
  await db.withTransactionAsync(async () => {
    // Wipe child-first so FK constraints never trip mid-delete.
    await db.runAsync('DELETE FROM discipline_logs');
    await db.runAsync('DELETE FROM mandates');
    await db.runAsync('DELETE FROM cosmetics');
    await db.runAsync('DELETE FROM silence_streak');
    await db.runAsync('DELETE FROM system_state');
    await db.runAsync('DELETE FROM disciplines');
    await db.runAsync('DELETE FROM hero');

    for (const { key, table } of IMPORT_TABLES) {
      const rows = data[key];
      if (!Array.isArray(rows)) continue;
      for (const row of rows) {
        const cols = Object.keys(row);
        if (cols.length === 0) continue;
        const placeholders = cols.map(() => '?').join(', ');
        const values = cols.map((c) => (row as Record<string, unknown>)[c] ?? null);
        await db.runAsync(
          `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`,
          values as (string | number | null)[]
        );
      }
    }
  });
}

export async function get180DayConsistencyRate(): Promise<number> {
  const total = await getDb().getFirstAsync<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM discipline_logs'
  );
  const completed = await getDb().getFirstAsync<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM discipline_logs WHERE completed = 1'
  );
  const totalCount = total?.cnt ?? 0;
  if (totalCount === 0) return 0;
  return (completed?.cnt ?? 0) / totalCount;
}
