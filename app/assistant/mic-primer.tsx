/** S37 — Microphone permission primer    route: /assistant/mic-primer */
import { useEffect, useState } from 'react';
import { AppState, Linking, StyleSheet, View } from 'react-native';
import { Mic } from 'lucide-react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { getRecordingPermissionsAsync, requestRecordingPermissionsAsync } from 'expo-audio';

import { S37_COPY } from '@/features/assistant/copy';
import { FONT_SIZE, RADIUS, SPACE, useTheme } from '@/theme';
import { ButtonPair, Screen } from '@/ui';
import { Text } from '@/ui/AppText';

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

  async function handleAllow() {
    setRequesting(true);
    try {
      const result = await requestRecordingPermissionsAsync();
      goToChat(result.granted);
    } finally {
      setRequesting(false);
    }
  }

  useEffect(() => {
    if (!isRecovery) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      void (async () => {
        const status = await getRecordingPermissionsAsync();
        if (status.granted) goToChat(true);
      })();
    });
    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecovery]);

  return (
    <Screen
      title="Microphone"
      level="page"
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/assistant' as Href))}
      scroll={false}
      contentStyle={styles.content}
      footer={
        <ButtonPair
          primary={{
            label: copy.primaryAction,
            onPress: isRecovery ? () => void Linking.openSettings() : () => void handleAllow(),
            loading: requesting,
            accessibilityLabel: isRecovery ? 'Open system settings' : 'Allow microphone access',
          }}
          secondary={{ label: copy.secondaryAction, onPress: () => goToChat(false), disabled: requesting }}
        />
      }
    >
      <View style={[styles.iconWrap, { backgroundColor: t.accent.soft }]}>
        <Mic size={32} color={t.accent.text} accessibilityElementsHidden importantForAccessibility="no" />
      </View>
      <Text accessibilityRole="header" style={[styles.headline, { color: t.color.text }]}>
        {copy.headline}
      </Text>
      <Text style={[styles.body, { color: t.color.textMuted }]}>{copy.body}</Text>
      {isRecovery ? (
        <Text style={[styles.note, { color: t.color.textMuted }]}>{S37_COPY.reassurance}</Text>
      ) : (
        <Text style={[styles.note, { color: t.color.textMuted }]}>{S37_COPY.primer.secondaryLine}</Text>
      )}
      {requesting ? (
        <Text style={[styles.note, { color: t.color.textMuted }]} accessibilityLiveRegion="polite">
          {S37_COPY.waitingForPermission}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', justifyContent: 'center', gap: SPACE.s2 + 4 },
  iconWrap: { width: 72, height: 72, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center', marginBottom: SPACE.s2 },
  headline: { fontSize: FONT_SIZE.xl, fontWeight: '700', textAlign: 'center' },
  body: { fontSize: FONT_SIZE.base, lineHeight: 24, textAlign: 'center' },
  note: { fontSize: FONT_SIZE.sm, lineHeight: 20, textAlign: 'center' },
});
