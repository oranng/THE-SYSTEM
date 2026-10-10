import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export const CHANNEL_ID = 'system-mandates';
export const CATEGORY_ID = 'system-mandate';
const ACCENT = '#D97757';

/** Foreground presentation: show heads-up banner + play sound. */
export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** Android high-importance channel so notifications pop as heads-up. */
async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Задания Системы',
    importance: Notifications.AndroidImportance.MAX,
    lightColor: ACCENT,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    vibrationPattern: [0, 250, 120, 250],
  });
}

/** Interactive action buttons (Duolingo-style). */
async function ensureCategory(): Promise<void> {
  await Notifications.setNotificationCategoryAsync(CATEGORY_ID, [
    {
      identifier: 'OPEN',
      buttonTitle: 'ENTER THE SYSTEM',
      options: { opensAppToForeground: true },
    },
    {
      identifier: 'ACK',
      buttonTitle: "I'M ON IT",
      options: { opensAppToForeground: true },
    },
  ]);
}

/** Call once on app start. */
export async function initNotifications(): Promise<void> {
  configureNotificationHandler();
  await ensureChannel();
  await ensureCategory();
}
