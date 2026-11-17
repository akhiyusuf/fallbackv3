/**
 * S32 — Assistant Conversation    route: /assistant/chat
 * Owner: M6. Features: F16.
 * Spec: design-input/fallback-handoff/uploads/ALLSCREENS_1.md (S32)
 */
import { play } from '@/services/sfx';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { format } from 'date-fns';
import { ArrowUp, Keyboard, Mic, MoreHorizontal } from 'lucide-react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { getRecordingPermissionsAsync } from 'expo-audio';

import { ClarificationModal } from '@/features/assistant/ClarificationModal';
import { OptionsSheet } from '@/features/assistant/OptionsSheet';
import { EditUndoBanner } from '@/features/assistant/EditUndoBanner';
import { TaskCreatedCard } from '@/features/assistant/TaskCreatedCard';
import { TranscriptBubble } from '@/features/assistant/TranscriptBubble';
import { S36_COPY, S32_COPY } from '@/features/assistant/copy';
import { useAssistantChat } from '@/features/assistant/useAssistantChat';
import { useVoiceLanguagePrefs } from '@/features/assistant/voiceLanguagePrefs';
import { useEntitlementStore, useToastStore } from '@/app-shell';
import { billing } from '@/services/billing';
import { parseLocalDate } from '@/lib/date';
import type { Id } from '@/types';
import { FONT_SIZE, SPACE, useTheme } from '@/theme';
import { Button, Dialog, IconButton, Input, InlineRetryBanner, Screen, Skeleton } from '@/ui';
import { Text } from '@/ui/AppText';

