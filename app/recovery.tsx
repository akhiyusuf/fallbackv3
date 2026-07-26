/**
 * S50 — Data Recovery    route: /recovery
 * Owner: M1. Features: F1.
 * Spec: design-input/fallback-handoff/uploads/ALLSCREENS_1.md (S50)
 *
 * Calm recovery surface for a corrupt local store detected on launch — never red, never
 * alarm iconography, never a crash loop. Same sanctioned `@/db` exception as S01: this
 * screen's "Try again" re-attempts `StoreLifecycle.open()` directly.
 */
import { useState } from 'react';
import { useRouter, type Href } from 'expo-router';
import { RefreshCw } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { store } from '@/db';
import { withOrigin } from '@/navigation';
import { S50_COPY } from '@/features/data/copy';
import { SPACE, useTheme } from '@/theme';
import { Button } from '@/ui';

export default function S50DataRecovery() {
  const t = useTheme();
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);

  async function handleTryAgain() {
    setRetrying(true);
    const result = await store.open();
    if (result.ok && result.value === 'ready') {
      // S01 re-evaluates onboarding/returning-user routing on its own.
      router.replace('/splash');
      return;
    }
    // Silently returns to the same default rendering — no new copy, no escalation.
    setRetrying(false);
  }

  function handleResetAppData() {
    router.push(withOrigin('/settings/data/erase', 'recovery') as Href);
  }

  return (
    <View style={[styles.root, { backgroundColor: t.color.bg }]}>
      <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.content}>
        <RefreshCw size={40} color={t.color.textDim} accessibilityElementsHidden importantForAccessibility="no" />
        <Text accessibilityRole="header" style={[styles.headline, { color: t.color.text }]}>
          {S50_COPY.headline}
        </Text>
        <Text style={[styles.body, { color: t.color.textMuted }]}>{S50_COPY.body}</Text>
      </View>
      <View style={styles.actions}>
        <Button
          label={S50_COPY.tryAgain}
          onPress={handleTryAgain}
          loading={retrying}
          disabled={retrying}
          variant="primary"
          fullWidth
          accessibilityLabel={S50_COPY.tryAgain}
        />
        <Button
          label={S50_COPY.resetAppData}
          onPress={handleResetAppData}
          disabled={retrying}
          variant="secondary"
          fullWidth
          accessibilityLabel={S50_COPY.resetAppData}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', padding: SPACE.s4, gap: SPACE.s5 },
  content: { alignItems: 'center', gap: SPACE.s2 },
  headline: { fontSize: 24, fontWeight: '700', textAlign: 'center' },
  body: { fontSize: 16, lineHeight: 24, textAlign: 'center' },
  actions: { gap: SPACE.s2 },
});
