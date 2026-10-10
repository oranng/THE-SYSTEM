import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSystemStore } from '../store/useSystemStore';
import { getSystemState } from '../db/queries';
import { CornerBrackets } from '../components/ui/CornerBox';
import { FONTS } from '../theme/typography';

const { width } = Dimensions.get('window');

// Verdict tiers by 180-day consistency rate (% of all logged trials completed).
function verdict(rate: number): { title: string; line: string; color: string } {
  if (rate >= 85) return { title: 'ПРЕВОСХОЖДЕНИЕ', line: 'Это был не просто путь. Путь стал тобой.', color: '#F0C419' };
  if (rate >= 70) return { title: 'ВЛАДЫЧЕСТВО', line: 'Твои дни подчинялись тебе. Система склоняется.', color: '#E0C060' };
  if (rate >= 50) return { title: 'ЗАКАЛКА', line: 'Огонь не гас. Твоя хватка была крепче.', color: '#D97757' };
  if (rate >= 30) return { title: 'ИСПЫТАНИЕ', line: 'Испытания пройдены. Ты всё ещё здесь.', color: '#9CA77F' };
  return { title: 'НЕРАСКРЫТОЕ', line: 'Путь окончен, но работа — нет.', color: '#8A7A6B' };
}

export default function FinalJudgement() {
  const navigation = useNavigation<{ goBack: () => void }>();
  const { hero } = useSystemStore();
  const [rate, setRate] = useState<number | null>(null);

  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    getSystemState('final_consistency_rate').then((v) => setRate(v ? parseInt(v, 10) : 0));
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 6, tension: 40, useNativeDriver: true }),
    ]).start();
  }, [fade, scale]);

  const r = rate ?? 0;
  const v = verdict(r);
  const panelSize = Math.min(width * 0.88, 360);

  return (
    <View style={styles.overlay}>
      <Animated.View style={[styles.panel, { width: panelSize, opacity: fade, transform: [{ scale }] }]}>
        <CornerBrackets color={v.color} thickness={2} length={22} />
        <Text style={[styles.eyebrow, { color: v.color }]}>Последний суд</Text>
        <View style={[styles.divider, { backgroundColor: v.color + '50' }]} />
        <Text style={[styles.days, { color: '#fff' }]}>180 ДНЕЙ</Text>
        <Text style={[styles.verdict, { color: v.color }]}>{v.title}</Text>
        <Text style={[styles.rate, { color: v.color }]}>{r}%</Text>
        <Text style={[styles.rateLabel, { color: '#888' }]}>постоянство</Text>
        <Text style={[styles.line, { color: '#cfcabf' }]}>{v.line}</Text>
        {hero?.name ? <Text style={[styles.name, { color: '#888' }]}>— {hero.name}</Text> : null}
        <TouchableOpacity
          style={[styles.btn, { borderColor: v.color, backgroundColor: v.color + '18' }]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <CornerBrackets color={v.color} length={8} />
          <Text style={[styles.btnTxt, { color: v.color }]}>Принять вердикт</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', justifyContent: 'center', alignItems: 'center' },
  panel: { borderWidth: 1, borderColor: '#333', backgroundColor: '#0a0a0a', alignItems: 'center', padding: 36, position: 'relative' },
  eyebrow: { fontSize: 12, letterSpacing: 0.5, fontFamily: FONTS.display },
  divider: { width: 60, height: 1, marginVertical: 16 },
  days: { fontSize: 14, letterSpacing: 2, fontFamily: FONTS.body, marginBottom: 10 },
  verdict: { fontSize: 26, letterSpacing: 0.5, textAlign: 'center', fontFamily: FONTS.display },
  rate: { fontFamily: 'Lora_600SemiBold', fontSize: 64, lineHeight: 72, marginTop: 8 },
  rateLabel: { fontSize: 11, letterSpacing: 1, fontFamily: FONTS.body, marginBottom: 18 },
  line: { fontSize: 14, lineHeight: 22, textAlign: 'center', fontStyle: 'italic', fontFamily: FONTS.displayRegular },
  name: { fontSize: 12, letterSpacing: 0.5, marginTop: 10, fontFamily: FONTS.body },
  btn: { borderWidth: 1, paddingHorizontal: 32, paddingVertical: 13, marginTop: 28, position: 'relative' },
  btnTxt: { fontSize: 13, letterSpacing: 0.3, fontFamily: FONTS.display },
});
