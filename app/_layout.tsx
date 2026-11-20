/**
 * M0 — root layout. Owns the provider stack and the root Stack navigator.
 *
 * CONVENTION (so no module ever edits this file): a route that needs non-default
 * presentation declares it in its OWN file with `<Stack.Screen options={{...}} />`.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ErrorBoundary, useAppBootstrap, useDayRollover, useThemeStore } from '@/app-shell';
import { initNotificationsBridge } from '@/services/notifications';
import { warmUpSounds } from '@/services/sfx';
import { useForegroundRepairs } from '@/app-shell/repairs';
import { initWidgetsBridge } from '@/services/widgets';
import { ThemeContext, buildTheme, resolveScheme } from '@/theme';
import { Toast } from '@/ui/Toast';
import { CelebrationHost } from '@/features/progress/CelebrationHost';
import { AddMenuHost } from '@/features/task/AddMenuHost';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Local-first: reads are cheap and must reflect writes immediately (PRD §5, <=100ms).
      staleTime: 0,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: true,
      networkMode: 'always',
    },
    mutations: { networkMode: 'always' },
  },
});

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AppShell />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Split from `RootLayout` because `useDayRollover` needs `useQueryClient()`, which only
 * resolves inside `QueryClientProvider`'s subtree.
 */
function AppShell() {
  const osScheme = useColorScheme();
  const mode = useThemeStore((s) => s.mode);
  const accent = useThemeStore((s) => s.accent);
  // The saved look is put back by the splash screen (`app/splash.tsx`) once the store is open.
  const theme = useMemo(
    () => buildTheme(resolveScheme(mode, osScheme === 'dark' ? 'dark' : osScheme === 'light' ? 'light' : null), accent),
    [mode, accent, osScheme],
  );
  useAppBootstrap();
  useDayRollover();
  // Sweep, cycle catch-up and XP heal run again each time the app comes back to the foreground.
  useForegroundRepairs();

  // Architect CR-5 (wave-2 review, M7). THE boot-time call site for both event-bus bridges.
  // M7's own screens also call these on mount, and both are idempotent by construction
  // (`bridgeInitialized` guard) — but a session that never opens an M7 screen would otherwise
  // arm no reminders and publish no widget snapshot at all. Deliberately no teardown returned:
  // the bridges are app-lifetime singletons and this shell only unmounts when the app dies.
  useEffect(() => {
    initNotificationsBridge();
    initWidgetsBridge();
    warmUpSounds();
  }, []);

  return (
    <ThemeContext.Provider value={theme}>
      {/* The clock and battery icons follow the look chosen in the app, not the phone's own setting. */}
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      <ErrorBoundary>
        <Stack
          screenOptions={({ route }) => ({
            headerShown: false,
            contentStyle: { backgroundColor: theme.color.bg },
            // Onboarding steps do not swap pages: the shell keeps the banner and button in place and
            // animates the new step's picture and words in (OnboardingShell). Elsewhere a new screen
            // slides in over the last one, which eases back under it; Android's own change was a
            // quick fade with a short jump.
            animation: route.name.startsWith('onboarding/') ? 'none' : Platform.OS === 'android' ? 'ios_from_right' : 'default',
          })}
        />
      </ErrorBoundary>
      {/* The overlays get their own boundaries: a fault in one of them must not take the app down. */}
      <ErrorBoundary quiet>
        <AddMenuHost />
      </ErrorBoundary>
      <ErrorBoundary quiet>
        <CelebrationHost />
      </ErrorBoundary>
      <Toast />
    </ThemeContext.Provider>
  );
}
