import React from 'react';
import renderer from 'react-test-renderer';

jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }) }));

jest.mock('../../src/store/useSystemStore', () => ({
  useSystemStore: () => ({
    hero: {
      id: 1, name: 'Игрок', hero_class: 'Warrior', global_xp: 0,
      global_level: 1, rank: 'E', journey_start_date: '2026-10-01', journey_complete: 0,
    },
    refresh: jest.fn(),
    currentTheme: {
      background: '#1a1a1a', primary: '#2a2a2a', accent: '#666', text: '#aaa',
      textSecondary: '#777', borderStyle: 'cracked_stone', auraColor: null,
      particleType: 'dust', particleCount: 8, avatarFloat: false, screenGlow: false,
    },
  }),
}));

jest.mock('../../src/engine/pathsEngine', () => ({
  loadQuestState: jest.fn().mockResolvedValue({
    progress: { body: 2 },
    bossWeek: '2026-10-12',
    boss: { name: 'Повелитель Сахара', task: '7 дней без сладкого.' },
    bossDone: false,
    bossKills: 0,
    savings: 12500,
    savingsGoal: 50000,
  }),
  completePathStep: jest.fn(),
  undoPathStep: jest.fn(),
  defeatBoss: jest.fn(),
  changeSavings: jest.fn(),
  setSavingsGoal: jest.fn(),
  formatUah: (n: number) => `${n} ₴`,
}));

import Quests from '../../src/screens/Quests';

describe('Quests', () => {
  it('renders the boss, savings jar and story paths', async () => {
    let tree: renderer.ReactTestRenderer;
    await renderer.act(async () => { tree = renderer.create(<Quests />); });
    const str = JSON.stringify(tree!.toJSON());
    expect(str).toContain('Повелитель Сахара');
    expect(str).toContain('12500 ₴');
    expect(str).toContain('Рельефное тело');
    expect(str).toContain('4 недели подряд по 3–4 силовые тренировки');
  });
});
