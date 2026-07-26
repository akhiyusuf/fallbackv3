/**
 * M0 — the BottomTabs shell (Today · Routines · Events · Courses · To-dos).
 * M3 owns the five tab screens; this layout file stays M0's.
 */
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { PRIMARY_NAV_ITEMS } from '@/ui/BottomTabs';
import { useTheme } from '@/theme';

function iconFor(key: string) {
  const item = PRIMARY_NAV_ITEMS.find((i) => i.key === key)!;
  const Icon = item.icon;
  return ({ color, size }: { color: ColorValue; size: number }) => <Icon color={color as string} size={size} />;
}

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.accent.base,
        tabBarInactiveTintColor: t.color.textDim,
        tabBarStyle: { backgroundColor: t.color.bg, borderTopColor: t.color.border },
      }}
    >
      <Tabs.Screen name="today" options={{ title: 'Today', tabBarIcon: iconFor('today') }} />
      <Tabs.Screen name="routines" options={{ title: 'Routines', tabBarIcon: iconFor('routines') }} />
      <Tabs.Screen name="events" options={{ title: 'Events', tabBarIcon: iconFor('events') }} />
      <Tabs.Screen name="courses" options={{ title: 'Courses', tabBarIcon: iconFor('courses') }} />
      <Tabs.Screen name="todos" options={{ title: 'To-dos', tabBarIcon: iconFor('todos') }} />
    </Tabs>
  );
}
