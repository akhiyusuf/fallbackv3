/**
 * M0 — the BottomTabs shell (Today · Routines · Events · Courses · To-dos).
 * M3 owns the five tab screens; this layout file stays M0's.
 */
import { Tabs } from 'expo-router';
import { StyleSheet, View, type ColorValue } from 'react-native';

import { play } from '@/services/sfx';
import { PRIMARY_NAV_ITEMS } from '@/ui/BottomTabs';
import { useTheme } from '@/theme';

/** The active tab sits on a pill of the theme tint, so the theme shows on every screen. */
function iconFor(key: string, pill: string) {
  const item = PRIMARY_NAV_ITEMS.find((i) => i.key === key)!;
  const Icon = item.icon;
  return ({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) => (
    <View style={styles.iconBox}>
      {focused ? <View style={[styles.pill, { backgroundColor: pill }]} /> : null}
      <View>
        <Icon color={color as string} size={size} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  iconBox: { alignItems: 'center', justifyContent: 'center' },
  pill: { position: 'absolute', width: 56, height: 30, borderRadius: 999 },
});

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenListeners={{ tabPress: () => play('tap') }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.accent.text,
        tabBarInactiveTintColor: t.color.textMuted,
        tabBarStyle: { backgroundColor: t.color.bgAlt, borderTopColor: t.color.border, height: 68, paddingTop: 4, paddingBottom: 6 },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600', lineHeight: 16, marginTop: 1 },
      }}
    >
      <Tabs.Screen name="today" options={{ title: 'Today', tabBarIcon: iconFor('today', t.accent.soft) }} />
      <Tabs.Screen name="routines" options={{ title: 'Routines', tabBarIcon: iconFor('routines', t.accent.soft) }} />
      <Tabs.Screen name="events" options={{ title: 'Events', tabBarIcon: iconFor('events', t.accent.soft) }} />
      <Tabs.Screen name="courses" options={{ title: 'Courses', tabBarIcon: iconFor('courses', t.accent.soft) }} />
      <Tabs.Screen name="todos" options={{ title: 'To-dos', tabBarIcon: iconFor('todos', t.accent.soft) }} />
    </Tabs>
  );
}
