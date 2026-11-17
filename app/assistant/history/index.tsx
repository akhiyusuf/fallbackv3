/** S34 — Conversation history    route: /assistant/history */
import { MessageCircle } from 'lucide-react-native';
import { useRouter, type Href } from 'expo-router';
import { format } from 'date-fns';

import { S34_COPY } from '@/features/assistant/copy';
import { useConversations } from '@/queries';
import { EmptyState, InlineRetryBanner, ListGroup, ListRow, Screen, Skeleton } from '@/ui';

function modalityLabel(m: 'voice' | 'text' | 'voice+text'): string {
  return m === 'voice' ? 'Voice' : m === 'text' ? 'Text' : 'Voice and text';
}

export default function S34AssistantConversationHistory() {
  const router = useRouter();
  const conversationsQuery = useConversations();
  const conversations = conversationsQuery.data ?? [];

  return (
    <Screen title={S34_COPY.title} level="page" onBack={() => (router.canGoBack() ? router.back() : router.replace('/assistant' as Href))}>
      {conversationsQuery.isLoading ? (
        [0, 1, 2].map((i) => <Skeleton key={i} height={64} />)
      ) : conversationsQuery.isError ? (
        <InlineRetryBanner message={S34_COPY.error} onRetry={() => conversationsQuery.refetch()} retryLabel={S34_COPY.retry} />
      ) : conversations.length > 0 ? (
        <ListGroup>
          {conversations.map((c) => {
            const meta = [format(new Date(c.startedAt), 'MMM d, h:mm a'), modalityLabel(c.modality), `${c.taskIdsTouched.length} task${c.taskIdsTouched.length === 1 ? '' : 's'}`].join(' · ');
            return <ListRow key={c.id} icon={MessageCircle} label={c.summary} sublabel={meta} onPress={() => router.push(`/assistant/history/${c.id}` as Href)} accessibilityLabel={`${c.summary}. ${meta}`} />;
          })}
        </ListGroup>
      ) : (
        <EmptyState icon={MessageCircle} headline={S34_COPY.emptyHeadline} subcopy={S34_COPY.emptySubcopy} actionLabel="Start a chat" onAction={() => router.replace('/assistant' as Href)} />
      )}
    </Screen>
  );
}
