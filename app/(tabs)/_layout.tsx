/**
 * M0 — the BottomTabs shell (Today · Routines · Events · Courses · To-dos).
 * M3 owns the five tab screens; this layout file stays M0's.
 *
 * The bar is `SlidingTabBar`: the active pill slides from tab to tab. The screens themselves
 * shift a little and fade as they change ('shift'), so switching tabs moves as one piece.
 */
import { Tabs } from 'expo-router';

import { SlidingTabBar } from '@/ui/SlidingTabBar';

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <SlidingTabBar {...props} />} screenOptions={{ headerShown: false, animation: 'shift' }}>
      <Tabs.Screen name="today" options={{ title: 'Today' }} />
      <Tabs.Screen name="routines" options={{ title: 'Routines' }} />
      <Tabs.Screen name="events" options={{ title: 'Events' }} />
      <Tabs.Screen name="courses" options={{ title: 'Courses' }} />
      <Tabs.Screen name="todos" options={{ title: 'To-dos' }} />
    </Tabs>
  );
}
