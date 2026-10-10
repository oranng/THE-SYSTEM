import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Animated, Dimensions,
} from 'react-native';
import Svg, { Polygon, Line, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import UsageStatsModule from '../native/UsageStatsModule';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useSystemStore } from '../store/useSystemStore';
import { RANK_TITLES } from '../engine/xpConstants';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import XPBar from '../components/ui/XPBar';
import { CornerBrackets } from '../components/ui/CornerBox';
import DisciplineCard from '../components/ui/DisciplineCard';
import ConfirmModal from '../components/ui/ConfirmModal';
import PixelText from '../components/ui/PixelText';
import SectionDivider from '../components/ui/SectionDivider';
import AvatarDisplay from '../components/avatar/AvatarDisplay';
import AvatarOrbit from '../components/avatar/AvatarOrbit';
import SystemBackground from '../components/fx/SystemBackground';
import AmbientEmbers from '../components/fx/AmbientEmbers';
import { getRandomQuote } from '../data/quotes';
import { getSystemState, setSystemState } from '../db/queries';
import Glyph from '../components/icons/Glyph';
import { FONTS } from '../theme/typography';
import { TIER_LABELS, plural } from '../i18n/labels';

const ORBIT_BY_RANK: Record<string, number> = { E: 0, D: 2, C: 3, B: 5, A: 7, S: 10 };
import type { Rank } from '../types';
import type { RootStackParamList } from '../navigation/types';
import type { HeroClass } from '../components/avatar/avatarData';

type Nav = StackNavigationProp<RootStackParamList>;

const { width } = Dimensions.get('window');

function SettingsIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 22 22">
      <Polygon points="11,2 13,7 18,7 14,10 16,16 11,13 6,16 8,10 4,7 9,7" fill="none" stroke={color} strokeWidth="1.5" />
      <Polygon points="11,8 12,10.5 11,13 10,10.5" fill={color} />
    </Svg>
  );
}

function HexagonFrame({ color, size = 80 }: { color: string; size?: number }) {
  const s = size;
  const cx = s / 2;
  const r = s / 2 - 2;
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    return `${cx + r * Math.cos(a)},${(s / 2) + r * Math.sin(a)}`;
  }).join(' ');
  return (
    <Svg width={s} height={s} style={{ position: 'absolute' }}>
      <Polygon points={pts} fill="none" stroke={color} strokeWidth="1.5" />
    </Svg>
  );
}

function RankBadge({ rank, color }: { rank: string; color: string }) {
  return (
    <View style={[styles.rankBadgeOuter, { borderColor: color + '80' }]}>
      <View style={[styles.rankBadgeInner, { backgroundColor: color + '15' }]}>
        <PixelText size={20} color={color}>{rank}</PixelText>
      </View>
      {/* Corner ticks */}
      <CornerBrackets color={color} thickness={2} length={7} inset={-1} />
    </View>
  );
}

