import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import type { Discipline, DisciplineLog } from '../../types';
import type { RankTheme } from '../../theme/rankThemes';
import { FONTS } from '../../theme/typography';
import CornerFrame from './CornerFrame';
import { CornerBrackets } from './CornerBox';
import FadeInView from '../fx/FadeInView';
import Glyph from '../icons/Glyph';
import { DIFFICULTY_LABELS } from '../../i18n/labels';

interface Props {
  discipline: Discipline;
  log: DisciplineLog | undefined;
  theme: RankTheme;
  onComplete: () => void;
  onFail: () => void;
  /** Locked for the rest of the day after a relapse — hide the action buttons. */
  locked?: boolean;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  EASY: '#9CA77F',
  NORMAL: '#D2A24C',
  HARD: '#D97757',
  LEGENDARY: '#C0506B',
};

const DIFFICULTY_ABBR: Record<string, string> = {
  EASY: 'I',
  NORMAL: 'II',
  HARD: 'III',
  LEGENDARY: 'IV',
};

function DiffIcon({ color }: { color: string }) {
  return (
    <Svg width={8} height={8}>
      <Polygon points="4,0 8,4 4,8 0,4" fill={color} />
    </Svg>
  );
}

function StatusMark({ type }: { type: 'complete' | 'fail' }) {
  const color = type === 'complete' ? '#4caf50' : '#f44336';
  const bg = type === 'complete' ? '#0a1a0a' : '#1a0a0a';
  return (
    <View style={[styles.statusBox, { borderColor: color, backgroundColor: bg }]}>
      <CornerBrackets color={color} length={9} />
      <Glyph name={type === 'complete' ? 'check' : 'cross'} color={color} size={18} />
    </View>
  );
}

export default function DisciplineCard({ discipline, log, theme, onComplete, onFail, locked }: Props) {
  const isCompleted = log?.completed === 1;
  const isFailed = log?.failed === 1;
  const diffColor = DIFFICULTY_COLORS[discipline.difficulty] ?? theme.accent;

  const cardBg = isCompleted
    ? '#050e05'
    : isFailed
      ? '#0e0505'
      : theme.primary;

  const frameColor = isCompleted ? '#4caf5066' : isFailed ? '#f4433666' : theme.accent + '66';
  const glowColor = isCompleted ? '#4caf50' : isFailed ? '#f44336' : theme.accent;
  const active = !isCompleted && !isFailed;

  return (
    <FadeInView style={styles.cardWrap}>
      <CornerFrame
        color={frameColor}
        size={10}
        thickness={1}
        style={[
          styles.card,
          {
            backgroundColor: cardBg,
            shadowColor: glowColor,
            shadowOpacity: active ? 0.5 : 0.25,
            shadowRadius: active ? 9 : 4,
            shadowOffset: { width: 0, height: 0 },
            elevation: active ? 6 : 2,
          },
        ]}
      >
      {/* Difficulty stripe */}
      <View style={[styles.stripe, { backgroundColor: diffColor }]} />

      <View style={styles.body}>
        {/* Difficulty gem */}
        <View style={styles.gemCol}>
          <DiffIcon color={diffColor} />
          <Text style={[styles.diffAbbr, { color: diffColor }]}>
            {DIFFICULTY_ABBR[discipline.difficulty] ?? '?'}
          </Text>
        </View>

        {/* Info */}
        <View style={styles.info}>
          <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
            {discipline.name}
          </Text>
          <Text style={[styles.desc, { color: theme.textSecondary }]}>
            {discipline.description}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.xpGain}>+{discipline.xp_gain}</Text>
            {discipline.xp_loss > 0 && (
              <Text style={styles.xpLoss}>−{discipline.xp_loss}</Text>
            )}
            <View style={[styles.diffPill, { borderColor: diffColor + '70', backgroundColor: diffColor + '15' }]}>
              <Text style={[styles.diffText, { color: diffColor }]}>{DIFFICULTY_LABELS[discipline.difficulty] ?? discipline.difficulty}</Text>
            </View>
            {discipline.deadline_time ? (
              <Text style={[styles.deadline, { color: theme.textSecondary }]}>
                {discipline.deadline_time}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Action */}
        <View style={styles.action}>
          {isCompleted && <StatusMark type="complete" />}
          {isFailed && <StatusMark type="fail" />}
          {!isCompleted && !isFailed && locked && (
            <View style={[styles.statusBox, { borderColor: '#555', backgroundColor: '#161616' }]}>
              <CornerBrackets color="#555" length={9} />
              <Glyph name="shield" color="#777" size={16} />
            </View>
          )}
          {!isCompleted && !isFailed && !locked && (
            <View style={styles.btnStack}>
              <TouchableOpacity
                style={[styles.btn, styles.btnComplete]}
                onPress={onComplete}
                activeOpacity={0.7}
              >
                <CornerBrackets color="#4caf5088" length={9} />
                <Glyph name="check" color="#4caf50" size={20} />
              </TouchableOpacity>
              {discipline.code === 'SILENCE' && (
                <TouchableOpacity
                  style={[styles.btn, styles.btnFail]}
                  onPress={onFail}
                  activeOpacity={0.7}
                >
                  <CornerBrackets color="#f4433688" length={9} />
                  <Glyph name="cross" color="#f44336" size={20} />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
      </CornerFrame>
    </FadeInView>
  );
}

const styles = StyleSheet.create({
  cardWrap: {},
  card: {
    marginHorizontal: 14,
    marginVertical: 4,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  stripe: {
    width: 3,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 10,
    gap: 10,
  },
  gemCol: {
    alignItems: 'center',
    gap: 3,
    width: 16,
  },
  diffAbbr: {
    fontSize: 10,
    letterSpacing: 0,
    fontFamily: FONTS.bold,
  },
  info: {
    flex: 1,
    gap: 4,
  },
  name: {
    fontSize: 14,
    letterSpacing: 0.5,
    fontFamily: FONTS.bold,
  },
  desc: {
    fontSize: 12,
    lineHeight: 15,
    fontFamily: FONTS.body,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  xpGain: {
    fontSize: 12,
    color: '#4caf50',
    fontFamily: FONTS.bold,
  },
  xpLoss: {
    fontSize: 12,
    color: '#f44336',
    fontFamily: FONTS.body,
  },
  diffPill: {
    borderWidth: 1,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  diffText: {
    fontSize: 9,
    letterSpacing: 0.5,
    fontFamily: FONTS.bold,
  },
  deadline: {
    fontSize: 11,
    fontFamily: FONTS.body,
  },
  action: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 40,
  },
  statusBox: {
    width: 38,
    height: 38,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  statusGlyph: {
    fontSize: 18,
    fontFamily: FONTS.bold,
  },
  btnStack: {
    gap: 5,
    alignItems: 'center',
  },
  btn: {
    width: 36,
    height: 36,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  btnComplete: {
    borderColor: '#4caf5088',
    backgroundColor: '#0a1a0a',
  },
  btnFail: {
    borderColor: '#f4433688',
    backgroundColor: '#1a0a0a',
  },
  btnGlyph: {
    fontSize: 16,
    fontFamily: FONTS.bold,
  },
});
