/**
 * S35 — Assistant Reopened Conversation    route: /assistant/history/:id
 * Owner: M6. Features: F16.
 * Spec: design-input/fallback-handoff/uploads/ALLSCREENS_1.md (S35)
 */
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ArrowUp, Mic } from 'lucide-react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { format } from 'date-fns';

import { AssistantHeader } from '@/features/assistant/AssistantHeader';
import { TranscriptBubble } from '@/features/assistant/TranscriptBubble';
import { S35_COPY } from '@/features/assistant/copy';
import { listMessages } from '@/services/ai';
import { useConversation, useTasks } from '@/queries';
import type { AssistantMessage, Id } from '@/types';
import { SPACE, useTheme } from '@/theme';
import { Card, IconButton, Input, InlineRetryBanner, Skeleton, Tag } from '@/ui';

function modalityLabel(m: 'voice' | 'text' | 'voice+text'): string {
  return m === 'voice' ? 'Voice' : m === 'text' ? 'Text' : 'Voice + text';
}

export default function S35AssistantReopenedConversation() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const conversationQuery = useConversation(id as Id);
  const tasksQuery = useTasks();
  const [messages, setMessages] = useState<readonly AssistantMessage[] | null>(null);
  const [messagesError, setMessagesError] = useState(false);
  const [continueText, setContinueText] = useState('');

  async function loadMessages() {
    setMessagesError(false);
    try {
      const result = await listMessages(id as Id);
      setMessages(result);
    } catch {
      setMessagesError(true);
    }
  }

  useEffect(() => {
    void loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function handleBack() {
    router.push('/assistant/history' as Href);
  }

  function handleContinue(listen = false) {
    const qs = new URLSearchParams({ opening: continueText, listen: listen ? '1' : '', continueId: id ?? '' }).toString();
    router.push(`/assistant/chat?${qs}` as Href);
  }

  const conversation = conversationQuery.data;
  const touchedTasks = conversation ? tasksQuery.data?.filter((t2) => conversation.taskIdsTouched.includes(t2.id)) ?? [] : [];

  return (
    <View style={[styles.root, { backgroundColor: t.color.bg }]}>
      <AssistantHeader
        onBack={handleBack}
        title={conversation ? format(new Date(conversation.startedAt), "MMM d, h:mm a") : undefined}
        trailing={conversation ? <Tag label={modalityLabel(conversation.modality)} /> : undefined}
      />

      {conversationQuery.isLoading || messages === null ? (
        <View style={styles.content}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={48} />
          ))}
        </View>
      ) : conversationQuery.isError || messagesError ? (
        <View style={styles.content}>
          <InlineRetryBanner
            message={S35_COPY.error}
            onRetry={() => {
              void conversationQuery.refetch();
              void loadMessages();
            }}
            retryLabel={S35_COPY.retry}
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {messages.map((m) => (
            <TranscriptBubble key={m.id} role={m.role} text={m.text} />
          ))}
          {touchedTasks.length > 0 ? (
            <>
              <Text accessibilityRole="header" style={[styles.sectionLabel, { color: t.color.text }]}>
                {S35_COPY.tasksCreatedLabel}
              </Text>
              {touchedTasks.map((task) => (
                <Card key={task.id} accessibilityLabel={task.name}>
                  <Text style={{ color: t.color.text }}>{task.name}</Text>
                </Card>
              ))}
            </>
          ) : null}
        </ScrollView>
      )}

      <View style={[styles.footer, { borderTopColor: t.color.border }]}>
        <IconButton icon={Mic} onPress={() => handleContinue(true)} accessibilityLabel="Continue by voice" />
        <View style={styles.inputWrap}>
          <Input label="" value={continueText} onChangeText={setContinueText} placeholder={S35_COPY.continuePlaceholder} accessibilityLabel={S35_COPY.continuePlaceholder} />
        </View>
        <IconButton icon={ArrowUp} onPress={() => handleContinue(false)} disabled={continueText.trim().length === 0} variant="accent" accessibilityLabel="Send" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: SPACE.s3, gap: SPACE.s2 },
  sectionLabel: { fontSize: 15, fontWeight: '700', marginTop: SPACE.s2 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s1, borderTopWidth: 1, padding: SPACE.s2 },
  inputWrap: { flex: 1 },
});
