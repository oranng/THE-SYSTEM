import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator, TransitionPresets } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Line, Circle } from 'react-native-svg';
import { useSystemStore } from '../store/useSystemStore';
import type { RootStackParamList } from './types';
import { FONTS } from '../theme/typography';

import CommandHall from '../screens/CommandHall';
import AscensionPath from '../screens/AscensionPath';
import Mirror from '../screens/Mirror';
import Codex from '../screens/Codex';
import Quests from '../screens/Quests';
import Archive from '../screens/Archive';
import Awakening from '../screens/Awakening';
import MandateReveal from '../screens/MandateReveal';
import LevelUpSplash from '../screens/LevelUpSplash';
import Settings from '../screens/Settings';
import ShieldOverlay from '../screens/ShieldOverlay';
import SRankCutscene from '../screens/SRankCutscene';
import FinalJudgement from '../screens/FinalJudgement';

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

// Constellation tab icons — star dots joined by faint lines.
// Star = small circle. Focused → brighter/larger stars + brighter lines.
function Star({ x, y, color, focused, big }: { x: number; y: number; color: string; focused: boolean; big?: boolean }) {
  const r = (big ? 1.7 : 1.2) * (focused ? 1.15 : 1);
  return (
    <>
      {focused && <Circle cx={x} cy={y} r={r + 1.4} fill={color} opacity={0.18} />}
      <Circle cx={x} cy={y} r={r} fill={color} />
    </>
  );
}

function constLine(x1: number, y1: number, x2: number, y2: number, color: string, focused: boolean, key: string) {
  return (
    <Line
      key={key}
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={color}
      strokeWidth={focused ? 1 : 0.8}
      opacity={focused ? 0.6 : 0.4}
    />
  );
}

// Command — Orion / warrior constellation
function IconCommand({ color, focused }: { color: string; focused: boolean }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 22 22">
      {constLine(5, 4, 11, 10, color, focused, 'a')}
      {constLine(17, 5, 11, 10, color, focused, 'b')}
      {constLine(11, 10, 9, 13, color, focused, 'c')}
      {constLine(9, 13, 13, 12, color, focused, 'd')}
      {constLine(9, 13, 7, 18, color, focused, 'e')}
      {constLine(13, 12, 16, 17, color, focused, 'f')}
      <Star x={5} y={4} color={color} focused={focused} />
      <Star x={17} y={5} color={color} focused={focused} />
      <Star x={11} y={10} color={color} focused={focused} big />
      <Star x={9} y={13} color={color} focused={focused} />
      <Star x={13} y={12} color={color} focused={focused} />
      <Star x={7} y={18} color={color} focused={focused} />
      <Star x={16} y={17} color={color} focused={focused} />
    </Svg>
  );
}

// Quests — sword constellation (blade, guard, hilt)
function IconQuests({ color, focused }: { color: string; focused: boolean }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 22 22">
      {constLine(17, 3, 9, 13, color, focused, 'a')}
      {constLine(6, 10, 12, 16, color, focused, 'b')}
      {constLine(9, 13, 4, 18, color, focused, 'c')}
      <Star x={17} y={3} color={color} focused={focused} big />
      <Star x={6} y={10} color={color} focused={focused} />
      <Star x={12} y={16} color={color} focused={focused} />
      <Star x={9} y={13} color={color} focused={focused} />
      <Star x={4} y={18} color={color} focused={focused} />
    </Svg>
  );
}

// Ascend — rising diagonal constellation
function IconAscend({ color, focused }: { color: string; focused: boolean }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 22 22">
      {constLine(4, 18, 8, 14, color, focused, 'a')}
      {constLine(8, 14, 11, 11, color, focused, 'b')}
      {constLine(11, 11, 15, 7, color, focused, 'c')}
      {constLine(15, 7, 19, 3, color, focused, 'd')}
      <Star x={4} y={18} color={color} focused={focused} />
      <Star x={8} y={14} color={color} focused={focused} />
      <Star x={11} y={11} color={color} focused={focused} />
      <Star x={15} y={7} color={color} focused={focused} />
      <Star x={19} y={3} color={color} focused={focused} big />
    </Svg>
  );
}

// Mirror — symmetric diamond constellation
function IconMirror({ color, focused }: { color: string; focused: boolean }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 22 22">
      {constLine(11, 3, 19, 11, color, focused, 'a')}
      {constLine(19, 11, 11, 19, color, focused, 'b')}
      {constLine(11, 19, 3, 11, color, focused, 'c')}
      {constLine(3, 11, 11, 3, color, focused, 'd')}
      <Star x={11} y={3} color={color} focused={focused} />
      <Star x={19} y={11} color={color} focused={focused} />
      <Star x={11} y={19} color={color} focused={focused} />
      <Star x={3} y={11} color={color} focused={focused} />
      <Star x={11} y={11} color={color} focused={focused} big />
    </Svg>
  );
}

// Codex — crown / arc constellation (Corona Borealis)
function IconCodex({ color, focused }: { color: string; focused: boolean }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 22 22">
      {constLine(3, 15, 6, 9, color, focused, 'a')}
      {constLine(6, 9, 11, 6, color, focused, 'b')}
      {constLine(11, 6, 16, 9, color, focused, 'c')}
      {constLine(16, 9, 19, 15, color, focused, 'd')}
      <Star x={3} y={15} color={color} focused={focused} />
      <Star x={6} y={9} color={color} focused={focused} />
      <Star x={11} y={6} color={color} focused={focused} big />
      <Star x={16} y={9} color={color} focused={focused} />
      <Star x={19} y={15} color={color} focused={focused} />
    </Svg>
  );
}

