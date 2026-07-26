/**
 * M0 — root layout. Owns the provider stack and the root Stack navigator.
 *
 * CONVENTION (so no module ever edits this file): a route that needs non-default
 * presentation declares it in its OWN file with `<Stack.Screen options={{...}} />`.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ErrorBoundary, useAppBootstrap, useDayRollover, useThemeStore } from '@/app-shell';
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
