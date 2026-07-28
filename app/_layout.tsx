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
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ErrorBoundary, useAppBootstrap, useDayRollover, useThemeStore } from '@/app-shell';
import { initNotificationsBridge } from '@/services/notifications';
import { initWidgetsBridge } from '@/services/widgets';
import { ThemeContext, buildTheme, resolveScheme } from '@/theme';
import { Toast } from '@/ui/Toast';

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
  // TODO(M1/M7): hydrate `useThemeStore` from `settings.theme`/`settings.accent` on boot.
  const theme = useMemo(
    () => buildTheme(resolveScheme(mode, osScheme === 'dark' ? 'dark' : osScheme === 'light' ? 'light' : null), accent),
    [mode, accent, osScheme],
  );
  useAppBootstrap();
  useDayRollover();

  // Architect CR-1 (wave-2 review, M7). THE boot-time call site for both event-bus bridges.
  // M7's own screens also call these on mount, and both are idempotent by construction
  // (`bridgeInitialized` guard) — but a session that never opens an M7 screen would otherwise
  // arm no reminders and publish no widget snapshot at all. Deliberately no teardown returned:
  // the bridges are app-lifetime singletons and this shell only unmounts when the app dies.
  useEffect(() => {
    initNotificationsBridge();
    initWidgetsBridge();
  }, []);

  return (
    <ThemeContext.Provider value={theme}>
      <StatusBar style="auto" />
      <ErrorBoundary>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.color.bg } }} />
      </ErrorBoundary>
      <Toast />
    </ThemeContext.Provider>
  );
}
