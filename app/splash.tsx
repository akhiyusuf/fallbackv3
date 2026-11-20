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
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import { useThemeStore } from '@/app-shell';
import { billing } from '@/services/billing';
import { takePendingTapRoute } from '@/services/notifications';
import { store, repos } from '@/db';
import { catchUpCycles, sweepExpiredDeleted } from '@/queries';
import { IndeterminateBar } from '@/features/data/IndeterminateBar';
import { S01_COPY } from '@/features/data/copy';
import { SPACE, useTheme } from '@/theme';
import { Text } from '@/ui/AppText';

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
        // Nothing below the settings read may send a working store to recovery: the sweep, the look,
        // the plan check and the reminder-tap route are each best-effort, on their own.
        // What has been in Recently deleted past its time goes for good, its past days kept in the record.
        try {
          void Promise.resolve(sweepExpiredDeleted()).catch(() => undefined);
          // Cycles that ended while the app was closed are archived now, not at the next log.
          void Promise.resolve(catchUpCycles()).catch(() => undefined);
        } catch {
          /* the sweep never blocks start-up */
        }
        // The look the person chose (light or dark, and the colour) is kept with their settings;
        // put it back before the first real screen draws.
        try {
          useThemeStore.getState().hydrate(settings.theme, settings.accent);
        } catch {
          /* the default look is fine */
        }
        // The plan (subscription) is asked of the app store in the background, so Settings and the
        // assistant show the right one from the start. It never holds up the first screen.
        try {
          void Promise.resolve(billing.init())
            .then(() => billing.refreshEntitlement())
            .catch(() => undefined);
        } catch {
          /* the plan is checked again later */
        }
        navigatedRef.current = true;
        if (settings.onboardingCompletedAt) {
          // A reminder tap that opened the app goes where it pointed (e.g. the re-entry banner).
          let tapRoute: string | null = null;
          try {
            tapRoute = takePendingTapRoute();
          } catch {
            /* no reminder route: go to Today */
          }
          router.replace((tapRoute ?? '/today') as never);
        } else {
          router.replace('/onboarding/concept');
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
