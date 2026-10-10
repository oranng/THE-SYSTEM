import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Animated, Modal, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polygon } from 'react-native-svg';
import { useSystemStore } from '../store/useSystemStore';
import { getWeekCompletionRate } from '../db/queries';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import CornerFrame from '../components/ui/CornerFrame';
import { CornerBrackets } from '../components/ui/CornerBox';
import SystemBackground from '../components/fx/SystemBackground';
import AmbientEmbers from '../components/fx/AmbientEmbers';
import ClaudeSpark from '../components/avatar/ClaudeSpark';
import { FONTS } from '../theme/typography';

const TOTAL_NODES = 24;

const ZONE_LABELS = [
  'Бездна', 'Павшее королевство', 'Железная цитадель',
  'Небесные врата', 'Пустота', 'Трон',
];

// Warm charcoal zone tints — deep at the start, warming toward the throne.
const ZONE_TINTS = ['#201F1D', '#23211E', '#262320', '#2A2622', '#2E2823', '#332B24'];

const LORE: string[] = [
  'Неделя 1: спуск начинается. С собой только воля.',
  'Неделя 2: стены бездны давят. Ты давишь в ответ.',
  'Неделя 3: свет гаснет. Свет теперь — ты.',
  'Неделя 4: поверхность. Солнце заслужено.',
  'Неделя 5: впереди руины. Здесь пали другие.',
  'Неделя 6: ты идёшь там, где умирали королевства.',
  'Неделя 7: бронзовый пепел. Твой путь — другой.',
  'Неделя 8: кузня ещё горит. Шаг внутрь.',
  'Неделя 9: железное небо. Железная воля. Остаётся один.',
  'Неделя 10: буря показывает характер. Буря проходит.',
  'Неделя 11: стены цитадели. Их строишь ты.',
  'Неделя 12: вершина. Отсюда всё кажется мелким.',
  'Неделя 13: облака расходятся. Ты выше этого.',
  'Неделя 14: врата небесного плана открыты.',
  'Неделя 15: тебя ждали.',
  'Неделя 16: тронный зал давно ждёт.',
  'Неделя 17: звёзды. Система раскрывает свой масштаб.',
  'Неделя 18: созвездия складываются в твоё имя.',
  'Неделя 19: пустота между звёздами. Ты пересекаешь её.',
  'Неделя 20: теперь свет огибает тебя.',
  'Неделя 21: последний путь. Каждый шаг — легенда.',
  'Неделя 22: Система отмечает твоё приближение.',
  'Неделя 23: осталась одна стена. Последняя.',
  'Неделя 24: божественный трон. Цель достигнута.',
];

const { width } = Dimensions.get('window');

type NodeState = 'current' | 'done' | 'attempted' | 'locked';

function TrailNode({ state, color, pulseAnim }: {
  state: NodeState; color: string; pulseAnim: Animated.Value;
}) {
  if (state === 'locked') {
    return (
      <View style={nodeStyles.lockRing} />
    );
  }
  const size = state === 'current' ? 58 : 38;
  const tint = state === 'attempted' ? '#8A7A6B' : color;
  return (
    <Animated.View
      style={[nodeStyles.sparkWrap, { transform: [{ scale: state === 'current' ? pulseAnim : 1 }] }]}
    >
      <ClaudeSpark rank={state === 'current' ? 'C' : 'E'} size={size} tint={tint} glow={state === 'current'} />
    </Animated.View>
  );
}

const nodeStyles = StyleSheet.create({
  sparkWrap: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  lockRing: {
    width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderStyle: 'dashed',
    borderColor: '#4A463F', margin: 17,
  },
});

function PathConnector({ unlocked, color }: { unlocked: boolean; color: string }) {
  return (
    <View style={connStyles.line}>
      {Array.from({ length: 7 }).map((_, i) => (
        <View
          key={i}
          style={{
            width: 3, height: 3, borderRadius: 1.5,
            backgroundColor: unlocked ? color : '#3A3733',
            opacity: unlocked ? 0.7 : 0.4,
          }}
        />
      ))}
    </View>
  );
}

const connStyles = StyleSheet.create({
  line: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
});

function NodeRow({ nodeNum, completionRate, isCurrent, isLocked, onPress, theme }: {
  nodeNum: number; completionRate: number; isCurrent: boolean; isLocked: boolean;
  onPress: () => void; theme: { accent: string; textSecondary: string; text: string };
}) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isCurrent) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isCurrent, pulseAnim]);

  const isLeft = nodeNum % 2 === 1;
  const isDone = !isCurrent && !isLocked && completionRate >= 0.5;
  const state: NodeState = isCurrent ? 'current' : isLocked ? 'locked' : isDone ? 'done' : 'attempted';
  const pct = Math.round(completionRate * 100);
  const captionColor = isLocked ? '#6B6A65' : theme.textSecondary;

  return (
    <View style={[styles.nodeRow, { justifyContent: isLeft ? 'flex-start' : 'flex-end' }]}>
      {!isLeft && <PathConnector unlocked={!isLocked} color={theme.accent} />}
      <TouchableOpacity onPress={onPress} disabled={isLocked} activeOpacity={0.7}>
        <View style={styles.nodeCol}>
          <TrailNode state={state} color={theme.accent} pulseAnim={pulseAnim} />
          <Text style={[styles.nodeCaption, { color: captionColor }]}>
            {isLocked ? `Неделя ${nodeNum}` : `Неделя ${nodeNum} · ${pct}%`}
          </Text>
        </View>
      </TouchableOpacity>
      {isLeft && <PathConnector unlocked={!isLocked} color={theme.accent} />}
    </View>
  );
}

