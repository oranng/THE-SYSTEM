import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, TextInput, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSystemStore } from '../store/useSystemStore';
import {
  setDisciplineActive, createCustomDiscipline, deleteDiscipline,
} from '../db/queries';
import type { Discipline } from '../types';
import SystemBackground from '../components/fx/SystemBackground';
import AmbientEmbers from '../components/fx/AmbientEmbers';
import { CornerBrackets } from '../components/ui/CornerBox';
import ConfirmModal from '../components/ui/ConfirmModal';
import DisciplineEmblem from '../components/icons/DisciplineEmblem';
import Glyph from '../components/icons/Glyph';
import { FONTS } from '../theme/typography';
import { DIFFICULTY_LABELS } from '../i18n/labels';

const DIFFICULTY_OPTIONS = ['EASY', 'NORMAL', 'HARD', 'LEGENDARY'] as const;
type Difficulty = typeof DIFFICULTY_OPTIONS[number];

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  EASY: '#9CA77F', NORMAL: '#D2A24C', HARD: '#D97757', LEGENDARY: '#C0506B',
};

const XP_DEFAULTS: Record<Difficulty, [number, number]> = {
  EASY: [10, 5], NORMAL: [25, 15], HARD: [50, 30], LEGENDARY: [100, 0],
};

interface AddForm {
  name: string;
  description: string;
  difficulty: Difficulty;
  deadlineTime: string;
}

const BLANK_FORM: AddForm = { name: '', description: '', difficulty: 'NORMAL', deadlineTime: '23:59' };

