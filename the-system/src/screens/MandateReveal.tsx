import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions,
} from 'react-native';
import Svg, { Polygon, Line, Rect } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useSystemStore } from '../store/useSystemStore';
import { CornerBrackets } from '../components/ui/CornerBox';
import type { RootStackParamList } from '../navigation/types';
import { FONTS } from '../theme/typography';
import { TIER_LABELS } from '../i18n/labels';

type Nav = StackNavigationProp<RootStackParamList>;

const TIER_COLORS: Record<string, string> = {
  BRONZE: '#b87333',
  SILVER: '#c0c0c0',
  GOLD: '#ffd700',
};

const TIER_BG: Record<string, string> = {
  BRONZE: '#1a0d00',
  SILVER: '#0d0d10',
  GOLD: '#1a1400',
};

const LOOT_TYPE_LABELS: Record<string, string> = {
  scroll: 'Свиток Системы',
  title: 'Новый титул',
  accessory: 'Аксессуар',
  cosmetic_variant: 'Новый облик',
  background: 'Новый фон',
  equipment_tier: 'Улучшение снаряжения',
  aura_variant: 'Новая аура',
};

function ChestSvg({ color, opened }: { color: string; opened: boolean }) {
  return (
    <Svg width={100} height={80} viewBox="0 0 100 80">
      {/* Body */}
      <Rect x="10" y="35" width="80" height="45" fill={color + '30'} stroke={color} strokeWidth="2" />
      {/* Lid */}
      <Rect
        x="10" y={opened ? 5 : 20}
        width="80" height="20"
        fill={color + '50'}
        stroke={color}
        strokeWidth="2"
      />
      {/* Lock */}
      <Rect x="43" y="48" width="14" height="14" rx="2" fill={opened ? 'transparent' : color} stroke={color} strokeWidth="1.5" />
      {!opened && <Rect x="46" y="44" width="8" height="8" rx="4" fill="none" stroke={color} strokeWidth="1.5" />}
      {/* Hinge detail */}
      <Rect x="18" y="32" width="6" height="6" fill={color} />
      <Rect x="76" y="32" width="6" height="6" fill={color} />
      {/* Band */}
      <Rect x="10" y="52" width="80" height="4" fill={color + '60'} />
      {/* Corner gems */}
      {[18, 76].map((x) => (
        <Polygon key={x} points={`${x + 3},55 ${x + 6},58 ${x + 3},61 ${x},58`} fill={color} />
      ))}
    </Svg>
  );
}

function ParticlesBurst({ color }: { color: string }) {
  const lines = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2;
    return {
      x1: 50 + Math.cos(a) * 10,
      y1: 40 + Math.sin(a) * 10,
      x2: 50 + Math.cos(a) * 40,
      y2: 40 + Math.sin(a) * 40,
    };
  });
  return (
    <Svg width={100} height={80} viewBox="0 0 100 80" style={{ position: 'absolute' }}>
      {lines.map((l, i) => (
        <Line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
          stroke={color} strokeWidth="1.5" strokeOpacity="0.7" />
      ))}
      {Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2 + 0.3;
        const r = 45;
        return (
          <Polygon
            key={i}
            points={`${50 + Math.cos(a) * r},${40 + Math.sin(a) * r - 3} ${50 + Math.cos(a) * r + 3},${40 + Math.sin(a) * r} ${50 + Math.cos(a) * r},${40 + Math.sin(a) * r + 3} ${50 + Math.cos(a) * r - 3},${40 + Math.sin(a) * r}`}
            fill={color}
            fillOpacity="0.8"
          />
        );
      })}
    </Svg>
  );
}

