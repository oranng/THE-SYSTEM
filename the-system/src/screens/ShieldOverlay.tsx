import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, AppState,
} from 'react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useNavigation } from '@react-navigation/native';
import { useSystemStore } from '../store/useSystemStore';
import { CornerBrackets } from '../components/ui/CornerBox';
import { FONTS } from '../theme/typography';

const DANGER = '#ff4444';
const DURATIONS = [15, 25, 45]; // minutes

type Phase = 'select' | 'active' | 'held' | 'breached';

const KEEP_AWAKE_TAG = 'shield-fortress';

export default function ShieldOverlay() {
  const navigation = useNavigation<{ goBack: () => void }>();
  const { currentTheme: theme } = useSystemStore();

  const [phase, setPhase] = useState<Phase>('select');
  const [minutes, setMinutes] = useState(25);
  const [remaining, setRemaining] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulse = useRef(new Animated.Value(1)).current;

  // Pulse the timer while the fortress holds.
  useEffect(() => {
    if (phase !== 'active') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.06, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [phase, pulse]);

  // Leave-detection: backgrounding the app during a session breaches the fortress.
  useEffect(() => {
    if (phase !== 'active') return;
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background' || next === 'inactive') {
        breach();
      }
    });
    return () => sub.remove();
  }, [phase]);

  const clearTick = () => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
  };

  const start = async () => {
    setRemaining(minutes * 60);
    setPhase('active');
    await activateKeepAwakeAsync(KEEP_AWAKE_TAG);
    tickRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearTick();
          hold();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const hold = () => {
    clearTick();
    deactivateKeepAwake(KEEP_AWAKE_TAG);
    setPhase('held');
  };

  const breach = () => {
    clearTick();
    deactivateKeepAwake(KEEP_AWAKE_TAG);
    setPhase('breached');
  };

  const close = () => {
    clearTick();
    deactivateKeepAwake(KEEP_AWAKE_TAG);
    navigation.goBack();
  };

  useEffect(() => () => { clearTick(); deactivateKeepAwake(KEEP_AWAKE_TAG); }, []);

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');

  return (
    <View style={styles.overlay}>
      <View style={[styles.container, { backgroundColor: theme.background, borderColor: DANGER }]}>
        <CornerBrackets color={DANGER} />
        <Text style={[styles.title, { color: DANGER }]}>Протокол Щита</Text>

        {phase === 'select' && (
          <>
            <Text style={[styles.body, { color: theme.text }]}>
              Войди в цифровую крепость. Если выйти из приложения до конца таймера, крепость падёт.
            </Text>
            <View style={styles.durationRow}>
              {DURATIONS.map((d) => (
                <TouchableOpacity
                  key={d}
                  onPress={() => setMinutes(d)}
                  style={[
                    styles.durationBtn,
                    {
                      borderColor: minutes === d ? theme.accent : theme.textSecondary,
                      backgroundColor: minutes === d ? theme.accent + '22' : 'transparent',
                    },
                  ]}
                >
                  <CornerBrackets color={minutes === d ? theme.accent : theme.textSecondary} />
                  <Text style={[styles.durationText, { color: minutes === d ? theme.accent : theme.textSecondary }]}>
                    {d} мин
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={[styles.lockBtn, { backgroundColor: DANGER }]} onPress={start}>
              <Text style={styles.lockBtnText}>Поднять крепость</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={close}>
              <Text style={[styles.cancelText, { color: theme.textSecondary }]}>Отмена</Text>
            </TouchableOpacity>
          </>
        )}

        {phase === 'active' && (
          <>
            <Animated.Text style={[styles.countdown, { color: theme.accent, transform: [{ scale: pulse }] }]}>
              {mm}:{ss}
            </Animated.Text>
            <Text style={[styles.body, { color: theme.text }]}>Крепость держится. Не выходи.</Text>
            <Text style={[styles.warning, { color: theme.textSecondary }]}>
              Выход из СИСТЕМЫ сейчас разрушит крепость.
            </Text>
          </>
        )}

        {phase === 'held' && (
          <>
            <Text style={[styles.resultBig, { color: theme.accent }]}>Крепость выстояла</Text>
            <Text style={[styles.body, { color: theme.text }]}>
              {minutes} мин. чистого фокуса. Система засчитывает твою дисциплину.
            </Text>
            <TouchableOpacity style={[styles.lockBtn, { backgroundColor: theme.accent }]} onPress={close}>
              <Text style={[styles.lockBtnText, { color: '#001018' }]}>Вернуться</Text>
            </TouchableOpacity>
          </>
        )}

        {phase === 'breached' && (
          <>
            <Text style={[styles.resultBig, { color: DANGER }]}>Крепость пала</Text>
            <Text style={[styles.body, { color: theme.text }]}>
              Выход до конца таймера. Этот раунд за слабостью. Попробуй снова.
            </Text>
            <TouchableOpacity style={[styles.lockBtn, { backgroundColor: DANGER }]} onPress={() => setPhase('select')}>
              <Text style={styles.lockBtnText}>Ещё раз</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={close}>
              <Text style={[styles.cancelText, { color: theme.textSecondary }]}>Отступить</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  container: { width: 320, padding: 32, borderWidth: 2, alignItems: 'center', position: 'relative' },
  title: { fontSize: 16, letterSpacing: 0.3, marginBottom: 20, fontFamily: FONTS.display },
  body: { fontSize: 13, textAlign: 'center', marginBottom: 12, lineHeight: 20, fontFamily: FONTS.body },
  warning: { fontSize: 11, textAlign: 'center', marginTop: 4, fontFamily: FONTS.body },
  durationRow: { flexDirection: 'row', gap: 12, marginVertical: 16 },
  durationBtn: { borderWidth: 1, paddingHorizontal: 18, paddingVertical: 10, position: 'relative' },
  durationText: { fontSize: 15, letterSpacing: 1, fontFamily: FONTS.bold },
  lockBtn: { paddingHorizontal: 24, paddingVertical: 14, marginTop: 8, marginBottom: 12 },
  lockBtnText: { color: '#ffffff', fontSize: 13, letterSpacing: 0.3, fontFamily: FONTS.display },
  cancelBtn: { padding: 8 },
  cancelText: { fontSize: 11, letterSpacing: 1, fontFamily: FONTS.body },
  countdown: { fontFamily: 'Lora_600SemiBold', fontSize: 66, marginBottom: 12, letterSpacing: 0.5 },
  resultBig: { fontSize: 24, letterSpacing: 0.3, marginBottom: 16, textAlign: 'center', fontFamily: FONTS.display },
});
