import {
  getPendingMandate,
  openMandate as openMandateQuery,
  createMandate,
  getSystemState,
  setSystemState,
  addCosmetic,
  findCosmetic,
  getEquippedCosmetics,
  equipCosmetic,
} from '../db/queries';
import type { MandateTier } from '../types';
import { differenceInDays, parseISO } from 'date-fns';

export interface LootEntry {
  type: string;
  weight: number;
  items: string[];
}

export interface LootResult {
  type: string;
  name: string;
}

const SCROLLS = [
  'Тот, кто сдвигает гору, начинает с переноски маленьких камней.',
  'Твоя дисциплина сегодня — твоя свобода завтра.',
  'Кузня не спрашивает, готов ли ты. Она спрашивает, войдёшь ли.',
  'Слабость — это выбор. Сила — тоже.',
  'Характер куётся не в моменты лёгкости, а в огне.',
  'Система видит то, чего не видят другие: твой потенциал.',
  'Каждый отвоёванный рассвет — победа над прежней версией себя.',
  'Тишина — не пустота. Это мастерство.',
  'Железо помнит каждый повтор. Твоё будущее — тоже.',
  'Короны не дарят. Их добывают ежедневной победой.',
  'Свиток открывается тем, кто ищет.',
  'Постоянство — трон, на котором восседает величие.',
  'Ночь принадлежит тем, кто заслужил отдых.',
  'Твой договор — не с другими. Он с тобой.',
  'Когда мир спит, дисциплина встаёт.',
  'К вершине нет короткой дороги. Только шаги.',
  'Система не судит твоё прошлое. Только настоящее.',
  'То, чему сопротивляешься сегодня, завтра станет твоей победой.',
  'Империя строится по одному дисциплинированному дню.',
  'Тебя выбрали не случайно. Система видит твой огонь.',
];

const TITLES_COMMON = [
  'Крушитель камней', 'Встречающий рассвет', 'Железная воля', 'Ночной страж',
  'Идущий путём', 'Хранитель углей', 'Стряхнувший пыль', 'Связанный клятвой',
  'Носитель стойкости', 'Стальной разум',
];

const TITLES_RARE = [
  'Покоритель теней', 'Закалённый пламенем', 'Искатель короны',
  'Странник пустоты', 'Несущий бурю',
];

const TITLES_LEGENDARY = [
  'Владыка', 'Избранник Системы', 'Несломленная воля',
  'Божественная воля', 'Превосхождение',
];

const ACCESSORIES = [
  'Боевой шрам', 'Железная серьга', 'Боевая раскраска', 'Пиксельная татуировка',
  'Повязка на глаз', 'Цепной кулон',
];

export const LOOT_TABLES: Record<string, LootEntry[]> = {
  BRONZE: [
    { type: 'scroll', weight: 0.6, items: SCROLLS },
    { type: 'title', weight: 0.3, items: TITLES_COMMON },
    { type: 'accessory', weight: 0.1, items: ACCESSORIES },
  ],
  SILVER: [
    { type: 'cosmetic_variant', weight: 0.5, items: ['Оружие: багровый облик', 'Оружие: морозный облик', 'Броня: теневой облик', 'Броня: бронзовый облик'] },
    { type: 'background', weight: 0.3, items: ['Вулканические руины', 'Ледяной трон', 'Цитадель пустыни', 'Глубины океана'] },
    { type: 'title', weight: 0.2, items: TITLES_RARE },
  ],
  GOLD: [
    { type: 'equipment_tier', weight: 0.4, items: ['Оружие: новый ранг', 'Броня: новый ранг', 'Корона восхождения'] },
    { type: 'aura_variant', weight: 0.4, items: ['Багровая аура', 'Морозная аура', 'Теневая аура', 'Божественная аура'] },
    { type: 'title', weight: 0.2, items: TITLES_LEGENDARY },
  ],
};

export function rollLoot(tier: string): LootResult {
  const table = LOOT_TABLES[tier] ?? LOOT_TABLES.BRONZE;
  const roll = Math.random();

  let cumulative = 0;
  for (const entry of table) {
    cumulative += entry.weight;
    if (roll <= cumulative) {
      const item = entry.items[Math.floor(Math.random() * entry.items.length)];
      return { type: entry.type, name: item };
    }
  }

  const fallback = table[0];
  return {
    type: fallback.type,
    name: fallback.items[Math.floor(Math.random() * fallback.items.length)],
  };
}

/** Equippable slot types — these auto-equip when their tier beats the current. */
const EQUIP_SLOTS = ['weapon', 'armor', 'crown', 'accessory', 'aura', 'background'];

export interface MappedCosmetic {
  type: 'weapon' | 'armor' | 'crown' | 'title' | 'background' | 'accessory' | 'aura';
  tier: number;
  name: string;
}

/**
 * Translate a rolled loot result into a persistable cosmetic. Returns null for
 * purely flavour loot (scrolls are motivational quotes, nothing to keep).
 */
export function lootToCosmetic(loot: LootResult): MappedCosmetic | null {
  switch (loot.type) {
    case 'scroll':
      return null;
    case 'title':
      return { type: 'title', tier: 1, name: loot.name };
    case 'accessory':
      return { type: 'accessory', tier: 1, name: loot.name };
    case 'aura_variant':
      return { type: 'aura', tier: 2, name: loot.name };
    case 'background':
      return { type: 'background', tier: 1, name: loot.name };
    case 'cosmetic_variant':
      if (loot.name.startsWith('Броня')) return { type: 'armor', tier: 2, name: loot.name };
      return { type: 'weapon', tier: 2, name: loot.name };
    case 'equipment_tier':
      if (loot.name.startsWith('Броня')) return { type: 'armor', tier: 3, name: loot.name };
      if (loot.name.startsWith('Корона')) return { type: 'crown', tier: 3, name: loot.name };
      return { type: 'weapon', tier: 3, name: loot.name };
    default:
      return { type: 'accessory', tier: 1, name: loot.name };
  }
}

/** Persist a rolled loot as an unlocked cosmetic, auto-equipping slot items. */
async function persistLoot(loot: LootResult): Promise<number> {
  const mapped = lootToCosmetic(loot);
  if (!mapped) return 0; // flavour-only (scroll)

  // De-dupe: never store the same item twice — reuse the existing row.
  const existing = await findCosmetic(mapped.type, mapped.name);
  const id = existing ? existing.id : await addCosmetic(mapped.type, mapped.tier, mapped.name);

  if (EQUIP_SLOTS.includes(mapped.type)) {
    const equipped = await getEquippedCosmetics();
    const current = equipped.find((c) => c.type === mapped.type);
    if (!current || mapped.tier >= current.tier) {
      await equipCosmetic(id, mapped.type);
    }
  }
  return id;
}

export async function openCurrentMandate(): Promise<LootResult | null> {
  const mandate = await getPendingMandate();
  if (!mandate) return null;
  const loot = rollLoot(mandate.tier);
  const lootId = await persistLoot(loot);
  await openMandateQuery(mandate.id, loot.type, lootId);
  return loot;
}

export async function requestManualMandate(today: string): Promise<boolean> {
  const lastDate = await getSystemState('last_manual_mandate_date');
  if (lastDate) {
    const daysSince = differenceInDays(parseISO(today), parseISO(lastDate));
    if (daysSince < 7) return false;
  }
  const pending = await getPendingMandate();
  if (pending) return false;
  await createMandate('BRONZE');
  await setSystemState('last_manual_mandate_date', today);
  return true;
}
