/**
 * S37 — Microphone Permission Primer    route: /assistant/mic-primer
 * Owner: M6. Features: F16, F9.
 * Spec: design-input/fallback-handoff/uploads/ALLSCREENS_1.md (S37)
 */
import { useEffect, useState } from 'react';
import { AppState, Linking, StyleSheet, Text, View } from 'react-native';
import { Mic } from 'lucide-react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { getRecordingPermissionsAsync, requestRecordingPermissionsAsync } from 'expo-audio';

import { AssistantHeader } from '@/features/assistant/AssistantHeader';
import { S37_COPY } from '@/features/assistant/copy';
import { SPACE, useTheme } from '@/theme';
import { Button } from '@/ui';

export default function S37MicrophonePermissionPrimer() {
  const t = useTheme();
  const router = useRouter();
  const { context } = useLocalSearchParams<{ context?: string }>();
  const isRecovery = context === 'recovery';
  const copy = isRecovery ? S37_COPY.recovery : S37_COPY.primer;
  const [requesting, setRequesting] = useState(false);

  function goToChat(listen: boolean) {
    router.replace(`/assistant/chat?listen=${listen ? '1' : ''}` as Href);
  }

  function handleBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/assistant' as Href);
  }

  async function handlePrimaryPrimer() {
    setRequesting(true);
    try {
      const result = await requestRecordingPermissionsAsync();
      goToChat(result.granted);
    } finally {
      setRequesting(false);
    }
  }

  async function handlePrimaryRecovery() {
    // B11 — `Linking.openSettings()` resolves as soon as Settings LAUNCHES, while the user is
    // still inside Settings, not after they've actually toggled the permission and come back.
    // Checking permission immediately here can never see the change. The real recheck happens
    // in the `AppState` effect below, on the app's next foreground.
    await Linking.openSettings();
  }

  useEffect(() => {
    if (!isRecovery) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      void (async () => {
        const status = await getRecordingPermissionsAsync();
        if (status.granted) goToChat(true);
        // else: stays on this same recovery framing — no navigation needed, we're already here.
      })();
    });
    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecovery]);

  function handleSecondary() {
    goToChat(false);
  }

  return (
    <View style={[styles.root, { backgroundColor: t.color.bg }]}>
      <AssistantHeader onBack={handleBack} />
      <View style={styles.content}>
        <Mic size={40} color={t.accent.base} accessibilityElementsHidden importantForAccessibility="no" />
        <Text accessibilityRole="header" style={[styles.headline, { color: t.color.text }]}>
          {copy.headline}
        </Text>
        <Text style={[styles.body, { color: t.color.textMuted }]}>{copy.body}</Text>
        {!isRecovery ? <Text style={[styles.secondaryLine, { color: t.color.textDim }]}>{S37_COPY.primer.secondaryLine}</Text> : null}
        <Text style={[styles.reassurance, { color: t.color.textDim }]}>{S37_COPY.reassurance}</Text>

        {requesting ? (
          <Text style={[styles.waiting, { color: t.color.textMuted }]} accessibilityLiveRegion="polite">
            {S37_COPY.waitingForPermission}
          </Text>
        ) : (
          <View style={styles.actions}>
            <Button
              label={copy.primaryAction}
              onPress={isRecovery ? handlePrimaryRecovery : handlePrimaryPrimer}
              variant="primary"
              accessibilityLabel={isRecovery ? 'Open system settings, button' : 'Enable microphone access, button'}
              fullWidth
            />
            <Button
              label={copy.secondaryAction}
              onPress={handleSecondary}
              variant="secondary"
              accessibilityLabel={`${copy.secondaryAction}, button`}
              fullWidth
            />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1, padding: SPACE.s3, gap: SPACE.s2, alignItems: 'center', justifyContent: 'center' },
  headline: { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  body: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  secondaryLine: { fontSize: 13, textAlign: 'center' },
  reassurance: { fontSize: 13, textAlign: 'center' },
  waiting: { fontSize: 15 },
  actions: { gap: SPACE.s2, alignSelf: 'stretch', paddingTop: SPACE.s3 },
});
