/** S31 — Assistant home    route: /assistant */
import { play } from '@/services/sfx';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ArrowUp } from 'lucide-react-native';
import { useRouter, type Href } from 'expo-router';

import { S31_COPY } from '@/features/assistant/copy';
import { useEntitlementAndMic } from '@/features/assistant/useEntitlementAndMic';
import { FONT_SIZE, RADIUS, SPACE, useTheme } from '@/theme';
import { IconButton, InlineRetryBanner, Input, Screen, SectionHeading, Skeleton, VoiceMark } from '@/ui';
import { Text } from '@/ui/AppText';
import { markInAppOpening } from '@/features/assistant/inAppOpening';

export default function S31AssistantHome() {
  const t = useTheme();
  const router = useRouter();
  const { loading, error, isEntitled, micGranted, retry } = useEntitlementAndMic();
  const [text, setText] = useState('');

  function goToConversation(opening?: string, listenImmediately = false) {
    // Sent straight away on arrival because it comes from a button here, not from a link.
    if (opening) markInAppOpening(opening);
    const qs = new URLSearchParams({ opening: opening ?? '', listen: listenImmediately ? '1' : '' }).toString();
    router.push(`/assistant/chat?${qs}` as Href);
  }

  function handleMicPress() {
    if (!isEntitled) return router.push('/assistant/paywall' as Href);
    if (!micGranted) return router.push('/assistant/mic-primer?context=primer' as Href);
    play('ai_start');
    goToConversation(undefined, true);
  }

  function handleSuggestion(chip: string) {
    if (!isEntitled) return router.push('/assistant/paywall' as Href);
    goToConversation(chip, false);
  }

  function handleSend() {
    if (!text.trim()) return;
    if (!isEntitled) return router.push('/assistant/paywall' as Href);
    goToConversation(text, false);
  }

  return (
    <Screen
      title={S31_COPY.title}
      level="page"
      onBack={() => router.replace('/today' as Href)}
      footer={
        !error && !loading ? (
          <View style={styles.footerRow}>
            <View style={styles.flex}>
              <Input label="" value={text} onChangeText={setText} placeholder={S31_COPY.inputPlaceholder} accessibilityLabel="Type your request" onSubmitEditing={handleSend} testID="s31-input" />
            </View>
            <IconButton icon={ArrowUp} onPress={handleSend} disabled={text.trim().length === 0} variant="accent" accessibilityLabel="Send" testID="s31-send" />
          </View>
        ) : undefined
      }
    >
      {error ? (
        <InlineRetryBanner message={S31_COPY.error} onRetry={retry} retryLabel={S31_COPY.retry} />
      ) : loading ? (
        <>
          <Skeleton width="80%" height={28} />
          <Skeleton width="60%" height={18} />
          <Skeleton height={200} />
        </>
      ) : (
        <>
          <View style={styles.hero}>
            <Text accessibilityRole="header" style={[styles.headline, { color: t.color.text }]}>
              {S31_COPY.headline}
            </Text>
            <Text style={[styles.subcopy, { color: t.color.textMuted }]}>{S31_COPY.subcopy}</Text>
            <Pressable
              onPress={handleMicPress}
              accessibilityRole="button"
              accessibilityLabel="Speak to Fallback AI"
              testID="s31-mic"
              style={({ pressed }) => [styles.orb, { backgroundColor: t.accent.soft, transform: [{ scale: pressed ? 0.96 : 1 }] }]}
            >
              <VoiceMark size={128} live />
            </Pressable>
            <Text style={[styles.caption, { color: t.color.textMuted }]}>{S31_COPY.micCaption}</Text>
          </View>

          <View style={styles.suggest}>
            <SectionHeading>{S31_COPY.suggestionsHeading}</SectionHeading>
            <View style={styles.chips}>
              {S31_COPY.chips.map((chip) => (
                <Pressable
                  key={chip}
                  onPress={() => handleSuggestion(chip)}
                  accessibilityRole="button"
                  accessibilityLabel={`Suggestion: ${chip}`}
                  style={({ pressed }) => [styles.chip, { backgroundColor: t.color.bgAlt, borderColor: pressed ? t.accent.text : t.color.border }]}
                >
                  <Text style={[styles.chipLabel, { color: t.color.text }]}>{chip}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { alignItems: 'center', gap: SPACE.s2, paddingTop: SPACE.s3, paddingBottom: SPACE.s2 },
  headline: { fontSize: FONT_SIZE.xl, fontWeight: '800', lineHeight: 30, textAlign: 'center' },
  subcopy: { fontSize: FONT_SIZE.base, lineHeight: 24, textAlign: 'center' },
  orb: { width: 176, height: 176, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center', marginTop: SPACE.s3 },
  suggest: { gap: SPACE.s2 + 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.s2 },
  chip: { minHeight: 44, justifyContent: 'center', borderRadius: RADIUS.pill, borderWidth: 2, borderBottomWidth: 4, paddingHorizontal: SPACE.s3 },
  chipLabel: { fontSize: FONT_SIZE.sm, fontWeight: '700' },
  caption: { fontSize: FONT_SIZE.sm, textAlign: 'center' },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 },
});
