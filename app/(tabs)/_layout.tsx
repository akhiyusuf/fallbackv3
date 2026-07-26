/**
 * M0 — the BottomTabs shell (Today · Routines · Events · Courses · To-dos).
 * M3 owns the five tab screens; this layout file stays M0's.
 */
import { Tabs } from 'expo-router';

import { useTheme } from '@/theme';

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.accent.base,
        tabBarInactiveTintColor: t.color.textMuted,
        tabBarStyle: { backgroundColor: t.color.bg, borderTopColor: t.color.border },
      }}
    >
      <Tabs.Screen name="today" options={{ title: 'Today' }} />
      <Tabs.Screen name="routines" options={{ title: 'Routines' }} />
      <Tabs.Screen name="events" options={{ title: 'Events' }} />
      <Tabs.Screen name="courses" options={{ title: 'Courses' }} />
      <Tabs.Screen name="todos" options={{ title: 'To-dos' }} />
    </Tabs>
  );
}
