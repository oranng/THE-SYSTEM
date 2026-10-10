import { initDatabase, getDb } from '../../src/db/database';
import { lootToCosmetic, openCurrentMandate, type LootResult } from '../../src/engine/mandateEngine';
import { createMandate, getCosmetics, getEquippedCosmetics, addCosmetic, equipCosmetic } from '../../src/db/queries';

describe('lootToCosmetic', () => {
  const map = (type: string, name: string) => lootToCosmetic({ type, name } as LootResult);

  it('drops scrolls (flavour only)', () => {
    expect(map('scroll', 'Some quote')).toBeNull();
  });
  it('maps titles', () => {
    expect(map('title', 'Железная воля')).toEqual({ type: 'title', tier: 1, name: 'Железная воля' });
  });
  it('maps weapon vs armor skins from cosmetic_variant', () => {
    expect(map('cosmetic_variant', 'Оружие: багровый облик')).toEqual({ type: 'weapon', tier: 2, name: 'Оружие: багровый облик' });
    expect(map('cosmetic_variant', 'Броня: теневой облик')).toEqual({ type: 'armor', tier: 2, name: 'Броня: теневой облик' });
  });
  it('maps equipment_tier to tier 3 weapon/armor/crown', () => {
    expect(map('equipment_tier', 'Оружие: новый ранг')?.tier).toBe(3);
    expect(map('equipment_tier', 'Броня: новый ранг')?.type).toBe('armor');
    expect(map('equipment_tier', 'Корона восхождения')?.type).toBe('crown');
  });
  it('maps aura_variant to aura, accessory to accessory', () => {
    expect(map('aura_variant', 'Морозная аура')?.type).toBe('aura');
    expect(map('accessory', 'Боевая раскраска')?.type).toBe('accessory');
  });
});

describe('openCurrentMandate persists loot', () => {
  beforeAll(async () => { await initDatabase(); });
  beforeEach(async () => {
    const db = getDb();
    await db.runAsync('DELETE FROM cosmetics');
    await db.runAsync('DELETE FROM mandates');
  });

  it('saves an unlocked cosmetic and records its id on the mandate (non-scroll)', async () => {
    await createMandate('SILVER'); // SILVER never rolls scroll → always persistable
    const loot = await openCurrentMandate();
    expect(loot).not.toBeNull();

    const cosmetics = await getCosmetics();
    expect(cosmetics.length).toBe(1);
    expect(cosmetics[0].unlocked).toBe(1);

    const mandate = await getDb().getFirstAsync<{ loot_id: number; opened: number }>(
      'SELECT loot_id, opened FROM mandates LIMIT 1'
    );
    expect(mandate?.opened).toBe(1);
    expect(mandate?.loot_id).toBe(cosmetics[0].id); // no longer hard-coded 0
  });

  it('does not store duplicate loot of the same type+name', async () => {
    const spy = jest.spyOn(Math, 'random').mockReturnValue(0); // always Оружие: багровый облик
    try {
      await createMandate('SILVER');
      await openCurrentMandate();
      await createMandate('SILVER');
      await openCurrentMandate();
    } finally {
      spy.mockRestore();
    }
    const weapons = (await getCosmetics()).filter((c) => c.type === 'weapon' && c.name === 'Оружие: багровый облик');
    expect(weapons).toHaveLength(1);
  });

  it('auto-equips the looted weapon over a lower-tier equipped one', async () => {
    // pre-equip a tier-1 weapon
    const lowId = await addCosmetic('weapon', 1, 'Rusty Blade');
    await equipCosmetic(lowId, 'weapon');

    // Force SILVER → cosmetic_variant (weight 0.5, first entry) → item index 0
    // = 'Оружие: багровый облик' → weapon tier 2.
    const spy = jest.spyOn(Math, 'random').mockReturnValue(0);
    try {
      await createMandate('SILVER');
      await openCurrentMandate();
    } finally {
      spy.mockRestore();
    }

    const equipped = await getEquippedCosmetics();
    const weapon = equipped.find((c) => c.type === 'weapon');
    expect(weapon?.tier).toBe(2);
    expect(weapon?.name).toBe('Оружие: багровый облик');
    // only one weapon may be equipped at a time
    expect(equipped.filter((c) => c.type === 'weapon')).toHaveLength(1);
  });
});
