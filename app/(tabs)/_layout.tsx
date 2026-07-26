/**
 * M0 — the BottomTabs shell (Today · Routines · Events · Courses · To-dos).
 * M3 owns the five tab screens; this layout file stays M0's.
 */
import { Tabs } from 'expo-router';
import { Calendar, ListChecks, Repeat, Sprout, StickyNote } from 'lucide-react-native';

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
      <Tabs.Screen name="today" options={{ title: 'Today', tabBarIcon: ({ color, size }) => <Sprout color={color} size={size} /> }} />
      <Tabs.Screen
        name="routines"
        options={{ title: 'Routines', tabBarIcon: ({ color, size }) => <Repeat color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="events"
        options={{ title: 'Events', tabBarIcon: ({ color, size }) => <Calendar color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="courses"
        options={{ title: 'Courses', tabBarIcon: ({ color, size }) => <ListChecks color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="todos"
        options={{ title: 'To-dos', tabBarIcon: ({ color, size }) => <StickyNote color={color} size={size} /> }}
      />
    </Tabs>
  );
}
