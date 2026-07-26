/**
 * S48 — Erase-All Confirmation    route: /settings/data/erase
 * Owner: M1. Features: F25.
 * Spec: design-input/fallback-handoff/uploads/ALLSCREENS_1.md (S48)
 *
 * Two SEPARATE origin rules (ARCHITECTURE §4.3's S22 note is the model this follows):
 * Cancel/hardware-back returns to whichever screen opened this one (S47 or S50, carried as
 * the `from` search param); a successful erase always lands on S01 regardless of origin.
 * S47 and S50 are both M1-owned, so `from` is only ever 'data' or 'recovery' here.
 */
import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { BackHandler, StyleSheet, Text, View } from 'react-native';
import { Trash2 } from 'lucide-react-native';

import { eraseAllData } from '@/services/data';
import type { ScreenOrigin } from '@/navigation';
import { S48_COPY } from '@/features/data/copy';
import { SPACE, useTheme } from '@/theme';
import { Button, InlineRetryBanner } from '@/ui';

function originDestination(origin: string | undefined): Href {
  return origin === 'recovery' ? ('/recovery' as Href) : ('/settings/data' as Href);
}

export default function S48EraseAllConfirmation() {
  const t = useTheme();
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: ScreenOrigin }>();
  const isFromRecovery = from === 'recovery';

  const [erasing, setErasing] = useState(false);
  const [failed, setFailed] = useState(false);

  const handleCancel = useCallback(() => {
    router.replace(originDestination(from));
  }, [router, from]);

  // Hardware back must behave identically to Cancel — this screen is a normal push (not a
  // sheet), so the default gesture-pop would already land on the origin screen, but the
  // Android hardware button needs an explicit intercept to guarantee the same
  // origin-dependent destination rather than an unqualified pop.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      handleCancel();
      return true;
    });
    return () => subscription.remove();
  }, [handleCancel]);

  async function handleErase() {
    setErasing(true);
    setFailed(false);
    const result = await eraseAllData();
    if (result.ok) {
      // Fresh-install state, both origins (SITEMAP Decision 14 / FLOWS.md).
      router.replace('/splash' as Href);
      return;
    }
    setErasing(false);
    setFailed(true);
  }

  const headline = isFromRecovery ? S48_COPY.headlineFromRecovery : S48_COPY.headlineFromData;
  const body = isFromRecovery ? S48_COPY.bodyFromRecovery : S48_COPY.bodyFromData;

  return (
    <View style={[styles.root, { backgroundColor: t.color.bg }]}>
      <View accessibilityRole="alert" style={styles.content}>
        <Trash2 size={40} color={t.color.textDim} accessibilityElementsHidden importantForAccessibility="no" />
        <Text accessibilityRole="header" style={[styles.headline, { color: t.color.text }]}>
          {headline}
        </Text>
        <Text style={[styles.body, { color: t.color.textMuted }]}>{body}</Text>
      </View>

      {failed ? <InlineRetryBanner message={S48_COPY.midWipeFailure} onRetry={handleErase} tone="warning" /> : null}

      <View style={styles.actions}>
        <Button
          label={S48_COPY.eraseButton}
          onPress={handleErase}
          loading={erasing}
          disabled={erasing}
          variant="danger"
          fullWidth
          accessibilityLabel={`${S48_COPY.eraseButton}, destructive action`}
        />
        <Button
          label={S48_COPY.cancelButton}
          onPress={handleCancel}
          disabled={erasing}
          variant="ghost"
          fullWidth
          accessibilityLabel={S48_COPY.cancelButton}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', padding: SPACE.s4, gap: SPACE.s4 },
  content: { alignItems: 'center', gap: SPACE.s2 },
  headline: { fontSize: 24, fontWeight: '700', textAlign: 'center' },
  body: { fontSize: 16, lineHeight: 24, textAlign: 'center' },
  actions: { gap: SPACE.s2 },
});
