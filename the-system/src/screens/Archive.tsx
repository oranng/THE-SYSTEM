import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSystemStore } from '../store/useSystemStore';
import {
  getLogsForRange, getAllMandates, getAllLogs, getSilenceStreak,
} from '../db/queries';
import { differenceInCalendarDays, parseISO, format, subDays, addDays } from 'date-fns';
import type { DisciplineLog, Mandate, Rank } from '../types';
import SystemBackground from '../components/fx/SystemBackground';
import AmbientEmbers from '../components/fx/AmbientEmbers';
import { RANK_TITLES } from '../engine/xpConstants';
import SectionDivider from '../components/ui/SectionDivider';
import CornerFrame from '../components/ui/CornerFrame';
import { CornerBrackets } from '../components/ui/CornerBox';
import Glyph from '../components/icons/Glyph';
import { FONTS } from '../theme/typography';

type Tab = 'overview' | 'disciplines' | 'streaks' | 'history';

const TAB_LABELS: Record<Tab, string> = {
  overview: 'Обзор',
  disciplines: 'Испытания',
  streaks: 'Серии',
  history: 'История',
};

function HeatCell({ completed, failed, future }: { completed: boolean; failed: boolean; future: boolean }) {
  return (
    <View style={[
      heatStyles.cell,
      future
        ? { backgroundColor: '#141414', borderColor: '#1e1e1e' }
        : {
            backgroundColor: completed ? '#1a4a1a' : failed ? '#4a1a1a' : '#1a1a1a',
            borderColor: completed ? '#4caf50' : failed ? '#f44336' : '#2a2a2a',
          },
    ]} />
  );
}

const heatStyles = StyleSheet.create({
  cell: { width: 11, height: 11, borderRadius: 1, borderWidth: 1 },
});

const HEAT_WINDOW = 28;
const JOURNEY_DAYS = 180;

// Journey-anchored heatmap: up to 28 cells ending at today, with upcoming days
// shown as dim "future" cells. The right edge is capped at Day 180 — so once the
// window would reach the journey's end the cell count SHRINKS to the days left
// instead of forcing 28 (it can never show days beyond 180).
function HeatmapRow({ logs, journeyStartDate }: { logs: DisciplineLog[]; journeyStartDate: string }) {
  const start = parseISO(journeyStartDate);
  const todayIdx = Math.max(differenceInCalendarDays(new Date(), start), 0); // 0-based
  const offset = Math.max(0, todayIdx - (HEAT_WINDOW - 1));
  const rightEdge = Math.min(offset + HEAT_WINDOW - 1, JOURNEY_DAYS - 1); // cap at Day 180
  const count = rightEdge - offset + 1; // 28 normally, fewer once it hits Day 180

  const days = Array.from({ length: count }, (_, i) => {
    const dayIndex = offset + i;
    const dateStr = format(addDays(start, dayIndex), 'yyyy-MM-dd');
    const log = logs.find((l) => l.log_date === dateStr);
    return { completed: !!log?.completed, failed: !!log?.failed, future: dayIndex > todayIdx };
  });
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
      {days.map((d, i) => <HeatCell key={i} completed={d.completed} failed={d.failed} future={d.future} />)}
    </View>
  );
}

function BigStat({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <CornerFrame color={color + '40'} size={8} thickness={1} style={bigStatStyles.wrap}>
      <View style={bigStatStyles.inner}>
        <Text style={[bigStatStyles.value, { color }]} numberOfLines={2} adjustsFontSizeToFit>{value}</Text>
        <Text style={[bigStatStyles.label, { color: '#666' }]}>{label}</Text>
      </View>
    </CornerFrame>
  );
}

const bigStatStyles = StyleSheet.create({
  wrap: { flex: 1 },
  inner: { padding: 14, alignItems: 'center', gap: 4 },
  value: { fontSize: 22, textAlign: 'center', fontFamily: FONTS.display },
  label: { fontSize: 10, letterSpacing: 0.5, textAlign: 'center', fontFamily: FONTS.body },
});