// Archive — star cluster (Pleiades)
function IconArchive({ color, focused }: { color: string; focused: boolean }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 22 22">
      {constLine(5, 6, 10, 4, color, focused, 'a')}
      {constLine(10, 4, 16, 7, color, focused, 'b')}
      {constLine(5, 6, 8, 12, color, focused, 'c')}
      {constLine(8, 12, 14, 13, color, focused, 'd')}
      {constLine(16, 7, 14, 13, color, focused, 'e')}
      {constLine(8, 12, 10, 18, color, focused, 'f')}
      <Star x={5} y={6} color={color} focused={focused} />
      <Star x={10} y={4} color={color} focused={focused} />
      <Star x={16} y={7} color={color} focused={focused} />
      <Star x={8} y={12} color={color} focused={focused} big />
      <Star x={14} y={13} color={color} focused={focused} />
      <Star x={10} y={18} color={color} focused={focused} />
    </Svg>
  );
}

function MainTabs() {
  const theme = useSystemStore((s) => s.currentTheme);
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      detachInactiveScreens={false}
      screenOptions={{
        headerShown: false,
        // Instant tab switches — screens are pre-mounted (lazy:false), so the
        // fade transition only added perceived lag.
        animation: 'none',
        sceneStyle: { backgroundColor: theme.background },
        lazy: false,
        // Freeze off-screen tabs so their always-on FX loops don't burn CPU in
        // the background, keeping switches snappy.
        freezeOnBlur: true,
        tabBarStyle: {
          backgroundColor: theme.primary,
          borderTopColor: theme.accent + '40',
          borderTopWidth: 1,
          height: 58 + insets.bottom,
          paddingBottom: 6 + insets.bottom,
          paddingTop: 6,
        },
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarLabelStyle: {
          fontSize: 9,
          letterSpacing: 0.3,
          marginTop: 2,
          fontFamily: FONTS.display,
        },
      }}
    >
      <Tab.Screen
        name="CommandHall"
        component={CommandHall}
        options={{
          tabBarLabel: 'Штаб',
          tabBarIcon: ({ focused, color }) => <IconCommand color={color} focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Quests"
        component={Quests}
        options={{
          tabBarLabel: 'Квесты',
          tabBarIcon: ({ focused, color }) => <IconQuests color={color} focused={focused} />,
        }}
      />
      <Tab.Screen
        name="AscensionPath"
        component={AscensionPath}
        options={{
          tabBarLabel: 'Путь',
          tabBarIcon: ({ focused, color }) => <IconAscend color={color} focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Mirror"
        component={Mirror}
        options={{
          tabBarLabel: 'Зеркало',
          tabBarIcon: ({ focused, color }) => <IconMirror color={color} focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Codex"
        component={Codex}
        options={{
          tabBarLabel: 'Кодекс',
          tabBarIcon: ({ focused, color }) => <IconCodex color={color} focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Archive"
        component={Archive}
        options={{
          tabBarLabel: 'Архив',
          tabBarIcon: ({ focused, color }) => <IconArchive color={color} focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { initialized, onboardingComplete } = useSystemStore();
  const theme = useSystemStore((s) => s.currentTheme);

  if (!initialized) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingTitle}>СИСТЕМА</Text>
        <View style={styles.loadingBar}>
          <View style={styles.loadingFill} />
        </View>
        <Text style={styles.loadingSub}>Загрузка…</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          cardStyle: { backgroundColor: theme.background },
          ...TransitionPresets.FadeFromBottomAndroid,
        }}
      >
        {!onboardingComplete ? (
          <Stack.Screen name="Awakening" component={Awakening} />
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen
              name="MandateReveal"
              component={MandateReveal}
              options={{ presentation: 'transparentModal', detachPreviousScreen: false, cardStyle: { backgroundColor: 'transparent' } }}
            />
            <Stack.Screen
              name="LevelUpSplash"
              component={LevelUpSplash}
              options={{ presentation: 'transparentModal', detachPreviousScreen: false, cardStyle: { backgroundColor: 'transparent' } }}
            />
            <Stack.Screen
              name="Settings"
              component={Settings}
              options={{
                presentation: 'modal',
                ...TransitionPresets.ModalSlideFromBottomIOS,
                // Swipe-to-dismiss disabled — it crashed on Android. Settings
                // closes only via the X button.
                gestureEnabled: false,
                detachPreviousScreen: false,
              }}
            />
            <Stack.Screen
              name="ShieldOverlay"
              component={ShieldOverlay}
              options={{ presentation: 'transparentModal', detachPreviousScreen: false, cardStyle: { backgroundColor: 'transparent' } }}
            />
            <Stack.Screen
              name="SRankCutscene"
              component={SRankCutscene}
              options={{ presentation: 'transparentModal', cardStyle: { backgroundColor: '#000000' } }}
            />
            <Stack.Screen
              name="FinalJudgement"
              component={FinalJudgement}
              options={{ presentation: 'transparentModal', cardStyle: { backgroundColor: 'transparent' } }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: '#262624',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingTitle: {
    color: '#D97757',
    fontSize: 28,
    letterSpacing: 0.3,
    fontFamily: FONTS.display,
  },
  loadingBar: {
    width: 160,
    height: 2,
    backgroundColor: '#3A3733',
    overflow: 'hidden',
  },
  loadingFill: {
    width: '60%',
    height: 2,
    backgroundColor: '#D97757',
  },
  loadingSub: {
    color: '#9A968B',
    fontSize: 10,
    letterSpacing: 0.5,
    fontFamily: FONTS.body,
  },
});
