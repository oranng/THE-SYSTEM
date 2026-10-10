import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useSystemStore } from '../store/useSystemStore';
import SystemBackground from '../components/fx/SystemBackground';
import AmbientEmbers from '../components/fx/AmbientEmbers';
import SectionDivider from '../components/ui/SectionDivider';
import { CornerBrackets } from '../components/ui/CornerBox';
import ConfirmModal from '../components/ui/ConfirmModal';
import Glyph from '../components/icons/Glyph';
import { FONTS } from '../theme/typography';
import { PATHS, BOSS_XP, stepXp, type StoryPath } from '../data/paths';
import {
  loadQuestState, completePathStep, undoPathStep, defeatBoss,
  changeSavings, setSavingsGoal, formatUah, type QuestState,
} from '../engine/pathsEngine';
import type { LevelUpEvent } from '../engine/xpEngine';
import type { RootStackParamList } from '../navigation/types';

type Nav = StackNavigationProp<RootStackParamList>;

const GREEN = '#4caf50';
const RED = '#f44336';

function parseAmount(text: string): number {
  const n = Number(text.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export default function Quests() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { hero, refresh, currentTheme: theme } = useSystemStore();

  const [state, setState] = React.useState<QuestState | null>(null);
  const [open, setOpen] = React.useState<string | null>(null);
  const [amount, setAmount] = React.useState('');
  const [goalInput, setGoalInput] = React.useState('');
  const [confirm, setConfirm] = React.useState<{
    title: string; message: string; confirmText: string; onConfirm: () => void;
  } | null>(null);

  const reload = React.useCallback(async () => {
    setState(await loadQuestState());
  }, []);

  // Reload whenever XP moves (another tab may have changed it) and on mount.
  React.useEffect(() => { reload(); }, [reload, hero?.global_xp]);

  const afterReward = async (result: { xpGained: number; levelUp: LevelUpEvent | null } | null) => {
    await reload();
    await refresh();
    if (!result?.levelUp) return;
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

  const askCompleteStep = (path: StoryPath, index: number) => {
    setConfirm({
      title: 'ЭТАП ВЫПОЛНЕН?',
      message: `«${path.steps[index].title}». Отмечай этап, только если он действительно сделан. Награда: +${stepXp(index)} опыта.`,
      confirmText: 'ДА, СДЕЛАНО',
      onConfirm: async () => afterReward(await completePathStep(path.key)),
    });
  };

  const askUndoStep = (path: StoryPath) => {
    setConfirm({
      title: 'ОТМЕНИТЬ ЭТАП?',
      message: 'Последний отмеченный этап этого пути снова станет текущим, его опыт будет снят.',
      confirmText: 'ОТМЕНИТЬ ЭТАП',
      onConfirm: async () => { await undoPathStep(path.key); await reload(); await refresh(); },
    });
  };

  const askBoss = () => {
    if (!state) return;
    setConfirm({
      title: 'БОСС ПОВЕРЖЕН?',
      message: `${state.boss.name}: ${state.boss.task} Награда: +${BOSS_XP} опыта.`,
      confirmText: 'ПОВЕРЖЕН',
      onConfirm: async () => afterReward(await defeatBoss()),
    });
  };

  const handleSavings = async (sign: 1 | -1) => {
    const value = parseAmount(amount);
    if (!value) return;
    await changeSavings(sign * value);
    setAmount('');
    await reload();
  };

  const handleGoal = async () => {
    const value = parseAmount(goalInput);
    if (!value) return;
    await setSavingsGoal(value);
    setGoalInput('');
    await reload();
  };

  if (!hero || !state) {
    return <View style={[styles.container, { backgroundColor: theme.background }]} />;
  }

  const totalSteps = PATHS.reduce((s, p) => s + p.steps.length, 0);
  const doneSteps = PATHS.reduce((s, p) => s + Math.min(state.progress[p.key] ?? 0, p.steps.length), 0);
  const savingsPct = state.savingsGoal > 0 ? Math.min(state.savings / state.savingsGoal, 1) : 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <SystemBackground color={theme.accent} background={theme.background} />
      <AmbientEmbers color={theme.auraColor ?? theme.accent} />

      <View style={[styles.header, { borderBottomColor: theme.accent + '30' }]}>
        <Text style={[styles.title, { color: theme.text }]}>Квесты</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Этапов пройдено: {doneSteps} из {totalSteps} · боссов: {state.bossKills}
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* ── Weekly boss ── */}
        <SectionDivider title="Босс недели" color={theme.accent} />
        <View style={[styles.card, { borderColor: (state.bossDone ? GREEN : RED) + '80', backgroundColor: theme.primary }]}>
          <CornerBrackets color={state.bossDone ? GREEN : RED} length={10} />
          <View style={styles.rowBetween}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>{state.boss.name}</Text>
            <Text style={[styles.badge, { color: state.bossDone ? GREEN : RED, borderColor: (state.bossDone ? GREEN : RED) + '80' }]}>
              {state.bossDone ? 'ПОВЕРЖЕН' : 'АКТИВЕН'}
            </Text>
          </View>
          <Text style={[styles.body, { color: theme.textSecondary }]}>{state.boss.task}</Text>
          <Text style={[styles.reward, { color: theme.accent }]}>Награда: +{BOSS_XP} опыта · новый босс каждый понедельник</Text>
          {!state.bossDone && (
            <TouchableOpacity style={[styles.btn, { borderColor: RED, backgroundColor: RED + '18' }]} onPress={askBoss} activeOpacity={0.8}>
              <CornerBrackets color={RED} length={8} />
              <Glyph name="sword" color={RED} size={14} />
              <Text style={[styles.btnTxt, { color: RED }]}>Босс повержен</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Savings jar ── */}
        <SectionDivider title="Копилка" color={theme.accent} />
        <View style={[styles.card, { borderColor: theme.accent + '60', backgroundColor: theme.primary }]}>
          <CornerBrackets color={theme.accent + '80'} length={10} />
          <View style={styles.rowBetween}>
            <Text style={[styles.money, { color: theme.text }]}>{formatUah(state.savings)}</Text>
            <Text style={[styles.body, { color: theme.textSecondary }]}>
              {state.savingsGoal > 0 ? `цель ${formatUah(state.savingsGoal)}` : 'цель не задана'}
            </Text>
          </View>
          {state.savingsGoal > 0 && (
            <>
              <View style={[styles.barBg, { backgroundColor: '#111' }]}>
                <View style={[styles.barFill, { width: `${savingsPct * 100}%`, backgroundColor: savingsPct >= 1 ? GREEN : theme.accent }]} />
              </View>
              <Text style={[styles.reward, { color: savingsPct >= 1 ? GREEN : theme.accent }]}>
                {savingsPct >= 1 ? 'Цель достигнута!' : `${Math.round(savingsPct * 100)}% · осталось ${formatUah(state.savingsGoal - state.savings)}`}
              </Text>
            </>
          )}
          <Text style={[styles.body, { color: theme.textSecondary }]}>
            Подушка безопасности и деньги на переезд. Вноси сюда каждое откладывание.
          </Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.accent + '80' }]}
              value={amount}
              onChangeText={setAmount}
              placeholder="Сумма, ₴"
              placeholderTextColor={theme.textSecondary}
              keyboardType="numeric"
              maxLength={10}
            />
            <TouchableOpacity style={[styles.smallBtn, { borderColor: GREEN }]} onPress={() => handleSavings(1)}>
              <Text style={[styles.btnTxt, { color: GREEN }]}>+ Внести</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.smallBtn, { borderColor: RED }]} onPress={() => handleSavings(-1)}>
              <Text style={[styles.btnTxt, { color: RED }]}>− Снять</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.accent + '50' }]}
              value={goalInput}
              onChangeText={setGoalInput}
              placeholder="Новая цель, ₴"
              placeholderTextColor={theme.textSecondary}
              keyboardType="numeric"
              maxLength={10}
            />
            <TouchableOpacity style={[styles.smallBtn, { borderColor: theme.accent }]} onPress={handleGoal}>
              <Text style={[styles.btnTxt, { color: theme.accent }]}>Задать цель</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Story paths ── */}
        <SectionDivider title="Пути" color={theme.accent} />
        <Text style={[styles.lead, { color: theme.textSecondary }]}>
          Долгие квесты на месяцы. Этапы открываются по порядку, награда растёт с каждым этапом.
        </Text>
        {PATHS.map((path) => {
          const done = Math.min(state.progress[path.key] ?? 0, path.steps.length);
          const finished = done >= path.steps.length;
          const expanded = open === path.key;
          const current = finished ? null : path.steps[done];
          return (
            <View key={path.key} style={[styles.card, { borderColor: (finished ? GREEN : theme.accent) + '50', backgroundColor: theme.primary }]}>
              <CornerBrackets color={(finished ? GREEN : theme.accent) + '80'} length={8} />
              <TouchableOpacity onPress={() => setOpen(expanded ? null : path.key)} activeOpacity={0.8}>
                <View style={styles.rowBetween}>
                  <Text style={[styles.cardTitle, { color: theme.text }]}>{path.name}</Text>
                  <Text style={[styles.count, { color: finished ? GREEN : theme.accent }]}>{done}/{path.steps.length}</Text>
                </View>
                <View style={styles.steps}>
                  {path.steps.map((_, i) => (
                    <View key={i} style={[styles.stepSeg, { backgroundColor: i < done ? (finished ? GREEN : theme.accent) : '#ffffff18' }]} />
                  ))}
                </View>
                {current ? (
                  <Text style={[styles.current, { color: theme.text }]}>Этап {done + 1}. {current.title}</Text>
                ) : (
                  <Text style={[styles.current, { color: GREEN }]}>Путь пройден. {path.goal}</Text>
                )}
                <Text style={[styles.more, { color: theme.textSecondary }]}>{expanded ? 'Свернуть ▲' : 'Подробнее ▼'}</Text>
              </TouchableOpacity>

              {expanded && (
                <View style={styles.expand}>
                  <Text style={[styles.body, { color: theme.textSecondary }]}>Цель: {path.goal}</Text>
                  {current && (
                    <>
                      <Text style={[styles.hint, { color: theme.text }]}>{current.hint}</Text>
                      <Text style={[styles.reward, { color: theme.accent }]}>Награда: +{stepXp(done)} опыта</Text>
                    </>
                  )}
                  <View style={styles.btnRow}>
                    {current && (
                      <TouchableOpacity style={[styles.btn, { borderColor: GREEN, backgroundColor: GREEN + '18' }]} onPress={() => askCompleteStep(path, done)} activeOpacity={0.8}>
                        <CornerBrackets color={GREEN} length={8} />
                        <Glyph name="check" color={GREEN} size={14} />
                        <Text style={[styles.btnTxt, { color: GREEN }]}>Этап выполнен</Text>
                      </TouchableOpacity>
                    )}
                    {done > 0 && (
                      <TouchableOpacity style={[styles.smallBtn, { borderColor: '#666' }]} onPress={() => askUndoStep(path)}>
                        <Text style={[styles.btnTxt, { color: '#999' }]}>Отменить прошлый</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {path.steps.map((s, i) => (
                    <View key={i} style={styles.stepLine}>
                      <Glyph name={i < done ? 'check' : 'gem'} color={i < done ? GREEN : i === done ? theme.accent : '#555'} size={11} />
                      <Text style={[styles.stepTxt, { color: i < done ? theme.textSecondary : i === done ? theme.text : '#777' }]}>
                        {i + 1}. {s.title}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}
        <View style={{ height: 48 }} />
      </ScrollView>

      <ConfirmModal
        visible={confirm !== null}
        title={confirm?.title ?? ''}
        message={confirm?.message ?? ''}
        confirmText={confirm?.confirmText ?? 'ПОДТВЕРДИТЬ'}
        cancelText="ОТМЕНА"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const action = confirm?.onConfirm;
          setConfirm(null);
          action?.();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1 },
  title: { fontSize: 17, letterSpacing: 0.3, fontFamily: FONTS.display },
  subtitle: { fontSize: 10, letterSpacing: 0.5, marginTop: 3, fontFamily: FONTS.body },
  scroll: { paddingHorizontal: 14, paddingBottom: 24 },
  lead: { fontSize: 11, lineHeight: 16, marginBottom: 10, fontFamily: FONTS.body },
  card: { borderWidth: 1, padding: 14, marginBottom: 12, position: 'relative', gap: 6 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 14, flexShrink: 1, fontFamily: FONTS.display },
  badge: { fontSize: 9, letterSpacing: 0.5, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2, fontFamily: FONTS.bold },
  body: { fontSize: 11, lineHeight: 16, fontFamily: FONTS.body },
  hint: { fontSize: 12, lineHeight: 17, fontFamily: FONTS.italic },
  reward: { fontSize: 10, letterSpacing: 0.3, fontFamily: FONTS.bodySemibold },
  money: { fontSize: 22, fontFamily: FONTS.display },
  count: { fontSize: 12, fontFamily: FONTS.display },
  current: { fontSize: 12, lineHeight: 17, fontFamily: FONTS.bodyMedium },
  more: { fontSize: 9, letterSpacing: 0.5, marginTop: 4, fontFamily: FONTS.body },
  expand: { marginTop: 8, gap: 6 },
  steps: { flexDirection: 'row', gap: 3, marginVertical: 4 },
  stepSeg: { flex: 1, height: 4 },
  stepLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepTxt: { fontSize: 11, lineHeight: 16, flex: 1, fontFamily: FONTS.body },
  barBg: { height: 8, overflow: 'hidden' },
  barFill: { height: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  input: { flex: 1, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, fontFamily: FONTS.body },
  btnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 4 },
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, marginTop: 4, position: 'relative',
  },
  smallBtn: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 9, alignItems: 'center', justifyContent: 'center' },
  btnTxt: { fontSize: 11, letterSpacing: 0.3, fontFamily: FONTS.bold },
});