export default function AscensionPath() {
  const insets = useSafeAreaInsets();
  const { hero, currentTheme: theme } = useSystemStore();
  const [completionRates, setCompletionRates] = useState<number[]>(new Array(TOTAL_NODES).fill(0));
  const [selectedNode, setSelectedNode] = useState<number | null>(null);

  useEffect(() => {
    if (!hero) return;
    (async () => {
      const rates: number[] = [];
      for (let w = 1; w <= TOTAL_NODES; w++) {
        const rate = await getWeekCompletionRate(hero.journey_start_date, w);
        rates.push(rate);
      }
      setCompletionRates(rates);
    })();
  }, [hero]);

  if (!hero) return null;

  const daysElapsed = differenceInCalendarDays(new Date(), parseISO(hero.journey_start_date));
  // 24 nodes spread across the full 180-day journey (7.5 days each) so the last
  // node lands on Day 180. Clamp to 1 for the pre-journey "Fallen" day.
  const DAYS_PER_NODE = 180 / TOTAL_NODES;
  const currentWeek = Math.min(Math.max(Math.floor(daysElapsed / DAYS_PER_NODE) + 1, 1), TOTAL_NODES);
  const overallRate = completionRates.slice(0, currentWeek).reduce((s, r) => s + r, 0) / Math.max(currentWeek, 1);

  const selectedRate = selectedNode ? (completionRates[selectedNode - 1] ?? 0) : 0;
  const zoneIdx = selectedNode ? Math.floor((selectedNode - 1) / 4) : 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <SystemBackground color={theme.accent} background={theme.background} />
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.accent + '30', paddingTop: insets.top + 10 }]}>
        <View style={styles.headerTop}>
          <Text style={[styles.title, { color: theme.text }]}>Путь восхождения</Text>
          <View style={[styles.weekBadge, { borderColor: theme.accent + '70', backgroundColor: theme.accent + '12' }]}>
            <CornerBrackets color={theme.accent + '70'} length={8} />
            <Text style={[styles.weekNum, { color: theme.accent }]}>{currentWeek}</Text>
            <Text style={[styles.weekOf, { color: theme.textSecondary }]}>/{TOTAL_NODES}</Text>
          </View>
        </View>
        <View style={styles.headerBar}>
          <View style={[styles.headerBarBg, { backgroundColor: '#2A2725' }]}>
            <View style={[styles.headerBarFill, {
              width: `${(currentWeek / TOTAL_NODES) * 100}%`,
              backgroundColor: theme.accent,
            }]} />
          </View>
          <Text style={[styles.headerPct, { color: theme.textSecondary }]}>
            в среднем {Math.round(overallRate * 100)}%
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.pathWrap}
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
        bounces={false}
      >
        {Array.from({ length: TOTAL_NODES }, (_, i) => {
          const nodeNum = TOTAL_NODES - i;
          const zoneI = Math.floor((nodeNum - 1) / 4);
          const zoneColor = ZONE_TINTS[zoneI] ?? theme.background;
          const isCurrent = nodeNum === currentWeek;
          const isLocked = nodeNum > currentWeek;
          const rate = completionRates[nodeNum - 1] ?? 0;

          return (
            <View key={nodeNum} style={[styles.zoneSection, { backgroundColor: zoneColor }]}>
              {nodeNum % 4 === 1 && (
                <View style={styles.zoneLabelWrap}>
                  <View style={[styles.zoneLabelLine, { backgroundColor: theme.accent + '25' }]} />
                  <Svg width={10} height={10} style={styles.zoneGem}>
                    <Polygon points="5,0 6.5,3.5 10,5 6.5,6.5 5,10 3.5,6.5 0,5 3.5,3.5" fill={theme.accent} opacity={0.7} />
                  </Svg>
                  <Text style={[styles.zoneLabel, { color: theme.accent + 'AA' }]}>
                    {ZONE_LABELS[zoneI] ?? ''}
                  </Text>
                  <Svg width={10} height={10} style={styles.zoneGem}>
                    <Polygon points="5,0 6.5,3.5 10,5 6.5,6.5 5,10 3.5,6.5 0,5 3.5,3.5" fill={theme.accent} opacity={0.7} />
                  </Svg>
                  <View style={[styles.zoneLabelLine, { backgroundColor: theme.accent + '25' }]} />
                </View>
              )}
              <NodeRow
                nodeNum={nodeNum}
                completionRate={rate}
                isCurrent={isCurrent}
                isLocked={isLocked}
                onPress={() => setSelectedNode(nodeNum)}
                theme={theme}
              />
            </View>
          );
        })}
        <View style={[styles.zoneSection, { backgroundColor: ZONE_TINTS[0], flexGrow: 1, minHeight: 32 }]} />
      </ScrollView>

      {/* Embers drift OVER the opaque zone map so they're visible across the
          whole page, not just the transparent header. */}
      <AmbientEmbers color={theme.auraColor ?? theme.accent} />

      {/* Node detail modal */}
      <Modal
        visible={selectedNode !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedNode(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedNode(null)}
        >
          <CornerFrame
            color={theme.accent}
            size={16}
            thickness={2}
            style={[styles.modalBox, { backgroundColor: '#2C2B28' }]}
          >
            <TouchableOpacity activeOpacity={1} style={styles.modalInner}>
              <View style={styles.modalTopRow}>
                <Text style={[styles.modalWeek, { color: theme.accent }]}>
                  Неделя {selectedNode}
                </Text>
                <Text style={[styles.modalZone, { color: theme.textSecondary }]}>
                  {ZONE_LABELS[zoneIdx] ?? ''}
                </Text>
              </View>

              <View style={[styles.modalDivider, { backgroundColor: theme.accent + '40' }]} />

              <Text style={[styles.modalLore, { color: theme.text }]}>
                {selectedNode ? LORE[selectedNode - 1] : ''}
              </Text>

              <View style={styles.modalStats}>
                <View style={[styles.modalStatBox, { borderColor: theme.accent + '50' }]}>
                  <CornerBrackets color={theme.accent + '50'} />
                  <Text style={[styles.modalStatVal, { color: theme.accent }]}>
                    {Math.round(selectedRate * 100)}%
                  </Text>
                  <Text style={[styles.modalStatLabel, { color: theme.textSecondary }]}>Выполнено</Text>
                </View>
                <View style={[styles.modalStatBox, { borderColor: theme.accent + '50' }]}>
                  <CornerBrackets color={theme.accent + '50'} />
                  <Text style={[styles.modalStatVal, { color: selectedNode === currentWeek ? theme.accent : theme.textSecondary }]}>
                    {selectedNode === currentWeek ? 'Сейчас' : selectedNode !== null && selectedNode > currentWeek ? 'Закрыто' : 'Пройдено'}
                  </Text>
                  <Text style={[styles.modalStatLabel, { color: theme.textSecondary }]}>Статус</Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.modalClose, { borderColor: theme.accent + '70' }]}
                onPress={() => setSelectedNode(null)}
              >
                <CornerBrackets color={theme.accent + '70'} />
                <Text style={[styles.modalCloseTxt, { color: theme.accent }]}>Закрыть</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </CornerFrame>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: { paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, gap: 10 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 18, letterSpacing: 0.3, fontFamily: FONTS.display },
  weekBadge: { flexDirection: 'row', alignItems: 'baseline', borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, gap: 2, borderRadius: 4, position: 'relative' },
  weekNum: { fontSize: 22, fontFamily: FONTS.display },
  weekOf: { fontSize: 13, fontFamily: FONTS.body },
  headerBar: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerBarBg: { flex: 1, height: 4, overflow: 'hidden', borderRadius: 2 },
  headerBarFill: { height: 4, borderRadius: 2 },
  headerPct: { fontSize: 11, letterSpacing: 0.5, fontFamily: FONTS.body },

  scroll: { flex: 1, backgroundColor: ZONE_TINTS[0] },
  pathWrap: { flexGrow: 1, paddingBottom: 16 },

  zoneSection: { paddingVertical: 0 },
  zoneLabelWrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10, gap: 8 },
  zoneLabelLine: { flex: 1, height: 1 },
  zoneGem: {},
  zoneLabel: { fontSize: 13, letterSpacing: 0.5, fontFamily: FONTS.display },

  nodeRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginVertical: 4 },
  nodeCol: { alignItems: 'center', width: 96 },
  nodeCaption: { fontSize: 10, letterSpacing: 0.3, marginTop: -4, fontFamily: FONTS.body },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modalBox: { width: Math.min(width * 0.85, 320) },
  modalInner: { padding: 24, gap: 14 },
  modalTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  modalWeek: { fontSize: 22, letterSpacing: 0.3, fontFamily: FONTS.display },
  modalZone: { fontSize: 11, letterSpacing: 0.3, fontFamily: FONTS.body },
  modalDivider: { height: 1 },
  modalLore: { fontSize: 14, lineHeight: 22, letterSpacing: 0.3, fontFamily: FONTS.displayRegular, fontStyle: 'italic' },
  modalStats: { flexDirection: 'row', gap: 10 },
  modalStatBox: { flex: 1, borderWidth: 1, padding: 12, alignItems: 'center', gap: 4, borderRadius: 4, position: 'relative' },
  modalStatVal: { fontSize: 20, fontFamily: FONTS.display },
  modalStatLabel: { fontSize: 10, letterSpacing: 0.3, fontFamily: FONTS.body },
  modalClose: { borderWidth: 1, padding: 12, alignItems: 'center', borderRadius: 4, position: 'relative' },
  modalCloseTxt: { fontSize: 13, letterSpacing: 0.3, fontFamily: FONTS.display },
});