export default function S32AssistantConversation() {
  const t = useTheme();
  const router = useRouter();
  const showToast = useToastStore((s) => s.show);
  // Architect CR-6: S36's voice/language selection now persists to `settings` (migration 4)
  // through the ordinary `@/queries` surface, instead of process-lifetime module state.
  const voiceLanguage = useVoiceLanguagePrefs();
  const entitlement = useEntitlementStore((s) => s.entitlement);
  const params = useLocalSearchParams<{ opening?: string; listen?: string; continueId?: string }>();
  const {
    items,
    isStreaming,
    offline,
    clarification,
    sendMessage,
    resolveClarification,
    dismissClarification,
    retryLast,
    recap,
  } = useAssistantChat({
    initialModality: params.listen === '1' ? 'voice' : 'text',
    // B9 — S35's "continue" passes `continueId`; forward it so the SAME conversation thread
    // (and its prior history) resumes instead of silently starting a new one.
    conversationId: params.continueId ? (params.continueId as Id) : undefined,
    // B4 — an entitlement error mid-chat routes to the paywall, never the offline footer.
    onEntitlementError: () => router.push('/assistant/paywall' as Href),
  });

  const [modality, setModality] = useState<'voice' | 'text'>(params.listen === '1' ? 'voice' : 'text');
  const [text, setText] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [showRecap, setShowRecap] = useState(false);
  const [subtitleLoaded, setSubtitleLoaded] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const sentOpeningRef = useRef(false);

  // B2 — S36's Manage-subscription subtitle must reflect REAL entitlement data, fetched
  // async (Skeleton while loading — `OptionsSheet` already renders one for `null`), never
  // the hardcoded spec-fixture string.
  useEffect(() => {
    let alive = true;
    void billing.refreshEntitlement().finally(() => {
      if (alive) setSubtitleLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const subscriptionSubtitle = !subtitleLoaded
    ? null
    : entitlement.status === 'active' || entitlement.status === 'trial'
      ? `Fallback AI · ${entitlement.renewsOn ? `renews ${format(parseLocalDate(entitlement.renewsOn), 'MMM d')}` : 'active'}`
      : 'Fallback AI · Free plan';

  async function handleSaveVoiceLanguage(language: string, voice: string): Promise<boolean> {
    // Only claim "Saved" if the write actually landed — same rule as every other mutation
    // caller (docs/API.md §3: a mutation never reports success on a failed write). The
    // returned flag also tells `OptionsSheet` whether to keep its optimistic override.
    const saved = await voiceLanguage.save({ language, voice });
    showToast(saved ? S36_COPY.savedToast : 'Could not save that. Try again.', saved ? 'success' : 'warning');
    return saved;
  }

  useEffect(() => {
    if (params.opening && !sentOpeningRef.current) {
      sentOpeningRef.current = true;
      void sendMessage(params.opening);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.opening]);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [items.length, isStreaming]);

  function handleDoneRecap() {
    if (router.canGoBack()) router.back();
    else router.replace('/assistant' as Href);
  }

  function handleSend() {
    if (!text.trim()) return;
    void sendMessage(text);
    setText('');
  }

  async function handleMicToggle() {
    if (modality === 'voice') {
      play('ai_stop');
      setModality('text');
      return;
    }
    // B11 — permission IS re-verified here (not trusted from S31's snapshot): spec — "tapping
    // the mic toggle while the OS mic permission is off ... navigates to S37, recovery".
    const status = await getRecordingPermissionsAsync();
    if (!status.granted) {
      router.push('/assistant/mic-primer?context=recovery' as Href);
      return;
    }
    play('ai_start');
    setModality('voice');
    // Honest disclosure of what's still stubbed: the native record → transcribe → send loop
    // itself (driving `expo-audio`'s recorder against real hardware) is legitimately
    // untestable under Jest and is not wired here — this toggle only switches the footer's
    // visual modality state. That capture loop is the one seam left behind this comment.
  }

  const recapEmpty = recap.taskCards.length === 0 && recap.editBanners.length === 0;

  function handleBack() {
    if (recapEmpty) handleDoneRecap();
    else setShowRecap(true);
  }

  return (
    <Screen
      title="Fallback AI"
      subtitle={modality === 'voice' ? 'Voice' : 'Typing'}
      level="page"
      onBack={handleBack}
      right={<IconButton icon={MoreHorizontal} onPress={() => setShowOptions(true)} accessibilityLabel="More options" />}
      scroll={false}
      contentStyle={styles.noPad}
      footer={
        offline ? (
          <>
            <InlineRetryBanner message={S32_COPY.offline} onRetry={retryLast} retryLabel={S32_COPY.tryAgain} tone="warning" />
            <Button label={S32_COPY.addTaskManually} onPress={() => router.replace('/add' as Href)} variant="secondary" accessibilityLabel={S32_COPY.addTaskManually} fullWidth />
          </>
        ) : (
          <View style={styles.footerRow}>
            <IconButton icon={modality === 'voice' ? Keyboard : Mic} onPress={handleMicToggle} accessibilityLabel={modality === 'voice' ? 'Switch to typing' : 'Switch to voice'} />
            {modality === 'voice' ? (
              <Text style={[styles.listeningLabel, { color: t.color.textMuted }]} accessibilityLiveRegion="polite">
                {S32_COPY.listening}
              </Text>
            ) : (
              <>
                <View style={styles.flex}>
                  <Input label="" value={text} onChangeText={setText} placeholder={S32_COPY.inputPlaceholder} accessibilityLabel="Type your request" onSubmitEditing={handleSend} />
                </View>
                <IconButton icon={ArrowUp} onPress={handleSend} disabled={text.trim().length === 0} variant="accent" accessibilityLabel="Send" />
              </>
            )}
          </View>
        )
      }
    >
      <ScrollView alwaysBounceVertical={false} overScrollMode="auto" ref={scrollRef} style={styles.flex} contentContainerStyle={styles.transcript} accessibilityLiveRegion="polite" showsVerticalScrollIndicator={false}>
        {items.length === 0 && !isStreaming ? <Text style={[styles.hint, { color: t.color.textMuted }]}>{S32_COPY.emptyHint}</Text> : null}
        {items.map((item) => {
          if (item.kind === 'user' || item.kind === 'assistant') return <TranscriptBubble key={item.id} role={item.kind} text={item.text} />;
          if (item.kind === 'task-card') return <TaskCreatedCard key={item.id} task={item.task} />;
          return <EditUndoBanner key={item.id} label={item.label} onUndo={item.onUndo} undone={item.undone} />;
        })}
        {isStreaming ? (
          <View accessibilityLabel="Fallback AI is thinking">
            <Skeleton width="60%" height={44} radius={16} />
          </View>
        ) : null}
      </ScrollView>

      <Dialog visible={showRecap} onClose={() => setShowRecap(false)} title={S32_COPY.recapHeadline} accessibilityLabel={S32_COPY.recapHeadline}>
        {recap.taskCards.map((c) => (
          <TaskCreatedCard key={c.id} task={c.task} />
        ))}
        {recap.editBanners.map((b) => (
          <EditUndoBanner key={b.id} label={b.label} onUndo={() => undefined} undone />
        ))}
        <Text style={[styles.hint, { color: t.color.textMuted }]}>{S32_COPY.recapFooter}</Text>
        <Button label={S32_COPY.recapDone} onPress={handleDoneRecap} accessibilityLabel={S32_COPY.recapDone} fullWidth />
      </Dialog>

      <ClarificationModal
        visible={!!clarification}
        question={clarification?.question ?? ''}
        options={clarification?.options.map((o) => ({ taskId: o.taskId, label: o.label })) ?? []}
        onResolve={(taskId) => resolveClarification(taskId as never)}
        onDismiss={dismissClarification}
      />

      <OptionsSheet
        visible={showOptions}
        onClose={() => setShowOptions(false)}
        onNewConversation={() => {
          setShowOptions(false);
          router.replace('/assistant/chat' as Href);
        }}
        onConversationHistory={() => {
          setShowOptions(false);
          router.push('/assistant/history' as Href);
        }}
        onManageSubscription={() => {
          setShowOptions(false);
          router.push('/settings/subscription' as Href);
        }}
        onAccountAndSync={() => {
          setShowOptions(false);
          router.push('/settings/sync' as Href);
        }}
        onHelp={() => {
          setShowOptions(false);
          router.push('/settings/help' as Href);
        }}
        subscriptionSubtitle={subscriptionSubtitle}
        voiceLanguage={voiceLanguage.prefs}
        onSaveVoiceLanguage={handleSaveVoiceLanguage}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  noPad: { paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 },
  transcript: { paddingHorizontal: SPACE.s3, paddingTop: SPACE.s2, paddingBottom: SPACE.s4, gap: SPACE.s2 + 4 },
  hint: { fontSize: FONT_SIZE.sm, lineHeight: 20 },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 },
  listeningLabel: { fontSize: FONT_SIZE.base, flex: 1 },
});