export default function MandateReveal() {
  const navigation = useNavigation<Nav>();
  const { pendingMandate, openMandate, currentTheme: theme } = useSystemStore();
  const [loot, setLoot] = useState<{ type: string; name: string } | null>(null);
  const [opened, setOpened] = useState(false);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;
  const lootAnim = useRef(new Animated.Value(0)).current;
  const burstAnim = useRef(new Animated.Value(0)).current;
  const chestScaleAnim = useRef(new Animated.Value(1)).current;

  const tierColor = pendingMandate ? TIER_COLORS[pendingMandate.tier] ?? '#b87333' : '#b87333';
  const tierBg = pendingMandate ? TIER_BG[pendingMandate.tier] ?? '#1a0d00' : '#1a0d00';

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.3, duration: 1000, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [glowAnim]);

  const handleTapChest = async () => {
    if (opened) return;
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start(async () => {
      const result = await openMandate();
      if (result) {
        setLoot(result);
        setOpened(true);
        Animated.parallel([
          Animated.spring(lootAnim, { toValue: 1, friction: 5, useNativeDriver: true }),
          Animated.timing(burstAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.spring(chestScaleAnim, { toValue: 1.1, friction: 3, useNativeDriver: true }),
        ]).start();
      }
    });
  };

  const { width } = Dimensions.get('window');
  const panelW = Math.min(width * 0.86, 340);

  return (
    <View style={styles.overlay}>
      <View style={[styles.panel, { width: panelW, backgroundColor: tierBg, borderColor: tierColor + '60' }]}>
        {/* Corner brackets */}
        <CornerBrackets color={tierColor} length={20} />

        {/* Title */}
        <View style={styles.titleRow}>
          <View style={[styles.titleLine, { backgroundColor: tierColor + '50' }]} />
          <Text style={[styles.tier, { color: tierColor }]}>
            {TIER_LABELS[pendingMandate?.tier ?? 'BRONZE'] ?? pendingMandate?.tier}
          </Text>
          <Text style={[styles.mandateWord, { color: tierColor + 'aa' }]}>мандат</Text>
          <View style={[styles.titleLine, { backgroundColor: tierColor + '50' }]} />
        </View>

        {/* Chest */}
        <Animated.View
          style={[styles.chestWrap, { transform: [{ translateX: shakeAnim }, { scale: chestScaleAnim }] }]}
        >
          <Animated.View style={{ opacity: opened ? burstAnim : glowAnim }}>
            {opened && <ParticlesBurst color={tierColor} />}
          </Animated.View>
          <ChestSvg color={tierColor} opened={opened} />
        </Animated.View>

        {!opened && (
          <>
            <TouchableOpacity style={styles.tapArea} onPress={handleTapChest}>
              <View style={[styles.tapBtn, { borderColor: tierColor + '70', backgroundColor: tierColor + '15' }]}>
                <CornerBrackets color={tierColor + '70'} />
                <Text style={[styles.tapText, { color: tierColor }]}>▶ Открыть мандат</Text>
              </View>
            </TouchableOpacity>
          </>
        )}

        {opened && loot && (
          <Animated.View
            style={[styles.lootBox, { opacity: lootAnim, transform: [{ scale: lootAnim }] }]}
          >
            <View style={[styles.lootInner, { borderColor: tierColor + '60', backgroundColor: tierColor + '10' }]}>
              <CornerBrackets color={tierColor + '60'} />
              <Text style={[styles.lootCategory, { color: tierColor }]}>
                {LOOT_TYPE_LABELS[loot.type] ?? loot.type}
              </Text>
              <View style={[styles.lootDivider, { backgroundColor: tierColor }]} />
              <Text style={[styles.lootName, { color: '#ffffff' }]}>{loot.name}</Text>
            </View>
            <TouchableOpacity
              style={[styles.dismissBtn, { borderColor: tierColor, backgroundColor: tierColor + '20' }]}
              onPress={() => navigation.goBack()}
            >
              <CornerBrackets color={tierColor} />
              <Text style={[styles.dismissTxt, { color: tierColor }]}>Мандат получен</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {!opened && (
          <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
            <Text style={[styles.closeTxt, { color: theme.textSecondary }]}>Закрыть</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  panel: {
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    position: 'relative',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
    width: '100%',
  },
  titleLine: { flex: 1, height: 1 },
  tier: { fontSize: 17, letterSpacing: 0.3, fontFamily: FONTS.display },
  mandateWord: { fontSize: 12, letterSpacing: 0.5, fontFamily: FONTS.body },
  chestWrap: {
    width: 100,
    height: 80,
    position: 'relative',
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tapArea: { marginBottom: 20 },
  tapBtn: {
    borderWidth: 1.5,
    paddingHorizontal: 28,
    paddingVertical: 12,
    position: 'relative',
  },
  tapText: { fontSize: 13, letterSpacing: 0.3, fontFamily: FONTS.display },
  lootBox: { width: '100%', alignItems: 'center', gap: 16 },
  lootInner: {
    borderWidth: 1,
    padding: 20,
    width: '100%',
    alignItems: 'center',
    gap: 10,
    position: 'relative',
  },
  lootCategory: { fontSize: 11, letterSpacing: 0.5, fontFamily: FONTS.bold },
  lootDivider: { width: 40, height: 1 },
  lootName: { fontSize: 22, textAlign: 'center', letterSpacing: 1, fontFamily: FONTS.display },
  dismissBtn: {
    borderWidth: 1.5,
    paddingHorizontal: 24,
    paddingVertical: 12,
    width: '100%',
    alignItems: 'center',
    position: 'relative',
  },
  dismissTxt: { fontSize: 13, letterSpacing: 0.3, fontFamily: FONTS.display },
  closeBtn: { marginTop: 8 },
  closeTxt: { fontSize: 12, letterSpacing: 1, fontFamily: FONTS.body },
});