function PresenceWidget({ theme }: { theme: any }) {
  const [minutes, setMinutes] = React.useState<number>(-1);
  React.useEffect(() => {
    const fetch = async () => {
      const mins = await UsageStatsModule.getScrollingTimeToday();
      setMinutes(mins);
    };
    fetch();
    const id = setInterval(fetch, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);
  if (minutes < 0) {
    // No UsageStats permission yet — offer to grant it so The Veil can track.
    return (
      <TouchableOpacity
        style={[styles.presenceGrant, { borderColor: theme.accent + '50' }]}
        onPress={() => { UsageStatsModule.openUsageAccessSettings().catch(() => {}); }}
        activeOpacity={0.8}
      >
        <CornerBrackets color={theme.accent + '50'} length={8} />
        <Text style={[styles.presenceGrantTxt, { color: theme.accent }]}>
          Дай доступ к статистике — Система будет следить за Завесой
        </Text>
      </TouchableOpacity>
    );
  }
  return <PresenceBar minutes={minutes} theme={theme} />;
}

function PresenceBar({ minutes, theme }: { minutes: number; theme: any }) {
  const limit = 30;
  const pct = Math.min(minutes / limit, 1);
  const overLimit = minutes > limit;
  const barColor = overLimit ? '#f44336' : '#4caf50';
  return (
    <View style={styles.presenceWrap}>
      <View style={styles.presenceRow}>
        <Text style={[styles.presenceLabel, { color: theme.textSecondary }]}>Соцсети</Text>
        <View style={styles.presenceTimeRow}>
          <Text style={[styles.presenceTime, { color: barColor }]}>{Math.round(minutes)} мин</Text>
          <Glyph name={overLimit ? 'up' : 'check'} color={barColor} size={12} />
          <Text style={[styles.presenceTime, { color: barColor }]}>{overLimit ? 'ПРЕВЫШЕНО' : 'В НОРМЕ'}</Text>
        </View>
      </View>
      <View style={[styles.presenceBg, { backgroundColor: '#2A2725' }]}>
        <View style={[styles.presenceFill, { width: `${pct * 100}%`, backgroundColor: barColor }]} />
        <View style={[styles.presenceLimit, { left: '100%', backgroundColor: theme.textSecondary + '40' }]} />
      </View>
    </View>
  );
}

export default function CommandHall() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const {
    hero, disciplines, todayLogs, silenceStreak, pendingMandate, currentTheme: theme,
    completeDiscipline, failDiscipline, triggerRelapse, requestMandate, relapseLocked,
  } = useSystemStore();

  const floatAnim = React.useRef(new Animated.Value(0)).current;
  const glowAnim = React.useRef(new Animated.Value(0.4)).current;
  const avatarFloat = React.useRef(new Animated.Value(0)).current;

  // Reroll on every mount (i.e. each time the app lands on home).
  const quote = React.useRef(getRandomQuote()).current;

  // Themed confirm panel for breaking the Silence Protocol (full reset).
  const [silenceConfirm, setSilenceConfirm] = React.useState(false);
  // App-styled info panel (replaces the Android default alert).
  const [petitionInfo, setPetitionInfo] = React.useState<string | null>(null);

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(avatarFloat, { toValue: -6, duration: 1600, useNativeDriver: true }),
        Animated.timing(avatarFloat, { toValue: 0, duration: 1600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [avatarFloat]);

  React.useEffect(() => {
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.4, duration: 2000, useNativeDriver: true }),
      ])
    );
    glowLoop.start();
    return () => glowLoop.stop();
  }, [glowAnim]);

  // Show the Final Judgement once, when the 24-week journey completes (the
  // midnight engine sets journey_complete + stashes the consistency rate).
  React.useEffect(() => {
    if (hero?.journey_complete !== 1) return;
    (async () => {
      const rate = await getSystemState('final_consistency_rate');
      const seen = await getSystemState('final_judgement_seen');
      if (rate !== null && seen !== '1') {
        await setSystemState('final_judgement_seen', '1');
        navigation.navigate('FinalJudgement');
      }
    })();
  }, [hero?.journey_complete, navigation]);

  React.useEffect(() => {
    if (!pendingMandate) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -8, duration: 900, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pendingMandate, floatAnim]);

  if (!hero) return null;

  const daysElapsed = differenceInCalendarDays(new Date(), parseISO(hero.journey_start_date));
  const dayNumber = Math.min(daysElapsed + 1, 180);
  const activeDisciplines = disciplines.filter((d) => d.is_active);

  const completedToday = todayLogs.filter((l) => l.completed).length;
  const completionRate = activeDisciplines.length > 0 ? completedToday / activeDisciplines.length : 0;
  const mood = completionRate >= 0.9 ? 'radiant' : completionRate >= 0.6 ? 'steady' : completionRate >= 0.3 ? 'worn' : 'broken';

  const handleComplete = async (id: number) => {
    const result = await completeDiscipline(id);
    if (!result.levelUp) return;
    // Reaching S-Rank plays the full transcendence cutscene; every other
    // level-up / rank-up shows the level splash.
    if (result.levelUp.rankChanged && result.levelUp.newRank === 'S') {
      navigation.navigate('SRankCutscene');
    } else {
      navigation.navigate('LevelUpSplash', {
        level: result.levelUp.newLevel,
        xpGained: result.xpGained,
        rankChanged: result.levelUp.rankChanged,
        newRank: result.levelUp.newRank,
      });
    }
  };

  const handlePetition = async () => {
    const granted = await requestMandate();
    if (!granted) {
      setPetitionInfo('Система пока не выдаёт мандат. Просить снова можно через 7 дней после прошлой просьбы.');
    }
    // On success the chest appears via the refreshed pendingMandate.
  };

  const handleFail = async (id: number, code: string) => {
    if (code === 'SILENCE') {
      setSilenceConfirm(true);
    } else {
      await failDiscipline(id);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <SystemBackground color={theme.accent} background={theme.background} />
      <AmbientEmbers color={theme.auraColor ?? theme.accent} />

      {/* ── TOP HUD BAR ── */}
      <View style={[styles.hudBar, { borderBottomColor: theme.accent + '30' }]}>
        <RankBadge rank={hero.rank} color={theme.accent} />

        <View style={styles.hudCenter}>
          <PixelText size={10} color={theme.textSecondary}>
            {hero.name}
          </PixelText>
          <View style={styles.dayRow}>
            <View style={[styles.dayDot, { backgroundColor: relapseLocked ? '#8a3b3b' : theme.accent }]} />
            {relapseLocked ? (
              <Text style={[styles.dayText, { color: '#c97b7b' }]}>Падение</Text>
            ) : (
              <>
                <Text style={[styles.dayText, { color: theme.accent }]}>День {dayNumber}</Text>
                <Text style={[styles.dayOf, { color: theme.textSecondary }]}> / 180</Text>
              </>
            )}
          </View>
          <Text style={[styles.rankTitle, { color: theme.textSecondary }]}>
            {RANK_TITLES[hero.rank as Rank]}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => navigation.navigate('Settings')}
          style={styles.settingsBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <SettingsIcon color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* ── DAILY QUOTE (rerolls each open) ── */}
      <View style={[styles.quoteBox, { borderLeftColor: theme.accent }]}>
        <Text style={[styles.quoteText, { color: theme.text }]}>
          “{quote.text}”
        </Text>
        {quote.author && (
          <Text style={[styles.quoteAuthor, { color: theme.accent }]}>
            — {quote.author}
          </Text>
        )}
      </View>

      {/* ── AVATAR AREA ── */}
      <View style={styles.avatarSection}>
        {/* Avatar frame */}
        <View style={styles.avatarFrame}>
          {/* Rank aura glow — intensifies with screenGlow ranks */}
          <Animated.View
            style={[
              styles.avatarGlow,
              {
                backgroundColor: (theme.auraColor ?? theme.accent) + '22',
                shadowColor: theme.auraColor ?? theme.accent,
                shadowRadius: theme.screenGlow ? 34 : 18,
                opacity: glowAnim.interpolate({
                  inputRange: [0.4, 1],
                  outputRange: [0.35, 0.85],
                }),
              },
            ]}
          />
          <AvatarOrbit
            color={theme.auraColor ?? theme.accent}
            count={ORBIT_BY_RANK[hero.rank] ?? 0}
            radius={54}
          />
          <HexagonFrame color={theme.accent + '55'} size={132} />
          <Animated.View
            style={{ opacity: glowAnim, transform: [{ translateY: avatarFloat }] }}
          >
            <AvatarDisplay
              heroClass={hero.hero_class as HeroClass}
              rank={hero.rank}
              mood={mood}
              pixelSize={6}
            />
          </Animated.View>
        </View>

        {/* Silence streak */}
        {silenceStreak && silenceStreak.current_streak > 0 && (
          <View style={styles.streakBox}>
            <PixelText size={32} color={theme.accent}>{String(silenceStreak.current_streak)}</PixelText>
            <Text style={[styles.streakLabel, { color: theme.textSecondary }]}>{plural(silenceStreak.current_streak, ['день', 'дня', 'дней'])} чистоты</Text>
          </View>
        )}

        {/* Mandate chest — pending chest to open, or petition for a new one */}
        {pendingMandate ? (
          <Animated.View style={[styles.chestFloat, { transform: [{ translateY: floatAnim }] }]}>
            <TouchableOpacity
              onPress={() => navigation.navigate('MandateReveal')}
              style={[styles.chestBtn, { borderColor: theme.accent, backgroundColor: theme.accent + '20' }]}
            >
              <CornerBrackets color={theme.accent} thickness={1.5} length={8} />
              <Glyph name="chest" color={theme.accent} size={28} />
              <Text style={[styles.chestTier, { color: theme.accent }]}>{TIER_LABELS[pendingMandate.tier] ?? pendingMandate.tier}</Text>
            </TouchableOpacity>
          </Animated.View>
        ) : relapseLocked ? null : (
          <View style={styles.chestFloat}>
            <TouchableOpacity
              onPress={handlePetition}
              style={[styles.chestBtn, { borderColor: theme.accent + '50', backgroundColor: theme.accent + '0d' }]}
            >
              <CornerBrackets color={theme.accent + '50'} thickness={1.5} length={8} />
              <Glyph name="chest" color={theme.accent + '80'} size={28} />
              <Text style={[styles.chestTier, { color: theme.accent + 'aa' }]}>ПРОСЬБА</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ── XP BAR ── */}
      <XPBar />

      {/* ── Presence ── */}
      <PresenceWidget theme={theme} />

      {/* ── QUEST LOG ── */}
      <SectionDivider
        title="Испытания дня"
        color={theme.accent}
        style={styles.sectionDivider}
      />

      {relapseLocked ? (
        <View style={[styles.fallenBanner, { borderColor: '#8a3b3b', backgroundColor: '#1a0d0d' }]}>
          <CornerBrackets color="#8a3b3b" length={8} />
          <Text style={styles.fallenText}>Срыв. Испытания закрыты до завтра.</Text>
        </View>
      ) : (
        <View style={styles.questProgress}>
          <Text style={[styles.questCount, { color: theme.textSecondary }]}>
            выполнено {completedToday}/{activeDisciplines.length}
          </Text>
          <View style={[styles.questProgressBar, { backgroundColor: '#2A2725' }]}>
            <View
              style={[
                styles.questProgressFill,
                { width: `${completionRate * 100}%`, backgroundColor: theme.accent },
              ]}
            />
          </View>
        </View>
      )}

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {activeDisciplines.map((discipline) => {
          const log = todayLogs.find((l) => l.discipline_id === discipline.id);
          return (
            <DisciplineCard
              key={discipline.id}
              discipline={discipline}
              log={log}
              theme={theme}
              locked={relapseLocked}
              onComplete={() => handleComplete(discipline.id)}
              onFail={() => handleFail(discipline.id, discipline.code)}
            />
          );
        })}

        {/* Shield Protocol */}
        <View style={styles.shieldSection}>
          <TouchableOpacity
            style={styles.shieldBtn}
            onPress={() => navigation.navigate('ShieldOverlay')}
            activeOpacity={0.8}
          >
            <View style={[styles.shieldInner, { borderColor: '#ff4444', backgroundColor: '#1a0000' }]}>
              <CornerBrackets color="#ff4444" thickness={1.5} length={10} />
              <View style={styles.shieldTitleRow}>
                <Glyph name="shield" color="#ff4444" size={18} />
                <Text style={styles.shieldText}>Протокол Щита</Text>
                <Glyph name="shield" color="#ff4444" size={18} />
              </View>
              <Text style={styles.shieldSub}>Включить цифровую крепость</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <ConfirmModal
        visible={silenceConfirm}
        destructive
        title="ПРОТОКОЛ ТИШИНЫ НАРУШЕН"
        message="Прогресс обнулится: опыт, уровень, ранг, история, мандаты и трофеи будут стёрты, путь начнётся заново с первого дня. Имя и звезда останутся, а срыв навсегда войдёт в твою летопись. Отменить нельзя."
        cancelText="ОТМЕНА"
        confirmText="ПРИЗНАЮ СРЫВ"
        onCancel={() => setSilenceConfirm(false)}
        onConfirm={() => {
          setSilenceConfirm(false);
          triggerRelapse();
        }}
      />

      <ConfirmModal
        visible={petitionInfo !== null}
        singleButton
        title="СИСТЕМА"
        message={petitionInfo ?? ''}
        confirmText="OK"
        onCancel={() => setPetitionInfo(null)}
        onConfirm={() => setPetitionInfo(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // HUD Bar
  hudBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  quoteBox: {
    marginHorizontal: 16,
    marginTop: 12,
    paddingLeft: 12,
    paddingVertical: 4,
    borderLeftWidth: 2,
  },
  quoteText: {
    fontSize: 13,
    lineHeight: 19,
    letterSpacing: 0.3,
    fontFamily: FONTS.italic,
  },
  quoteAuthor: {
    fontSize: 11,
    marginTop: 4,
    letterSpacing: 1,
    textAlign: 'right',
    fontFamily: FONTS.body,
  },
  rankBadgeOuter: {
    borderWidth: 1,
    padding: 2,
    position: 'relative',
  },
  rankBadgeInner: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignItems: 'center',
  },
  hudCenter: {
    flex: 1,
    alignItems: 'center',
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  dayDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  dayText: {
    fontSize: 17,
    letterSpacing: 1,
    fontFamily: FONTS.display,
  },
  dayOf: {
    fontSize: 14,
    fontFamily: FONTS.bold,
  },
  rankTitle: {
    fontSize: 10,
    letterSpacing: 0.5,
    marginTop: 2,
    fontFamily: FONTS.body,
  },
  settingsBtn: { padding: 4 },

  // Avatar
  avatarSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 16,
  },
  avatarFrame: {
    width: 132,
    height: 132,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarGlow: {
    position: 'absolute',
    width: 104,
    height: 104,
    borderRadius: 52,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    elevation: 8,
  },
  streakBox: {
    flex: 1,
    alignItems: 'center',
  },
  streakLabel: {
    fontSize: 10,
    letterSpacing: 0.5,
    marginTop: 2,
    fontFamily: FONTS.body,
  },
  chestFloat: {
    alignItems: 'center',
  },
  chestBtn: {
    borderWidth: 1.5,
    borderRadius: 4,
    padding: 8,
    alignItems: 'center',
    position: 'relative',
  },
  chestTier: {
    fontSize: 8,
    marginTop: 2,
    letterSpacing: 1,
    fontFamily: FONTS.bold,
  },

  // Presence
  presenceWrap: {
    paddingHorizontal: 14,
    marginBottom: 4,
  },
  presenceGrant: {
    marginHorizontal: 14,
    marginBottom: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    alignItems: 'center',
    position: 'relative',
  },
  presenceGrantTxt: {
    fontSize: 10,
    letterSpacing: 0.5,
    fontFamily: FONTS.bold,
  },
  presenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  presenceTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  presenceLabel: {
    fontSize: 10,
    letterSpacing: 0.5,
    fontFamily: FONTS.body,
  },
  presenceTime: {
    fontSize: 11,
    letterSpacing: 1,
    fontFamily: FONTS.bold,
  },
  presenceBg: {
    height: 3,
    overflow: 'hidden',
  },
  presenceFill: {
    height: 3,
    position: 'absolute',
    left: 0,
    top: 0,
  },
  presenceLimit: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
  },

  // Section
  sectionDivider: { marginTop: 4 },
  questProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginBottom: 8,
    gap: 10,
  },
  questCount: {
    fontSize: 11,
    letterSpacing: 1,
    minWidth: 110,
    fontFamily: FONTS.body,
  },
  questProgressBar: {
    flex: 1,
    height: 3,
    overflow: 'hidden',
  },
  questProgressFill: {
    height: 3,
  },
  fallenBanner: {
    marginHorizontal: 14,
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    alignItems: 'center',
    position: 'relative',
  },
  fallenText: {
    color: '#c97b7b',
    fontSize: 11,
    letterSpacing: 0.5,
    fontFamily: FONTS.bold,
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },

  // Shield
  shieldSection: { margin: 14, marginTop: 16 },
  shieldBtn: { overflow: 'hidden' },
  shieldInner: {
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    position: 'relative',
  },
  shieldTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shieldText: {
    color: '#ff4444',
    fontSize: 15,
    letterSpacing: 0.3,
    fontFamily: FONTS.display,
  },
  shieldSub: {
    color: '#ff444488',
    fontSize: 10,
    letterSpacing: 0.5,
    marginTop: 4,
    fontFamily: FONTS.body,
  },
});
