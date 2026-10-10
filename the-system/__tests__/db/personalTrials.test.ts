import { initDatabase } from '../../src/db/database';
import { getAllDisciplines, getDisciplineByCode } from '../../src/db/queries';
import { attributeForCode } from '../../src/engine/attributeEngine';

beforeAll(async () => { await initDatabase(); });

describe('migration 002 — personal trials', () => {
  it('rewrites core trials in Russian', async () => {
    const rest = await getDisciplineByCode('REST');
    expect(rest?.name).toBe('Отбой до 23:30');
    expect(rest?.deadline_time).toBe('23:30');
    const forge = await getDisciplineByCode('FORGE');
    expect(forge?.name).toBe('Железный храм');
  });

  it('adds the personal trials as custom, deletable trials', async () => {
    for (const code of ['ACE', 'WEALTH', 'CAREER', 'DIANA', 'WALK', 'PLAN']) {
      const d = await getDisciplineByCode(code);
      expect(d).not.toBeNull();
      expect(d?.is_custom).toBe(1);
      expect(d?.is_active).toBe(1);
    }
    const all = await getAllDisciplines();
    expect(all.filter((d) => /[A-Za-z]{4,}/.test(d.name.replace(/ACE|Instagram|TikTok/g, '')))).toEqual([]);
  });

  it('maps personal trials to attributes', () => {
    expect(attributeForCode('ACE')).toBe('Knowledge');
    expect(attributeForCode('CAREER')).toBe('Knowledge');
    expect(attributeForCode('DIANA')).toBe('Vitality');
    expect(attributeForCode('WALK')).toBe('Vitality');
    expect(attributeForCode('WEALTH')).toBe('Willpower');
  });
});
