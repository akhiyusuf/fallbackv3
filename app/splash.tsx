/**
 * S01 — Splash    route: /splash
 * Owner: M1. Features: F1, F9.
 * Spec: design-input/fallback-handoff/uploads/ALLSCREENS_1.md (S01)
 *
 * The one sanctioned exception to "a feature module never imports `@/db`" — API.md §1.1
 * says it outright: "open(): ... // S01 calls this." This screen's entire job is to
 * perform that call and route accordingly; nothing else in the app opens the store.
 */
import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';

import { store, repos } from '@/db';
import { IndeterminateBar } from '@/features/data/IndeterminateBar';
import { S01_COPY } from '@/features/data/copy';
import { SPACE, useTheme } from '@/theme';

// "If the store read resolves in under ~400ms, the splash still holds for a brief minimum
// so the wordmark isn't a single-frame flash" — calm pacing, not a loading-state variant.
const MIN_DISPLAY_MS = 400;

export default function S01Splash() {
  const t = useTheme();
  const router = useRouter();
  const navigatedRef = useRef(false);

  useEffect(() => {
    const startedAt = Date.now();
    let cancelled = false;

    async function boot() {
      try {
        const result = await store.open();

        const elapsed = Date.now() - startedAt;
        const remaining = Math.max(0, MIN_DISPLAY_MS - elapsed);
        if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
        if (cancelled || navigatedRef.current) return;

        // Store read throws / detects a corrupt store -> S50, never a crash or infinite spinner.
        if (!result.ok || result.value === 'corrupt' || result.value === 'uninitialised') {
          navigatedRef.current = true;
          router.replace('/recovery');
          return;
        }

        const settings = await repos.settings.get();
        if (cancelled || navigatedRef.current) return;
        navigatedRef.current = true;
        if (settings.onboardingCompletedAt) {
          router.replace('/today');
        } else {
          router.replace('/onboarding/hook');
        }
      } catch {
        // `repos.settings.get()` throws (by design) if the singleton is somehow missing
        // right after a "ready" open — an unhandled rejection here would hang the splash
        // forever instead of degrading. Same calm destination as any other unreadable
        // store: never a crash loop.
        if (cancelled || navigatedRef.current) return;
        navigatedRef.current = true;
        router.replace('/recovery');
      }
    }

    boot();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility?.(`${S01_COPY.wordmark}. ${S01_COPY.tagline}`);
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: t.color.bg }]} accessibilityLabel="Splash">
      <View style={styles.center}>
        <Text accessibilityRole="header" style={[styles.wordmark, { color: t.color.text }]}>
          {S01_COPY.wordmark}
        </Text>
        <Text style={[styles.tagline, { color: t.color.textMuted }]}>{S01_COPY.tagline}</Text>
      </View>
      <View style={styles.footer}>
        <IndeterminateBar />
        <Text accessibilityLiveRegion="polite" style={[styles.status, { color: t.color.textDim }]}>
          {S01_COPY.status}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', gap: SPACE.s2 },
  wordmark: { fontSize: 40, fontWeight: '700' },
  tagline: { fontSize: 16 },
  footer: { position: 'absolute', bottom: SPACE.s6, alignItems: 'center', gap: SPACE.s2 },
  status: { fontSize: 14 },
});
