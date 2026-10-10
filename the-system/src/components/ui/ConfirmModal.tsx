import React from 'react';
import { Modal, View, Text, StyleSheet, Pressable, TouchableOpacity } from 'react-native';
import { useSystemStore } from '../../store/useSystemStore';
import { FONTS } from '../../theme/typography';
import CornerBox, { CornerBrackets } from './CornerBox';

const DANGER = '#E5645A';

export interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  /** Destructive actions tint the panel + confirm button red. */
  destructive?: boolean;
  /** Info mode: single full-width button, no cancel. */
  singleButton?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * App-themed confirmation panel — replaces the default Android Alert dialog.
 * Cap-corner frame (CornerBox), Lora type, coral/red accents, dim backdrop.
 */
export default function ConfirmModal({
  visible,
  title,
  message,
  confirmText = 'ПОДТВЕРДИТЬ',
  cancelText = 'ОТМЕНА',
  destructive = false,
  singleButton = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const theme = useSystemStore((s) => s.currentTheme);
  const edge = destructive ? DANGER : theme.accent;

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable style={styles.backdrop} onPress={onCancel}>
        {/* Inner Pressable swallows taps so the panel itself doesn't dismiss. */}
        <Pressable onPress={() => {}} style={styles.center}>
          <CornerBox
            color={edge}
            fill={theme.primary}
            cornerThickness={2}
            cornerLength={16}
            style={styles.panel}
          >
            <Text style={[styles.title, { color: edge }]}>{title}</Text>
            <View style={[styles.rule, { backgroundColor: edge + '40' }]} />
            <Text style={[styles.message, { color: theme.textSecondary }]}>{message}</Text>

            <View style={styles.buttons}>
              {!singleButton && (
                <TouchableOpacity
                  style={[styles.btn, { borderColor: theme.textSecondary + '70' }]}
                  onPress={onCancel}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.btnText, { color: theme.textSecondary }]}>{cancelText}</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.btn, styles.btnConfirm, { backgroundColor: edge, borderColor: edge }]}
                onPress={onConfirm}
                activeOpacity={0.85}
              >
                <CornerBrackets color={theme.background} thickness={1.5} length={8} inset={3} />
                <Text style={[styles.btnText, styles.btnConfirmText, { color: theme.background }]}>
                  {confirmText}
                </Text>
              </TouchableOpacity>
            </View>
          </CornerBox>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.74)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  center: { width: '100%', maxWidth: 360, alignItems: 'stretch' },
  panel: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 18 },
  title: {
    fontSize: 16,
    letterSpacing: 1,
    fontFamily: FONTS.display,
    textAlign: 'center',
  },
  rule: { height: 1, marginTop: 12, marginBottom: 14 },
  message: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: FONTS.body,
    textAlign: 'center',
  },
  buttons: { flexDirection: 'row', gap: 12, marginTop: 22 },
  btn: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnConfirm: { position: 'relative' },
  btnText: {
    fontSize: 12,
    letterSpacing: 1,
    fontFamily: FONTS.bodySemibold,
  },
  btnConfirmText: { fontFamily: FONTS.bold },
});
