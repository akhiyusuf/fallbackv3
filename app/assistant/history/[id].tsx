/** S35 — A reopened conversation    route: /assistant/history/[id] */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ArrowUp, Mic } from 'lucide-react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { format } from 'date-fns';

import { TranscriptBubble } from '@/features/assistant/TranscriptBubble';
import { S35_COPY } from '@/features/assistant/copy';
import { taskIconProps } from '@/features/browse/resolveIcon';
import { listMessages } from '@/services/ai';
import { useConversation, useTasks } from '@/queries';
import type { AssistantMessage, Id } from '@/types';
import { SPACE } from '@/theme';
import { IconButton, InlineRetryBanner, Input, ListGroup, ListRow, Screen, Skeleton, TaskIcon } from '@/ui';

function modalityLabel(m: 'voice' | 'text' | 'voice+text'): string {
  return m === 'voice' ? 'Voice' : m === 'text' ? 'Text' : 'Voice + text';
}

export default function S35AssistantReopenedConversation() {
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
      setMessages(await listMessages(id as Id));
    } catch {
      setMessagesError(true);
    }
  }

  useEffect(() => {
    void loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function handleContinue(listen = false) {
    const qs = new URLSearchParams({ opening: continueText, listen: listen ? '1' : '', continueId: id ?? '' }).toString();
    router.push(`/assistant/chat?${qs}` as Href);
  }

  const conversation = conversationQuery.data;
  const touchedTasks = conversation ? (tasksQuery.data?.filter((t2) => conversation.taskIdsTouched.includes(t2.id)) ?? []) : [];

  return (
    <Screen
      title={conversation ? format(new Date(conversation.startedAt), 'MMM d, h:mm a') : 'Conversation'}
      subtitle={conversation ? modalityLabel(conversation.modality) : undefined}
      level="page"
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/assistant/history' as Href))}
      footer={
        <View style={styles.footerRow}>
          <IconButton icon={Mic} onPress={() => handleContinue(true)} accessibilityLabel="Continue by voice" />
          <View style={styles.flex}>
            <Input label="" value={continueText} onChangeText={setContinueText} placeholder={S35_COPY.continuePlaceholder} accessibilityLabel={S35_COPY.continuePlaceholder} onSubmitEditing={() => handleContinue(false)} />
          </View>
          <IconButton icon={ArrowUp} onPress={() => handleContinue(false)} disabled={continueText.trim().length === 0} variant="accent" accessibilityLabel="Send" />
        </View>
      }
    >
      {conversationQuery.isLoading || (messages === null && !messagesError) ? (
        [0, 1, 2].map((i) => <Skeleton key={i} height={48} />)
      ) : conversationQuery.isError || messagesError || messages === null ? (
        <InlineRetryBanner
          message={S35_COPY.error}
          onRetry={() => {
            void conversationQuery.refetch();
            void loadMessages();
          }}
          retryLabel={S35_COPY.retry}
        />
      ) : (
        <>
          <View style={styles.transcript}>
            {messages.map((m) => (
              <TranscriptBubble key={m.id} role={m.role} text={m.text} />
            ))}
          </View>
          {touchedTasks.length > 0 ? (
            <ListGroup title={S35_COPY.tasksCreatedLabel}>
              {touchedTasks.map((task) => (
                <ListRow key={task.id} leading={<TaskIcon {...taskIconProps(task)} size={32} />} label={task.name} onPress={() => router.push(`/task/${task.id}` as Href)} />
              ))}
            </ListGroup>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  transcript: { gap: SPACE.s2 + 4 },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 },
});
