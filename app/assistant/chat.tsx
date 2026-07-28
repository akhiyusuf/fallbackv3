/**
 * S32 — Assistant Conversation    route: /assistant/chat
 * Owner: M6. Features: F16.
 * Spec: design-input/fallback-handoff/uploads/ALLSCREENS_1.md (S32)
 */
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { format } from 'date-fns';
import { ArrowUp, Keyboard, Mic, MoreHorizontal, Sparkles, X } from 'lucide-react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { getRecordingPermissionsAsync } from 'expo-audio';

import { AssistantHeader } from '@/features/assistant/AssistantHeader';
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
import { SPACE, useTheme } from '@/theme';
import { Button, Card, IconButton, Input, InlineRetryBanner, Skeleton } from '@/ui';

export default function S32AssistantConversation() {
  const t = useTheme();
  const router = useRouter();
  const showToast = useToastStore((s) => s.show);
  // Architect CR-2: S36's voice/language selection now persists to `settings` (migration 4)
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

  async function handleSaveVoiceLanguage(language: string, voice: string) {
    // Only claim "Saved" if the write actually landed — same rule as every other mutation
    // caller (docs/API.md §3: a mutation never reports success on a failed write).
    const saved = await voiceLanguage.save({ language, voice });
    showToast(saved ? S36_COPY.savedToast : 'Could not save that — try again.', saved ? 'success' : 'warning');
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

  function handleClose() {
    setShowRecap(true);
  }

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
    setModality('voice');
    // Honest disclosure of what's still stubbed: the native record → transcribe → send loop
    // itself (driving `expo-audio`'s recorder against real hardware) is legitimately
    // untestable under Jest and is not wired here — this toggle only switches the footer's
    // visual modality state. That capture loop is the one seam left behind this comment.
  }

  if (showRecap) {
    return (
      <View style={[styles.root, { backgroundColor: t.color.bg }]}>
        <View style={styles.recap}>
          <Text accessibilityRole="header" style={[styles.recapHeadline, { color: t.color.text }]}>
            {S32_COPY.recapHeadline}
          </Text>
          <ScrollView contentContainerStyle={styles.recapList}>
            {recap.taskCards.map((c) => (
              <TaskCreatedCard key={c.id} task={c.task} />
            ))}
            {recap.editBanners.map((b) => (
              <Card key={b.id} accessibilityLabel={b.label}>
                <Text style={{ color: t.color.text }}>{b.label}</Text>
              </Card>
            ))}
            {recap.taskCards.length === 0 && recap.editBanners.length === 0 ? (
              <Text style={{ color: t.color.textMuted }}>Nothing changed in this chat.</Text>
            ) : null}
          </ScrollView>
          <Text style={[styles.recapFooter, { color: t.color.textMuted }]}>{S32_COPY.recapFooter}</Text>
          <Button label={S32_COPY.recapDone} onPress={handleDoneRecap} accessibilityLabel={S32_COPY.recapDone} fullWidth />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: t.color.bg }]}>
      <View style={styles.header}>
        <IconButton icon={X} onPress={handleClose} accessibilityLabel="Close" />
        <View style={styles.modalityIndicator}>
          {modality === 'voice' ? <Mic size={16} color={t.color.textMuted} /> : <Keyboard size={16} color={t.color.textMuted} />}
          <Sparkles size={14} color={t.accent.base} />
          <Text style={[styles.wordmark, { color: t.color.textMuted }]}>Fallback AI</Text>
        </View>
        <IconButton icon={MoreHorizontal} onPress={() => setShowOptions(true)} accessibilityLabel="More options" />
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.transcript} accessibilityLiveRegion="polite">
        {items.map((item) => {
          if (item.kind === 'user' || item.kind === 'assistant') {
            return <TranscriptBubble key={item.id} role={item.kind} text={item.text} />;
          }
          if (item.kind === 'task-card') {
            return <TaskCreatedCard key={item.id} task={item.task} />;
          }
          return <EditUndoBanner key={item.id} label={item.label} onUndo={item.onUndo} undone={item.undone} />;
        })}
        {isStreaming ? (
          <View accessibilityLabel="Fallback AI is thinking">
            <Skeleton width="60%" height={44} radius={16} />
          </View>
        ) : null}
      </ScrollView>

      {offline ? (
        <View style={styles.offlineFooter}>
          <InlineRetryBanner message={S32_COPY.offline} onRetry={retryLast} retryLabel={S32_COPY.tryAgain} tone="warning" />
          <Button
            label={S32_COPY.addTaskManually}
            onPress={() => router.replace('/add' as Href)}
            variant="secondary"
            accessibilityLabel={S32_COPY.addTaskManually}
          />
        </View>
      ) : (
        <View style={[styles.footer, { borderTopColor: t.color.border }]}>
          <IconButton
            icon={modality === 'voice' ? Keyboard : Mic}
            onPress={handleMicToggle}
            accessibilityLabel={modality === 'voice' ? 'Switch to typing' : 'Switch to voice'}
          />
          {modality === 'voice' ? (
            <Text style={[styles.listeningLabel, { color: t.color.textMuted }]} accessibilityLiveRegion="polite">
              {S32_COPY.listening}
            </Text>
          ) : (
            <>
              <View style={styles.inputWrap}>
                <Input label="" value={text} onChangeText={setText} placeholder={S32_COPY.inputPlaceholder} accessibilityLabel="Type your request" />
              </View>
              <IconButton icon={ArrowUp} onPress={handleSend} disabled={text.trim().length === 0} variant="accent" accessibilityLabel="Send" />
            </>
          )}
        </View>
      )}

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
        onSaveVoiceLanguage={(language, voice) => void handleSaveVoiceLanguage(language, voice)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACE.s2 },
  modalityIndicator: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s1 },
  wordmark: { fontSize: 13, fontWeight: '600' },
  transcript: { padding: SPACE.s3, gap: SPACE.s2 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s1, borderTopWidth: 1, padding: SPACE.s2 },
  inputWrap: { flex: 1 },
  listeningLabel: { fontSize: 15, flex: 1 },
  offlineFooter: { padding: SPACE.s2, gap: SPACE.s2 },
  recap: { flex: 1, padding: SPACE.s3, gap: SPACE.s3 },
  recapHeadline: { fontSize: 22, fontWeight: '800' },
  recapList: { gap: SPACE.s2 },
  recapFooter: { fontSize: 14, lineHeight: 20 },
});