export default function Codex() {
  const insets = useSafeAreaInsets();
  const { disciplines, refresh, currentTheme: theme } = useSystemStore();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<AddForm>(BLANK_FORM);
  const [confirm, setConfirm] = useState<{
    title: string; message: string; confirmText: string; onConfirm: () => void;
  } | null>(null);

  const handleToggleActive = async (d: Discipline) => {
    if (d.code === 'SILENCE' && d.is_active) {
      setConfirm({
        title: 'ОТКЛЮЧИТЬ ТИШИНУ?',
        message: 'Если отключить Протокол Тишины, серия перестанет считаться.',
        confirmText: 'ОТКЛЮЧИТЬ',
        onConfirm: async () => { await setDisciplineActive(d.id, !d.is_active); await refresh(); },
      });
    } else {
      await setDisciplineActive(d.id, !d.is_active);
      await refresh();
    }
  };

  const handleDelete = (d: Discipline) => {
    if (!d.is_custom) {
      Alert.alert('НЕЛЬЗЯ УДАЛИТЬ', 'Базовые испытания удалить нельзя, но их можно выключить.');
      return;
    }
    setConfirm({
      title: 'УДАЛИТЬ ИСПЫТАНИЕ',
      message: `Удалить «${d.name}»? Вся история по нему тоже будет удалена.`,
      confirmText: 'УДАЛИТЬ',
      onConfirm: async () => { await deleteDiscipline(d.id); await refresh(); },
    });
  };

  const handleAddSubmit = async () => {
    if (!form.name.trim()) {
      Alert.alert('НУЖНО НАЗВАНИЕ', 'Введи название испытания.');
      return;
    }
    const [xpGain, xpLoss] = XP_DEFAULTS[form.difficulty];
    await createCustomDiscipline({
      name: form.name.trim(),
      description: form.description.trim(),
      difficulty: form.difficulty,
      xpGain,
      xpLoss,
      deadlineTime: form.deadlineTime || '23:59',
    });
    await refresh();
    setForm(BLANK_FORM);
    setShowAdd(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <SystemBackground color={theme.accent} background={theme.background} />
      <AmbientEmbers color={theme.auraColor ?? theme.accent} />
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <Text style={[styles.title, { color: theme.text }]}>Кодекс</Text>
        <TouchableOpacity style={[styles.addBtn, { borderColor: theme.accent }]} onPress={() => setShowAdd(true)}>
          <CornerBrackets color={theme.accent} />
          <Text style={[styles.addBtnText, { color: theme.accent }]}>+ Добавить</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {disciplines.map((d) => {
          const diffColor = DIFFICULTY_COLORS[d.difficulty as Difficulty] ?? theme.accent;
          return (
            <View key={d.id} style={[styles.row, { borderBottomColor: '#222222' }]}>
              <View style={[styles.iconBox, { borderColor: diffColor }]}>
                <CornerBrackets color={diffColor} />
                <DisciplineEmblem seed={d.id} color={diffColor} size={30} />
              </View>
              <View style={styles.rowInfo}>
                <Text style={[styles.rowName, { color: theme.text }]}>{d.name}</Text>
                <View style={styles.rowMeta}>
                  <View style={[styles.diffBadge, { backgroundColor: diffColor + '30', borderColor: diffColor }]}>
                    <Text style={[styles.diffText, { color: diffColor }]}>{DIFFICULTY_LABELS[d.difficulty] ?? d.difficulty}</Text>
                  </View>
                  <Text style={[styles.xpText, { color: '#4caf50' }]}>+{d.xp_gain}</Text>
                  <Text style={[styles.xpText, { color: '#f44336' }]}>-{d.xp_loss}</Text>
                </View>
                {d.deadline_time && (
                  <Text style={[styles.deadlineText, { color: theme.textSecondary }]}>Срок: до {d.deadline_time}</Text>
                )}
              </View>
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.toggleBtn, { backgroundColor: d.is_active ? theme.accent + '20' : '#333333', borderColor: d.is_active ? theme.accent : '#444444' }]}
                  onPress={() => handleToggleActive(d)}
                >
                  <CornerBrackets color={d.is_active ? theme.accent : '#444444'} length={8} />
                  <Text style={[styles.toggleText, { color: d.is_active ? theme.accent : '#666666' }]}>
                    {d.is_active ? 'ВКЛ' : 'ВЫКЛ'}
                  </Text>
                </TouchableOpacity>
                {d.is_custom && (
                  <TouchableOpacity
                    style={[styles.deleteBtn, { borderColor: '#f44336' }]}
                    onPress={() => handleDelete(d)}
                  >
                    <CornerBrackets color="#f44336" length={8} />
                    <Glyph name="close" color="#f44336" size={11} />
                    <Text style={styles.deleteText}>УДАЛ.</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
        <View style={styles.bottomPadding} />
      </ScrollView>

      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: theme.background, borderColor: theme.accent }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Новое испытание</Text>

            <Text style={[styles.formLabel, { color: theme.textSecondary }]}>Название</Text>
            <View style={styles.inputWrap}>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.accent }]}
                value={form.name}
                onChangeText={(v) => setForm({ ...form, name: v })}
                placeholder="Например: 30 минут английского"
                placeholderTextColor={theme.textSecondary}
                maxLength={40}
              />
              <CornerBrackets color={theme.accent} length={8} />
            </View>

            <Text style={[styles.formLabel, { color: theme.textSecondary }]}>Описание</Text>
            <View style={styles.inputWrap}>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.accent }]}
                value={form.description}
                onChangeText={(v) => setForm({ ...form, description: v })}
                placeholder="Коротко: что именно сделать"
                placeholderTextColor={theme.textSecondary}
                maxLength={100}
              />
              <CornerBrackets color={theme.accent} length={8} />
            </View>

            <Text style={[styles.formLabel, { color: theme.textSecondary }]}>Сложность</Text>
            <View style={styles.diffRow}>
              {DIFFICULTY_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.diffOption, { borderColor: form.difficulty === opt ? DIFFICULTY_COLORS[opt] : '#444444', backgroundColor: form.difficulty === opt ? DIFFICULTY_COLORS[opt] + '30' : 'transparent' }]}
                  onPress={() => setForm({ ...form, difficulty: opt })}
                >
                  <CornerBrackets color={form.difficulty === opt ? DIFFICULTY_COLORS[opt] : '#444444'} length={8} />
                  <Text style={[styles.diffOptionText, { color: form.difficulty === opt ? DIFFICULTY_COLORS[opt] : '#666666' }]}>
                    {DIFFICULTY_LABELS[opt].slice(0, 5)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.formLabel, { color: theme.textSecondary }]}>СРОК (ЧЧ:ММ)</Text>
            <View style={styles.inputWrap}>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.accent }]}
                value={form.deadlineTime}
                onChangeText={(v) => setForm({ ...form, deadlineTime: v })}
                placeholder="23:59"
                placeholderTextColor={theme.textSecondary}
                maxLength={5}
              />
              <CornerBrackets color={theme.accent} length={8} />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.cancelBtn, { borderColor: '#666666' }]} onPress={() => { setShowAdd(false); setForm(BLANK_FORM); }}>
                <CornerBrackets color="#666666" />
                <Text style={[styles.cancelText, { color: '#666666' }]}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.submitBtn, { backgroundColor: theme.accent }]} onPress={handleAddSubmit}>
                <Text style={styles.submitText}>Создать</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ConfirmModal
        visible={confirm !== null}
        destructive
        title={confirm?.title ?? ''}
        message={confirm?.message ?? ''}
        confirmText={confirm?.confirmText ?? 'ПОДТВЕРДИТЬ'}
        cancelText="ОТМЕНА"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          confirm?.onConfirm();
          setConfirm(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#333333' },
  title: { fontSize: 17, letterSpacing: 0.3, fontFamily: FONTS.display },
  addBtn: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7, position: 'relative' },
  addBtnText: { fontSize: 13, letterSpacing: 0.3, fontFamily: FONTS.bold },
  scroll: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 14, borderBottomWidth: 1 },
  iconBox: { width: 48, height: 48, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginRight: 12, position: 'relative' },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 14, marginBottom: 4, fontFamily: FONTS.bold },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  diffBadge: { borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 2 },
  diffText: { fontSize: 11, fontFamily: FONTS.bold },
  xpText: { fontSize: 12, fontFamily: FONTS.body },
  deadlineText: { fontSize: 12, marginTop: 2, fontFamily: FONTS.body },
  actions: { alignItems: 'stretch', gap: 6, minWidth: 56 },
  toggleBtn: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 2, position: 'relative', alignItems: 'center' },
  toggleText: { fontSize: 12, fontFamily: FONTS.bold },
  deleteBtn: {
    borderWidth: 1,
    paddingVertical: 5,
    borderRadius: 2,
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#f4433615',
  },
  deleteText: { color: '#f44336', fontSize: 11, letterSpacing: 0.5, fontFamily: FONTS.bold },
  bottomPadding: { height: 64 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalBox: { padding: 24, borderTopWidth: 2 },
  modalTitle: { fontSize: 17, letterSpacing: 0.3, marginBottom: 16, fontFamily: FONTS.display },
  formLabel: { fontSize: 11, letterSpacing: 0.5, marginBottom: 6, marginTop: 12, fontFamily: FONTS.body },
  inputWrap: { position: 'relative', marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 2, padding: 10, fontSize: 14, fontFamily: FONTS.body },
  diffRow: { flexDirection: 'row', gap: 8 },
  diffOption: { flex: 1, borderWidth: 1, padding: 8, alignItems: 'center', borderRadius: 2, position: 'relative' },
  diffOptionText: { fontSize: 11, fontFamily: FONTS.bold },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBtn: { flex: 1, borderWidth: 1, padding: 13, alignItems: 'center', position: 'relative' },
  cancelText: { fontSize: 13, fontFamily: FONTS.bold },
  submitBtn: { flex: 1, padding: 13, alignItems: 'center', borderRadius: 2 },
  submitText: { color: '#000000', fontSize: 13, letterSpacing: 1, fontFamily: FONTS.display },
});