export default function Archive() {
  const insets = useSafeAreaInsets();
  const { hero, disciplines, currentTheme: theme } = useSystemStore();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [mandates, setMandates] = useState<Mandate[]>([]);
  const [disciplineLogs, setDisciplineLogs] = useState<Record<number, DisciplineLog[]>>({});
  const [recentLogs, setRecentLogs] = useState<DisciplineLog[]>([]);
  const [silenceData, setSilenceData] = useState<{
    current_streak: number; longest_streak: number; total_relapses: number;
  } | null>(null);

  useEffect(() => {
    if (!hero) return;
    getAllMandates().then(setMandates);
    getSilenceStreak().then(setSilenceData);
    const today = format(new Date(), 'yyyy-MM-dd');
    const start = format(subDays(new Date(), 28), 'yyyy-MM-dd');
    getLogsForRange(start, today).then(setRecentLogs);
  }, [hero]);

  // Load per-discipline logs for the Missions/Streaks tabs in ONE query, then
  // group in JS — the old per-discipline sequential queries caused the lag.
  useEffect(() => {
    if (activeTab !== 'disciplines' && activeTab !== 'streaks') return;
    let cancelled = false;
    getAllLogs().then((all) => {
      if (cancelled) return;
      const grouped: Record<number, DisciplineLog[]> = {};
      for (const log of all) {
        (grouped[log.discipline_id] ??= []).push(log);
      }
      setDisciplineLogs(grouped);
    });
    return () => { cancelled = true; };
  }, [activeTab, disciplines]);

  if (!hero) return null;

  const daysElapsed = differenceInCalendarDays(new Date(), parseISO(hero.journey_start_date)) + 1;
  const progressPct = Math.min(daysElapsed / 180, 1);
  const TABS: Tab[] = ['overview', 'disciplines', 'streaks', 'history'];

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <SystemBackground color={theme.accent} background={theme.background} />
      <AmbientEmbers color={theme.auraColor ?? theme.accent} />
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.accent + '30' }]}>
        <Text style={[styles.title, { color: theme.text }]}>Архив</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Летопись становления</Text>
      </View>

      {/* Tab bar */}
      <View style={[styles.tabBar, { borderBottomColor: theme.accent + '20' }]}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[
              styles.tabBtn,
              activeTab === tab && [styles.tabBtnActive, { borderBottomColor: theme.accent }],
            ]}
            onPress={() => setActiveTab(tab)}
          >
            {activeTab === tab && (
              <Svg width={6} height={6} style={styles.tabGem}>
                <Polygon points="3,0 6,3 3,6 0,3" fill={theme.accent} />
              </Svg>
            )}
            <Text style={[
              styles.tabTxt,
              { color: activeTab === tab ? theme.accent : theme.textSecondary },
            ]}>
              {TAB_LABELS[tab]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ── OVERVIEW ── */}
        {activeTab === 'overview' && (
          <View style={styles.section}>
            <SectionDivider title="Путь" color={theme.accent} style={styles.firstDivider} />

            {/* Progress bar */}
            <CornerFrame color={theme.accent + '50'} size={8} thickness={1} style={styles.journeyWrap}>
              <View style={styles.journeyInner}>
                <View style={styles.journeyTopRow}>
                  <Text style={[styles.journeyDay, { color: theme.accent }]}>ДЕНЬ {daysElapsed}</Text>
                  <Text style={[styles.journeyOf, { color: theme.textSecondary }]}>ИЗ 180</Text>
                </View>
                <View style={[styles.journeyBg, { backgroundColor: '#111' }]}>
                  <View style={[styles.journeyFill, { width: `${progressPct * 100}%`, backgroundColor: theme.accent }]} />
                  {[25, 50, 75].map((p) => (
                    <View key={p} style={[styles.journeyTick, { left: `${p}%` as `${number}%` }]} />
                  ))}
                </View>
                <Text style={[styles.journeyPct, { color: theme.textSecondary }]}>
                  ПРОЙДЕНО {Math.round(progressPct * 100)}%
                </Text>
              </View>
            </CornerFrame>

            <SectionDivider title="Статистика" color={theme.accent} />
            <View style={styles.statsGrid}>
              <BigStat value={'Ранг ' + hero.rank} label="Текущий ранг" color={theme.accent} />
              <BigStat value={RANK_TITLES[hero.rank as Rank]} label="Титул" color={theme.accent} />
            </View>
            <View style={styles.statsGrid}>
              <BigStat value={hero.global_xp.toLocaleString()} label="Всего опыта" color={theme.accent} />
              <BigStat value={String(mandates.length)} label="Мандаты" color={theme.accent} />
            </View>
          </View>
        )}

        {/* ── DISCIPLINES ── */}
        {activeTab === 'disciplines' && (
          <View style={styles.section}>
            {disciplines.map((d) => {
              const logs = disciplineLogs[d.id] ?? [];
              const completed = logs.filter((l) => l.completed).length;
              const failed = logs.filter((l) => l.failed).length;
              const recentForThis = recentLogs.filter((l) => l.discipline_id === d.id);
              const rate = logs.length > 0 ? completed / logs.length : 0;
              return (
                <View key={d.id} style={[styles.disciplineCard, { borderColor: theme.accent + '30', backgroundColor: theme.primary }]}>
                  <CornerBrackets color={theme.accent + '30'} />
                  <View style={styles.disciplineTop}>
                    <Text style={[styles.disciplineName, { color: theme.text }]}>{d.name}</Text>
                    <Text style={[styles.disciplineRate, { color: Math.round(rate * 100) >= 70 ? '#4caf50' : '#888' }]}>
                      {Math.round(rate * 100)}%
                    </Text>
                  </View>
                  <HeatmapRow logs={recentForThis} journeyStartDate={hero.journey_start_date} />
                  <View style={styles.disciplineStats}>
                    <View style={styles.dStatItem}>
                      <Glyph name="check" color="#4caf50" size={12} />
                      <Text style={[styles.dStat, { color: '#4caf50' }]}>{completed}</Text>
                    </View>
                    <View style={styles.dStatItem}>
                      <Glyph name="cross" color="#f44336" size={12} />
                      <Text style={[styles.dStat, { color: '#f44336' }]}>{failed}</Text>
                    </View>
                    <Text style={[styles.dStat, { color: '#666' }]}>всего {logs.length}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── STREAKS ── */}
        {activeTab === 'streaks' && (
          <View style={styles.section}>
            {silenceData && (
              <>
                <SectionDivider title="Протокол Тишины" color={theme.accent} style={styles.firstDivider} />
                <View style={styles.silenceGrid}>
                  <BigStat value={String(silenceData.current_streak)} label="Текущая серия" color={theme.accent} />
                  <BigStat value={String(silenceData.longest_streak)} label="Лучшая серия" color={theme.accent} />
                  <BigStat value={String(silenceData.total_relapses)} label="Срывы" color="#f44336" />
                </View>
              </>
            )}
            <SectionDivider title="Все испытания" color={theme.accent} />
            {disciplines.map((d) => {
              const logs = disciplineLogs[d.id] ?? [];
              const total = logs.filter((l) => l.completed).length;
              const pct = logs.length > 0 ? total / logs.length : 0;
              return (
                <View key={d.id} style={[styles.streakRow, { borderBottomColor: '#1e1e1e' }]}>
                  <Text style={[styles.streakName, { color: theme.text }]}>{d.name}</Text>
                  <View style={styles.streakRight}>
                    <View style={[styles.streakBarBg, { backgroundColor: '#111' }]}>
                      <View style={[styles.streakBarFill, { width: `${pct * 100}%`, backgroundColor: theme.accent }]} />
                    </View>
                    <Text style={[styles.streakCount, { color: theme.accent }]}>{total}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── HISTORY ── */}
        {activeTab === 'history' && (
          <View style={styles.section}>
            <SectionDivider title="Последние 28 дней" color={theme.accent} style={styles.firstDivider} />
            {[...new Set(recentLogs.map((l) => l.log_date))].sort().reverse().map((date) => {
              const dayLogs = recentLogs.filter((l) => l.log_date === date);
              const comp = dayLogs.filter((l) => l.completed).length;
              // Net XP for the day: gains minus losses (auto-fails included).
              const xp = dayLogs.reduce((s, l) => s + l.xp_delta, 0);
              const pct = disciplines.length > 0 ? comp / disciplines.length : 0;
              return (
                <View key={date} style={[styles.histRow, { borderBottomColor: '#1a1a1a' }]}>
                  <View style={styles.histLeft}>
                    <Text style={[styles.histDate, { color: theme.textSecondary }]}>{date}</Text>
                    <View style={[styles.histBarBg, { backgroundColor: '#111' }]}>
                      <View style={[styles.histBarFill, { width: `${pct * 100}%`, backgroundColor: theme.accent + 'aa' }]} />
                    </View>
                  </View>
                  <Text style={[styles.histComp, { color: comp > 0 ? '#4caf50' : '#444' }]}>
                    {comp}/{disciplines.length}
                  </Text>
                  <Text style={[styles.histXP, { color: xp >= 0 ? theme.accent : '#f44336' }]}>
                    {xp >= 0 ? '+' : ''}{xp}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        <View style={{ height: 64 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  title: { fontSize: 17, letterSpacing: 0.3, fontFamily: FONTS.display },
  subtitle: { fontSize: 10, letterSpacing: 0.5, marginTop: 3, fontFamily: FONTS.body },

  tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', position: 'relative' },
  tabBtnActive: { borderBottomWidth: 2 },
  tabGem: { position: 'absolute', top: 4 },
  tabTxt: { fontSize: 9, letterSpacing: 0.3, fontFamily: FONTS.bold },

  scroll: { flex: 1 },
  section: { padding: 14 },
  firstDivider: { marginTop: 4 },

  journeyWrap: { marginBottom: 8 },
  journeyInner: { padding: 16, gap: 8 },
  journeyTopRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  journeyDay: { fontSize: 30, fontFamily: FONTS.display },
  journeyOf: { fontSize: 13, fontFamily: FONTS.body },
  journeyBg: { height: 8, overflow: 'hidden', position: 'relative' },
  journeyFill: { height: 8, position: 'absolute', left: 0, top: 0, bottom: 0 },
  journeyTick: { position: 'absolute', top: 1, bottom: 1, width: 1, backgroundColor: '#000' },
  journeyPct: { fontSize: 11, letterSpacing: 0.3, fontFamily: FONTS.body },

  statsGrid: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  silenceGrid: { flexDirection: 'row', gap: 8, marginBottom: 8 },

  disciplineCard: {
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
    gap: 8,
    position: 'relative',
  },
  disciplineTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  disciplineName: { fontSize: 14, fontFamily: FONTS.bold },
  disciplineRate: { fontSize: 16, fontFamily: FONTS.display },
  disciplineStats: { flexDirection: 'row', gap: 16 },
  dStatItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dStat: { fontSize: 13, fontFamily: FONTS.display },

  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 12,
  },
  streakName: { fontSize: 13, flex: 1, fontFamily: FONTS.body },
  streakRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  streakBarBg: { width: 80, height: 6, overflow: 'hidden' },
  streakBarFill: { height: 6, position: 'absolute', left: 0, top: 0 },
  streakCount: { fontSize: 14, minWidth: 28, textAlign: 'right', fontFamily: FONTS.bold },

  histRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    gap: 10,
  },
  histLeft: { flex: 1, gap: 3 },
  histDate: { fontSize: 12, fontFamily: FONTS.body },
  histBarBg: { height: 3, overflow: 'hidden' },
  histBarFill: { height: 3, position: 'absolute', left: 0, top: 0 },
  histComp: { fontSize: 13, minWidth: 40, textAlign: 'center', fontFamily: FONTS.bold },
  histXP: { fontSize: 13, minWidth: 50, textAlign: 'right', fontFamily: FONTS.bold },
});
