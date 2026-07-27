/**
 * S31 — Assistant Home    route: /assistant
 * Owner: M6. Features: F16.
 * Spec: design-input/fallback-handoff/uploads/ALLSCREENS_1.md (S31)
 */
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ArrowUp, Mic } from 'lucide-react-native';
import { useRouter, type Href } from 'expo-router';

import { AssistantHeader } from '@/features/assistant/AssistantHeader';
import { S31_COPY } from '@/features/assistant/copy';
import { useEntitlementAndMic } from '@/features/assistant/useEntitlementAndMic';
import { SPACE, useTheme } from '@/theme';
import { Input, IconButton, InlineRetryBanner, Skeleton } from '@/ui';

export default function S31AssistantHome() {
  const t = useTheme();
  const router = useRouter();
  const { loading, error, isEntitled, micGranted, retry } = useEntitlementAndMic();
  const [text, setText] = useState('');

  function goToConversation(opening?: string, listenImmediately = false) {
    const qs = new URLSearchParams({ opening: opening ?? '', listen: listenImmediately ? '1' : '' }).toString();
    router.push(`/assistant/chat?${qs}` as Href);
  }

  function handleMicPress() {
    if (!isEntitled) {
      router.push('/assistant/paywall' as Href);
      return;
    }
    if (!micGranted) {
      router.push('/assistant/mic-primer?context=primer' as Href);
      return;
    }
    goToConversation(undefined, true);
  }

  function handleChipPress(chip: string) {
    if (!isEntitled) {
      router.push('/assistant/paywall' as Href);
      return;
    }
    goToConversation(chip, false);
  }

  function handleSend() {
    if (!text.trim()) return;
    if (!isEntitled) {
      router.push('/assistant/paywall' as Href);
      return;
    }
    goToConversation(text, false);
  }

  return (
    <View style={[styles.root, { backgroundColor: t.color.bg }]}>
      <AssistantHeader onBack={() => router.replace('/today' as Href)} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {error ? (
          <InlineRetryBanner message={S31_COPY.error} onRetry={retry} retryLabel={S31_COPY.retry} />
        ) : (
          <>
            <Text style={[styles.eyebrow, { color: t.color.textMuted }]}>{S31_COPY.eyebrow}</Text>
            {loading ? (
              <>
                <Skeleton width="80%" height={28} />
                <Skeleton width="60%" height={18} style={styles.gapTop} />
              </>
            ) : (
              <>
                <Text accessibilityRole="header" style={[styles.headline, { color: t.color.text }]}>
                  {S31_COPY.headline}
                </Text>
                <Text style={[styles.subcopy, { color: t.color.textMuted }]}>{S31_COPY.subcopy}</Text>
              </>
            )}

            <View style={styles.micWrap}>
              {loading ? (
                <Skeleton width={72} height={72} radius={36} />
              ) : (
                <IconButton
                  icon={Mic}
                  onPress={handleMicPress}
                  variant="accent"
                  size={30}
                  accessibilityLabel="Speak to Fallback AI, button"
                  testID="s31-mic"
                />
              )}
              <Text style={[styles.micCaption, { color: t.color.textDim }]}>{S31_COPY.micCaption}</Text>
            </View>

            <View style={styles.chips}>
              {loading
                ? [0, 1, 2, 3, 4].map((i) => <Skeleton key={i} width="45%" height={36} radius={18} />)
                : S31_COPY.chips.map((chip) => (
                    <ChipButton key={chip} label={chip} onPress={() => handleChipPress(chip)} />
                  ))}
            </View>
          </>
        )}
      </ScrollView>

      {!error && !loading ? (
        <View style={[styles.footer, { borderTopColor: t.color.border }]}>
          <View style={styles.footerInputWrap}>
            <Input
              label=""
              value={text}
              onChangeText={setText}
              placeholder={S31_COPY.inputPlaceholder}
              accessibilityLabel="Type your request"
              testID="s31-input"
            />
          </View>
          <IconButton
            icon={ArrowUp}
            onPress={handleSend}
            disabled={text.trim().length === 0}
            variant="accent"
            accessibilityLabel="Send"
            testID="s31-send"
          />
        </View>
      ) : null}
    </View>
  );
}

function ChipButton({ label, onPress }: { readonly label: string; readonly onPress: () => void }) {
  const t = useTheme();
  return (
    <Text
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Suggestion: ${label}, button`}
      style={[styles.chip, { backgroundColor: t.color.surface, color: t.color.text, borderColor: t.color.border }]}
    >
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: SPACE.s3, gap: SPACE.s2 },
  eyebrow: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  headline: { fontSize: 26, fontWeight: '800', lineHeight: 32 },
  subcopy: { fontSize: 16, lineHeight: 22 },
  gapTop: { marginTop: SPACE.s1 },
  micWrap: { alignItems: 'center', gap: SPACE.s1, paddingVertical: SPACE.s4 },
  micCaption: { fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.s1 },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: SPACE.s1,
    paddingHorizontal: SPACE.s2,
    fontSize: 14,
    fontWeight: '600',
    overflow: 'hidden',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.s1,
    borderTopWidth: 1,
    padding: SPACE.s2,
  },
  footerInputWrap: { flex: 1 },
});
