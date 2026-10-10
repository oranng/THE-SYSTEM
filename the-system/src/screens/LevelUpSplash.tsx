import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions,
} from 'react-native';
import Svg, { Line, Polygon, Circle } from 'react-native-svg';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RouteProp } from '@react-navigation/native';
import { useSystemStore } from '../store/useSystemStore';
import { RANK_TITLES } from '../engine/xpConstants';
import { CornerBrackets } from '../components/ui/CornerBox';
import { FONTS } from '../theme/typography';
import type { RootStackParamList } from '../navigation/types';
import type { Rank } from '../types';

type Nav = StackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'LevelUpSplash'>;

const { width, height } = Dimensions.get('window');

const RANK_COLORS: Record<string, string> = {
  E: '#888888', D: '#b87333', C: '#f0a500',
  B: '#ffd700', A: '#ffe566', S: '#ffffff',
};

const RAY_COUNT = 16;

function RadiatingRays({ color, size }: { color: string; size: number }) {
  const cx = size / 2;
  const cy = size / 2;
  return (
    <Svg width={size} height={size} style={{ position: 'absolute' }}>
      {Array.from({ length: RAY_COUNT }, (_, i) => {
        const angle = (i / RAY_COUNT) * Math.PI * 2;
        const x1 = cx + Math.cos(angle) * 60;
        const y1 = cy + Math.sin(angle) * 60;
        const x2 = cx + Math.cos(angle) * size * 0.46;
        const y2 = cy + Math.sin(angle) * size * 0.46;
        return (
          <Line
            key={i}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={color}
            strokeWidth="1"
            strokeOpacity={0.25}
          />
        );
      })}
      {/* Inner ring */}
      {Array.from({ length: 6 }, (_, i) => {
        const angle = (i / 6) * Math.PI * 2;
        const px = cx + Math.cos(angle) * 50;
        const py = cy + Math.sin(angle) * 50;
        return (
          <Polygon
            key={i}
            points={`${px},${py - 3} ${px + 3},${py} ${px},${py + 3} ${px - 3},${py}`}
            fill={color}
            fillOpacity={0.5}
          />
        );
      })}
    </Svg>
  );
}

export default function LevelUpSplash() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { level, xpGained, rankChanged, newRank } = route.params;
  const theme = useSystemStore((s) => s.currentTheme);

  const scaleAnim = useRef(new Animated.Value(0.4)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0.2)).current;
  const rayAnim = useRef(new Animated.Value(0)).current;

  const rankColor = RANK_COLORS[newRank] ?? theme.accent;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1, friction: 5, tension: 40, useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(rayAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
    ]).start();

    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      ])
    );
    glowLoop.start();
    return () => glowLoop.stop();
  }, [scaleAnim, fadeAnim, glowAnim, rayAnim]);

  const panelSize = Math.min(width * 0.88, 340);

  return (
    <View style={styles.overlay}>
      <Animated.View style={[styles.panel, { width: panelSize, opacity: fadeAnim, backgroundColor: '#000000' }]}>
        <CornerBrackets color={rankColor} thickness={2} length={24} style={{ zIndex: 2 }} />

        {/* Radiating rays */}
        <Animated.View style={[styles.raysWrap, { opacity: rayAnim }]}>
          <RadiatingRays color={rankColor} size={panelSize} />
        </Animated.View>

        {/* Content */}
        <View style={styles.panelContent}>
          {rankChanged ? (
            <>
              <Text style={[styles.eventLabel, { color: rankColor }]}>Новый ранг</Text>
              <View style={[styles.rankDivider, { backgroundColor: rankColor + '50' }]} />
              <Animated.View style={[styles.bigLetterWrap, { transform: [{ scale: scaleAnim }] }]}>
                <Animated.Text style={[styles.rankLetter, { color: rankColor, opacity: glowAnim }]}>
                  {newRank}
                </Animated.Text>
                <Text style={[styles.rankLetterBg, { color: rankColor + '20' }]}>{newRank}</Text>
              </Animated.View>
              <Text style={[styles.rankName, { color: theme.text }]}>
                {RANK_TITLES[newRank as Rank] ?? ''}
              </Text>
            </>
          ) : (
            <>
              <Text style={[styles.eventLabel, { color: rankColor }]}>Уровень повышен</Text>
              <View style={[styles.rankDivider, { backgroundColor: rankColor + '50' }]} />
              <Animated.View style={[styles.bigLetterWrap, { transform: [{ scale: scaleAnim }] }]}>
                <Animated.Text style={[styles.levelNumber, { color: rankColor, opacity: glowAnim }]}>
                  {level}
                </Animated.Text>
              </Animated.View>
              <Text style={[styles.rankName, { color: theme.textSecondary }]}>
                РАНГ {newRank} · УР. {level}
              </Text>
            </>
          )}

          <View style={styles.xpRow}>
            <View style={[styles.xpBadge, { borderColor: rankColor + '60' }]}>
              <CornerBrackets color={rankColor + '60'} length={8} />
              <Text style={[styles.xpText, { color: rankColor }]}>+{xpGained} опыта</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.continueBtn, { borderColor: rankColor, backgroundColor: rankColor + '15' }]}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <CornerBrackets color={rankColor} thickness={1} length={8} />
            <Text style={[styles.continueTxt, { color: rankColor }]}>Продолжить</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  panel: {
    borderWidth: 1,
    borderColor: '#333',
    position: 'relative',
    overflow: 'hidden',
    alignItems: 'center',
  },
  raysWrap: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelContent: {
    alignItems: 'center',
    padding: 40,
    paddingVertical: 44,
    zIndex: 1,
  },
  eventLabel: {
    fontSize: 12,
    letterSpacing: 0.3,
    marginBottom: 12,
    fontFamily: FONTS.display,
  },
  rankDivider: {
    width: 60,
    height: 1,
    marginBottom: 20,
  },
  bigLetterWrap: {
    position: 'relative',
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankLetter: {
    fontFamily: 'Lora_600SemiBold',
    fontSize: 98,
    lineHeight: 100,
  },
  rankLetterBg: {
    fontFamily: 'Lora_600SemiBold',
    position: 'absolute',
    fontSize: 120,
    lineHeight: 120,
  },
  levelNumber: {
    fontFamily: 'Lora_600SemiBold',
    fontSize: 98,
    lineHeight: 100,
  },
  rankName: {
    fontSize: 13,
    letterSpacing: 0.3,
    marginBottom: 28,
    fontFamily: FONTS.body,
  },
  xpRow: {
    marginBottom: 28,
  },
  xpBadge: {
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 6,
    position: 'relative',
  },
  xpText: {
    fontSize: 15,
    letterSpacing: 0.5,
    fontFamily: FONTS.bold,
  },
  continueBtn: {
    borderWidth: 1,
    paddingHorizontal: 40,
    paddingVertical: 14,
    position: 'relative',
  },
  continueTxt: {
    fontSize: 13,
    letterSpacing: 0.3,
    fontFamily: FONTS.display,
  },
});
