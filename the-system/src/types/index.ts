export type Rank = 'E' | 'D' | 'C' | 'B' | 'A' | 'S';

export type Difficulty = 'EASY' | 'NORMAL' | 'HARD' | 'LEGENDARY';

export type DisciplineCode =
  | 'RISE'
  | 'REST'
  | 'NOURISH'
  | 'SILENCE'
  | 'FORGE'
  | 'KNOWLEDGE'
  | 'PRESENCE'
  | 'RITUAL';

export type HeroClass = 'Warrior' | 'Mage' | 'Rogue';

// Display labels — internal class values stay Warrior/Mage/Rogue (avatar art,
// palettes, notif banners keyed off them); UI shows star names instead.
export const STAR_LABELS: Record<HeroClass, string> = {
  Warrior: 'Антарес',
  Mage: 'Полярная',
  Rogue: 'Альтаир',
};

export type MandateTier = 'BRONZE' | 'SILVER' | 'GOLD';

export type CosmeticType =
  | 'weapon'
  | 'armor'
  | 'crown'
  | 'title'
  | 'background'
  | 'accessory'
  | 'aura';

export type NotificationCategory =
  | 'SILENCE'
  | 'FORGE'
  | 'HEALTH'
  | 'GENERAL'
  | 'MILESTONE';

export type MoodState = 'radiant' | 'steady' | 'worn' | 'broken';

export interface Hero {
  id: number;
  name: string;
  hero_class: HeroClass;
  global_xp: number;
  global_level: number;
  rank: Rank;
  journey_start_date: string;
  journey_complete: number;
}

export interface Discipline {
  id: number;
  code: string;
  name: string;
  description: string;
  difficulty: Difficulty;
  xp_gain: number;
  xp_loss: number;
  deadline_time: string | null;
  is_active: number;
  is_custom: number;
  frequency: string;
  active_days: string | null;
  created_at: string;
}

export interface DisciplineLog {
  id: number;
  discipline_id: number;
  log_date: string;
  completed: number;
  failed: number;
  xp_delta: number;
  notes: string | null;
  logged_at: string;
}

export interface SilenceStreak {
  id: number;
  current_streak: number;
  longest_streak: number;
  last_success_date: string | null;
  total_relapses: number;
  last_relapse_date: string | null;
}

export interface Cosmetic {
  id: number;
  type: CosmeticType;
  tier: number;
  name: string;
  unlocked: number;
  equipped: number;
  unlocked_at: string | null;
}

export interface Mandate {
  id: number;
  tier: MandateTier;
  opened: number;
  granted_at: string;
  opened_at: string | null;
  loot_type: string | null;
  loot_id: number | null;
}

export interface SystemState {
  key: string;
  value: string;
}

export interface SchemaVersion {
  version: number;
  applied_at: string;
}
