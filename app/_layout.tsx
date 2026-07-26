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

import { ThemeContext, buildTheme, resolveScheme } from '@/theme';

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
  const osScheme = useColorScheme();
  // TODO(M0): read theme/accent from settings once M1's store is wired.
  const theme = useMemo(() => buildTheme(resolveScheme('auto', osScheme === 'dark' ? 'dark' : osScheme === 'light' ? 'light' : null)), [osScheme]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeContext.Provider value={theme}>
            <StatusBar style="auto" />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.color.bg } }} />
          </ThemeContext.Provider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
