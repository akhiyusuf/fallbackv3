/**
 * S34 — Assistant Conversation History    route: /assistant/history
 * Owner: M6. Features: F16.
 * Spec: design-input/fallback-handoff/uploads/ALLSCREENS_1.md (S34)
 */
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { MessageCircle } from 'lucide-react-native';
import { useRouter, type Href } from 'expo-router';
import { format } from 'date-fns';

import { AssistantHeader } from '@/features/assistant/AssistantHeader';
import { S34_COPY } from '@/features/assistant/copy';
import { useConversations } from '@/queries';
import { SPACE, useTheme } from '@/theme';
import { Badge, Card, EmptyState, InlineRetryBanner, Skeleton, Tag } from '@/ui';

function modalityLabel(m: 'voice' | 'text' | 'voice+text'): string {
  return m === 'voice' ? 'Voice' : m === 'text' ? 'Text' : 'Voice + text';
}

function dateTimeLabel(iso: string): string {
  return format(new Date(iso), "MMM d, h:mm a");
}

export default function S34AssistantConversationHistory() {
  const t = useTheme();
  const router = useRouter();
  const conversationsQuery = useConversations();

  function handleBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/assistant' as Href);
  }

  return (
    <View style={[styles.root, { backgroundColor: t.color.bg }]}>
      <AssistantHeader title={S34_COPY.title} onBack={handleBack} />

      {conversationsQuery.isLoading ? (
        <View style={styles.list}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={72} />
          ))}
        </View>
      ) : conversationsQuery.isError ? (
        <View style={styles.list}>
          <InlineRetryBanner message={S34_COPY.error} onRetry={() => conversationsQuery.refetch()} retryLabel={S34_COPY.retry} />
        </View>
      ) : conversationsQuery.data && conversationsQuery.data.length > 0 ? (
        <ScrollView contentContainerStyle={styles.list}>
          {conversationsQuery.data.map((c) => (
            <Card
              key={c.id}
              onPress={() => router.push(`/assistant/history/${c.id}` as Href)}
              accessibilityLabel={`${dateTimeLabel(c.startedAt)}, ${modalityLabel(c.modality)}, ${c.summary}, ${c.taskIdsTouched.length} tasks, button — opens conversation.`}
            >
              <View style={styles.row}>
                <Text style={[styles.dateTime, { color: t.color.text }]}>{dateTimeLabel(c.startedAt)}</Text>
                <Tag label={modalityLabel(c.modality)} />
              </View>
              <Text style={[styles.summary, { color: t.color.textMuted }]}>{c.summary}</Text>
              <Badge label={`${c.taskIdsTouched.length} task${c.taskIdsTouched.length === 1 ? '' : 's'}`} />
            </Card>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.list}>
          <EmptyState icon={MessageCircle} headline={S34_COPY.emptyHeadline} subcopy={S34_COPY.emptySubcopy} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: { padding: SPACE.s3, gap: SPACE.s2 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateTime: { fontSize: 15, fontWeight: '600' },
  summary: { fontSize: 14, lineHeight: 20 },
});
