import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useSystemStore } from '../store/useSystemStore';
import { CornerBrackets } from '../components/ui/CornerBox';
import ConfirmModal from '../components/ui/ConfirmModal';
import Glyph from '../components/icons/Glyph';
import { getSystemState, setSystemState, validateImport, type ExportBundle } from '../db/queries';
import { differenceInCalendarDays, parseISO } from 'date-fns';
// expo-file-system v18+ moved legacy APIs to expo-file-system/legacy
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { getDb } from '../db/database';
import SystemBackground from '../components/fx/SystemBackground';
import AmbientEmbers from '../components/fx/AmbientEmbers';
import RichNotification from '../native/RichNotification';
import UsageStatsModule from '../native/UsageStatsModule';
import { FONTS } from '../theme/typography';

type Nav = { goBack: () => void };

const INTERVALS = [1, 2, 3, 4, 6];

export default function Settings() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { hero, currentTheme: theme, resetJourney, importJourney, syncNotifications } = useSystemStore();

  const [notifInterval, setNotifInterval] = useState(3);
  const [quietStart, setQuietStart] = useState('00:00');
  const [quietEnd, setQuietEnd] = useState('07:00');
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetModal, setResetModal] = useState(false);
  const [info, setInfo] = useState<{ title: string; message: string } | null>(null);
  const [pendingImport, setPendingImport] = useState<ExportBundle | null>(null);
  const [usageGranted, setUsageGranted] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const interval = await getSystemState('notification_interval');
      const qs = await getSystemState('quiet_start');
      const qe = await getSystemState('quiet_end');
      if (interval) setNotifInterval(parseInt(interval, 10));
      if (qs) setQuietStart(qs);
      if (qe) setQuietEnd(qe);
      try { setUsageGranted(await UsageStatsModule.hasPermission()); } catch { setUsageGranted(false); }
    })();
  }, []);

  const saveInterval = async (v: number) => {
    setNotifInterval(v);
    await setSystemState('notification_interval', String(v));
    await syncNotifications();
  };

  // Persist quiet hours (HH:MM). Re-sync so the next reminders honour the window.
  const saveQuietHours = async () => {
    await setSystemState('quiet_start', quietStart);
    await setSystemState('quiet_end', quietEnd);
    await syncNotifications();
  };

  const handleGrantUsage = async () => {
    try {
      await UsageStatsModule.openUsageAccessSettings();
    } catch {
      setInfo({ title: 'НЕДОСТУПНО', message: 'Отслеживание соцсетей работает только в установленном приложении.' });
    }
  };

  const handleExport = async () => {
    try {
      const db = getDb();
      const hero = await db.getAllAsync('SELECT * FROM hero');
      const disciplines = await db.getAllAsync('SELECT * FROM disciplines');
      const logs = await db.getAllAsync('SELECT * FROM discipline_logs ORDER BY log_date DESC LIMIT 1000');
      const silenceStreak = await db.getAllAsync('SELECT * FROM silence_streak');
      const mandates = await db.getAllAsync('SELECT * FROM mandates');
      const cosmetics = await db.getAllAsync('SELECT * FROM cosmetics');
      const systemState = await db.getAllAsync('SELECT * FROM system_state');

      const exportData = {
        exportedAt: new Date().toISOString(),
        version: 1,
        hero,
        disciplines,
        logs,
        silenceStreak,
        mandates,
        cosmetics,
        systemState,
      };

      const json = JSON.stringify(exportData, null, 2);
      const fileName = `the-system-export-${new Date().toISOString().slice(0, 10)}.json`;
      const filePath = `${FileSystem.documentDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(filePath, json, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(filePath, {
          mimeType: 'application/json',
          dialogTitle: 'Экспорт данных СИСТЕМЫ',
        });
      } else {
        Alert.alert('EXPORTED', `Saved to: ${filePath}`);
      }
    } catch (err) {
      Alert.alert('EXPORT ERROR', String(err));
    }
  };

  const handleImport = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.[0]) return;

      const content = await FileSystem.readAsStringAsync(res.assets[0].uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      let data: unknown;
      try {
        data = JSON.parse(content);
      } catch {
        setInfo({ title: 'ОШИБКА ИМПОРТА', message: 'Файл не является корректным JSON.' });
        return;
      }

      const check = validateImport(data);
      if (!check.ok) {
        setInfo({ title: 'ОШИБКА ИМПОРТА', message: check.error ?? 'Неверный файл экспорта.' });
        return;
      }

      // Stage it; the confirm modal guards the destructive overwrite.
      setPendingImport(data as ExportBundle);
    } catch (err) {
      setInfo({ title: 'ОШИБКА ИМПОРТА', message: String(err) });
    }
  };

  const performImport = async () => {
    const bundle = pendingImport;
    setPendingImport(null);
    if (!bundle) return;
    try {
      await importJourney(bundle);
      setInfo({ title: 'ИМПОРТ ЗАВЕРШЁН', message: 'Прогресс восстановлен из резервной копии.' });
    } catch (err) {
      setInfo({ title: 'ОШИБКА ИМПОРТА', message: String(err) });
    }
  };

  const handleResetJourney = async () => {
    if (resetConfirm.trim() !== 'Я ПРИНИМАЮ СБРОС') {
      setInfo({ title: 'ВВЕДИ ФРАЗУ', message: 'Введи точно: Я ПРИНИМАЮ СБРОС' });
      return;
    }
    setResetModal(true);
  };

  const performReset = async () => {
    setResetModal(false);
    try {
      setResetConfirm('');
      await resetJourney();
    } catch (err) {
      setInfo({ title: 'ОШИБКА СБРОСА', message: String(err) });
    }
  };

  const journeyDays = hero
    ? differenceInCalendarDays(new Date(), parseISO(hero.journey_start_date)) + 1
    : 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <SystemBackground color={theme.accent} background={theme.background} />
      <AmbientEmbers color={theme.auraColor ?? theme.accent} />
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={[styles.title, { color: theme.text }]}>Настройки</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
          <Glyph name="close" color={theme.textSecondary} size={20} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[styles.sectionHeader, { color: theme.accent }]}>Уведомления</Text>
        <Text style={[styles.label, { color: theme.textSecondary }]}>Интервал (часы)</Text>
        <View style={styles.intervalRow}>
          {INTERVALS.map((v) => (
            <TouchableOpacity
              key={v}
              style={[
                styles.intervalBtn,
                {
                  borderColor: notifInterval === v ? theme.accent : theme.textSecondary,
                  backgroundColor: notifInterval === v ? theme.accent + '30' : 'transparent',
                },
              ]}
              onPress={() => saveInterval(v)}
            >
              <CornerBrackets color={notifInterval === v ? theme.accent : theme.textSecondary} />
              <Text style={[styles.intervalText, { color: notifInterval === v ? theme.accent : theme.textSecondary }]}>
                {v} ч
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.label, { color: theme.textSecondary }]}>
          Тихие часы (без напоминаний) — ЧЧ:ММ
        </Text>
        <View style={styles.quietRow}>
          <View style={styles.quietField}>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.accent }]}
              value={quietStart}
              onChangeText={setQuietStart}
              onEndEditing={saveQuietHours}
              placeholder="00:00"
              placeholderTextColor={theme.textSecondary}
              maxLength={5}
              keyboardType="numbers-and-punctuation"
            />
            <CornerBrackets color={theme.accent} length={8} />
          </View>
          <Text style={[styles.label, { color: theme.textSecondary, marginBottom: 0 }]}>до</Text>
          <View style={styles.quietField}>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.accent }]}
              value={quietEnd}
              onChangeText={setQuietEnd}
              onEndEditing={saveQuietHours}
              placeholder="07:00"
              placeholderTextColor={theme.textSecondary}
              maxLength={5}
              keyboardType="numbers-and-punctuation"
            />
            <CornerBrackets color={theme.accent} length={8} />
          </View>
        </View>

        <Text style={[styles.sectionHeader, { color: theme.accent }]}>Разрешения</Text>
        <Text style={[styles.label, { color: theme.textSecondary }]}>
          Доступ к статистике — Завеса сама считает время в Instagram и TikTok.
          {usageGranted === null ? '' : usageGranted ? '  ✓ Разрешено' : '  ✗ Не разрешено'}
        </Text>
        <TouchableOpacity
          style={[styles.exportButton, { borderColor: theme.accent }]}
          onPress={handleGrantUsage}
        >
          <CornerBrackets color={theme.accent} />
          <Text style={[styles.exportText, { color: theme.accent }]}>
            {usageGranted ? 'Управлять доступом' : 'Дать доступ к статистике'}
          </Text>
        </TouchableOpacity>

        <Text style={[styles.sectionHeader, { color: theme.accent }]}>О тебе</Text>
        <Text style={[styles.infoText, { color: theme.text }]}>Игрок: {hero?.name ?? 'Неизвестно'}</Text>
        <Text style={[styles.infoText, { color: theme.text }]}>Начало пути: {hero?.journey_start_date ?? '—'}</Text>
        <Text style={[styles.infoText, { color: theme.text }]}>День {journeyDays} из 180</Text>

        {/* Data */}
        <Text style={[styles.sectionHeader, { color: theme.accent }]}>Данные</Text>
        <TouchableOpacity
          style={[styles.exportButton, { borderColor: theme.accent }]}
          onPress={handleExport}
        >
          <CornerBrackets color={theme.accent} />
          <Text style={[styles.exportText, { color: theme.accent }]}>
            Экспорт данных (JSON)
          </Text>
        </TouchableOpacity>
        <Text style={[styles.label, { color: theme.textSecondary }]}>
          Сохраняет весь прогресс в JSON-файл — резервная копия.
        </Text>

        <TouchableOpacity
          style={[styles.exportButton, { borderColor: theme.accent, marginTop: 8 }]}
          onPress={handleImport}
        >
          <CornerBrackets color={theme.accent} />
          <Text style={[styles.exportText, { color: theme.accent }]}>
            Импорт данных (JSON)
          </Text>
        </TouchableOpacity>
        <Text style={[styles.label, { color: theme.textSecondary }]}>
          Восстанавливает прогресс из файла. ВСЕ текущие данные будут заменены.
        </Text>

        <TouchableOpacity
          style={[styles.exportButton, { borderColor: theme.accent, marginTop: 8 }]}
          onPress={async () => {
            const banner = hero ? `notif_${hero.hero_class.toLowerCase()}_${hero.rank.toLowerCase()}` : undefined;
            const ok = await RichNotification.presentNow(
              'СИСТЕМА',
              'Система проверяет твою решимость. Ответь на вызов.',
              banner
            );
            if (!ok) Alert.alert('УВЕДОМЛЕНИЕ', 'Расширенные уведомления требуют свежей сборки приложения.');
          }}
        >
          <CornerBrackets color={theme.accent} />
          <Text style={[styles.exportText, { color: theme.accent }]}>Тестовое уведомление</Text>
        </TouchableOpacity>

        <Text style={[styles.sectionHeader, { color: '#ff4444' }]}>Опасная зона</Text>
        <Text style={[styles.label, { color: theme.textSecondary }]}>
          Введи «Я ПРИНИМАЮ СБРОС», чтобы включить сброс:
        </Text>
        <View style={styles.inputWrap}>
          <TextInput
            style={[styles.input, { color: theme.text, borderColor: '#ff4444' }]}
            value={resetConfirm}
            onChangeText={setResetConfirm}
            placeholder="Введи здесь..."
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="characters"
          />
          <CornerBrackets color="#ff4444" />
        </View>
        <TouchableOpacity
          style={[styles.resetButton, { backgroundColor: resetConfirm === 'Я ПРИНИМАЮ СБРОС' ? '#ff4444' : '#333' }]}
          onPress={handleResetJourney}
        >
          <Text style={styles.resetText}>Сбросить путь</Text>
        </TouchableOpacity>

        <View style={styles.bottomPadding} />
      </ScrollView>

      <ConfirmModal
        visible={resetModal}
        destructive
        title="ПОСЛЕДНЕЕ ПРЕДУПРЕЖДЕНИЕ"
        message="Это сотрёт ВСЕ данные. Отменить нельзя."
        cancelText="ОТМЕНА"
        confirmText="СБРОСИТЬ"
        onCancel={() => setResetModal(false)}
        onConfirm={performReset}
      />

      <ConfirmModal
        visible={pendingImport !== null}
        destructive
        title="ЗАМЕНИТЬ ВСЕ ДАННЫЕ?"
        message="Импорт заменит героя, историю, серии и всё остальное данными из файла. Отменить нельзя."
        cancelText="ОТМЕНА"
        confirmText="ИМПОРТ"
        onCancel={() => setPendingImport(null)}
        onConfirm={performImport}
      />

      <ConfirmModal
        visible={info !== null}
        singleButton
        title={info?.title ?? ''}
        message={info?.message ?? ''}
        confirmText="OK"
        onCancel={() => setInfo(null)}
        onConfirm={() => setInfo(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#333',
  },
  title: { fontSize: 17, letterSpacing: 0.3, fontFamily: FONTS.display },
  closeBtn: { fontSize: 20, padding: 4, fontFamily: FONTS.body },
  scroll: { flex: 1, padding: 16 },
  sectionHeader: { fontSize: 12, letterSpacing: 0.5, marginTop: 24, marginBottom: 12, fontFamily: FONTS.display },
  label: { fontSize: 13, marginBottom: 8, fontFamily: FONTS.body },
  intervalRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  intervalBtn: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 2, position: 'relative' },
  intervalText: { fontSize: 13, fontFamily: FONTS.bold },
  infoText: { fontSize: 14, marginBottom: 6, fontFamily: FONTS.body },
  inputWrap: { position: 'relative', marginBottom: 12 },
  quietRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  quietField: { position: 'relative', flex: 1 },
  input: { borderWidth: 1, borderRadius: 2, padding: 10, fontSize: 14, fontFamily: FONTS.body },
  resetButton: { padding: 14, alignItems: 'center', borderRadius: 2, marginBottom: 16 },
  resetText: { color: '#fff', fontSize: 14, letterSpacing: 0.3, fontFamily: FONTS.bold },
  bottomPadding: { height: 64 },
  exportButton: { borderWidth: 1, padding: 14, alignItems: 'center', marginBottom: 8, position: 'relative' },
  exportText: { fontSize: 13, letterSpacing: 0.3, fontFamily: FONTS.bold },
});
