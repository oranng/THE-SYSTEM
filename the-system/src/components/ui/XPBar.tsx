import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useSystemStore } from '../../store/useSystemStore';
import { getXpForLevel, XP_TABLE } from '../../engine/xpConstants';
import { CornerBrackets } from './CornerBox';
import { FONTS } from '../../theme/typography';

export default function XPBar() {
  const hero = useSystemStore((s) => s.hero);
  const theme = useSystemStore((s) => s.currentTheme);
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(shimmerAnim, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmerAnim]);

  if (!hero) return null;

  const currentXP = hero.global_xp;
  const currentLevelXP = XP_TABLE[hero.global_level] ?? 0;
  const nextLevelXP = getXpForLevel(hero.global_level + 1);

  let progress = 1;
  let xpLabel = 'МАКС';
  if (nextLevelXP !== null) {
    const range = nextLevelXP - currentLevelXP;
    const earned = currentXP - currentLevelXP;
    progress = range > 0 ? Math.min(1, Math.max(0, earned / range)) : 0;
    xpLabel = `${currentXP.toLocaleString()} / ${nextLevelXP.toLocaleString()}`;
  }

  const shimmerOpacity = shimmerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.9] });

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {/* Level badge */}
        <View style={[styles.levelBadge, { borderColor: theme.accent + 'aa' }]}>
          <CornerBrackets color={theme.accent + 'aa'} length={8} />
          <Text style={[styles.lvlLabel, { color: theme.textSecondary }]}>УР.</Text>
          <Text style={[styles.lvlNum, { color: theme.accent }]}>{hero.global_level}</Text>
        </View>

        {/* Bar */}
        <View style={styles.barWrap}>
          {/* Corner ticks */}
          <CornerBrackets color={theme.accent + '80'} thickness={1} length={6} />

          <View style={[styles.barBg, { backgroundColor: theme.background }]}>
            {/* Fill */}
            <View style={[styles.barFill, { width: `${progress * 100}%`, backgroundColor: theme.accent + 'cc' }]} />
            {/* Shimmer overlay on fill */}
            <Animated.View
              style={[
                styles.shimmer,
                {
                  width: `${progress * 100}%`,
                  backgroundColor: theme.accent,
                  opacity: shimmerOpacity,
                },
              ]}
            />
            {/* Segment ticks */}
            {[25, 50, 75].map((pct) => (
              <View
                key={pct}
                style={[styles.segTick, { left: `${pct}%` as `${number}%`, backgroundColor: theme.background + 'cc' }]}
              />
            ))}
          </View>
        </View>

        {/* XP text */}
        <Text style={[styles.xpText, { color: theme.textSecondary }]}>{xpLabel} опыта</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 14, paddingVertical: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  levelBadge: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
    minWidth: 44,
    position: 'relative',
  },
  lvlLabel: { fontSize: 9, letterSpacing: 1, fontFamily: FONTS.bold },
  lvlNum: { fontSize: 20, lineHeight: 24, fontFamily: FONTS.display },
  barWrap: {
    flex: 1,
    height: 18,
    position: 'relative',
    padding: 2,
  },
  barBg: {
    flex: 1,
    overflow: 'hidden',
    flexDirection: 'row',
    position: 'relative',
  },
  barFill: {
    height: '100%',
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  shimmer: {
    height: 2,
    position: 'absolute',
    left: 0,
    top: 3,
    bottom: 0,
  },
  segTick: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
  },
  xpText: { fontSize: 11, letterSpacing: 0.5, minWidth: 110, textAlign: 'right', fontFamily: FONTS.body },
});
