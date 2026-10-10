import type { SQLiteDatabase } from 'expo-sqlite';
import type { Migration } from './index';

/**
 * Personal trial set (Russian). Rewrites the eight core disciplines around the
 * player's goals (lean body, health, AI/vibe-coding, order at home) and adds
 * the player's own daily trials: ACE, money in hryvnia, salary growth, time
 * with Diana, planning and a daylight walk. The added ones are is_custom = 1 so
 * they can be switched off or deleted from the Codex like any custom trial.
 */

// [code, name, description, difficulty, xp_gain, xp_loss, deadline_time]
type Row = [string, string, string, string, number, number, string | null];

const CORE: Row[] = [
  ['RISE', 'Подъём до 08:00', 'Встань до 08:00 без повторного будильника. Стакан воды и 5 минут дневного света вместо телефона.', 'HARD', 50, 30, '08:00'],
  ['REST', 'Отбой до 23:30', 'Телефон заряжается вне кровати, свет выключен до 23:30. 7–8 часов сна чинят мозг, гормоны и мышцы.', 'HARD', 50, 30, '23:30'],
  ['NOURISH', 'Чистое топливо', 'Белок в каждом приёме пищи, овощи, 2+ литра воды. Без сахара, фастфуда и еды на ночь.', 'NORMAL', 25, 15, '23:59'],
  ['SILENCE', 'Протокол Тишины', 'Война с главной зависимостью. Выбери свою и держи серию — срыв обнуляет весь прогресс.', 'LEGENDARY', 100, 0, null],
  ['FORGE', 'Железный храм', 'Силовая тренировка 45+ минут или 30 минут кардио. Рельеф строится в зале и на кухне.', 'HARD', 60, 35, '23:59'],
  ['KNOWLEDGE', 'ИИ и код', '1 час практики: вайбкодинг, ИИ-инструменты, разработка приложений или тесты. Делать, а не смотреть ролики.', 'HARD', 50, 30, '23:59'],
  ['PRESENCE', 'Завеса', 'Instagram и TikTok — меньше 30 минут за день. Считается автоматически.', 'NORMAL', 25, 15, '23:59'],
  ['RITUAL', 'Порядок дома', '15 минут порядка: посуда, поверхности, вещи на свои места. Порядок вокруг — порядок в голове.', 'EASY', 10, 5, '23:59'],
];

const PERSONAL: Row[] = [
  ['ACE', 'Движок ACE', '1 час глубокой работы над ACE, личным движком. Закончи день хотя бы одним коммитом.', 'HARD', 50, 30, '23:59'],
  ['WEALTH', 'Казна ₴', 'Запиши все траты за день в гривнах. Ни одной импульсивной покупки.', 'NORMAL', 25, 15, '23:59'],
  ['CAREER', 'Рост до $1000+', '30 минут на карьеру: навык, портфолио, отклик на вакансию или подготовка к разговору о повышении.', 'NORMAL', 25, 15, '23:59'],
  ['DIANA', 'Время с Дианой', 'Внимание без телефона, тёплые слова, помощь или план встречи. Отношения строятся каждый день.', 'NORMAL', 25, 15, '23:59'],
  ['WALK', 'Прогулка и свет', '30 минут прогулки на улице без телефона в руках, лучше утром. Свет и движение для мозга.', 'EASY', 10, 5, '23:59'],
  ['PLAN', 'План на завтра', 'Вечером запиши 3 главные задачи на завтра. Утром не решаешь, что делать, — сразу делаешь.', 'EASY', 10, 5, '23:59'],
];

export const migration002: Migration = {
  version: 2,
  name: 'personal_trials_ru',
  up: async (db: SQLiteDatabase) => {
    for (const [code, name, description, difficulty, xpGain, xpLoss, deadline] of CORE) {
      await db.runAsync(
        `UPDATE disciplines
            SET name = ?, description = ?, difficulty = ?, xp_gain = ?, xp_loss = ?, deadline_time = ?
          WHERE code = ?`,
        [name, description, difficulty, xpGain, xpLoss, deadline, code]
      );
    }

    const now = new Date().toISOString();
    for (const row of PERSONAL) {
      await db.runAsync(
        `INSERT OR IGNORE INTO disciplines (code, name, description, difficulty, xp_gain, xp_loss, deadline_time, is_active, is_custom, frequency, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, 'daily', ?)`,
        [...row, now]
      );
    }

    // The original default hero name belonged to the app's first author.
    await db.runAsync(
      "UPDATE hero SET name = 'Игрок' WHERE name = 'Raynald Arvan Lim'"
    );
  },
};
