/**
 * What a task screen shows when the task it was opened for is in Recently deleted (a link or a
 * screen left on the back stack from before it was deleted). It never lets the person log into
 * or edit a deleted task: it says so, and offers Restore or a way to Recently deleted.
 */
import { StyleSheet } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { useToastStore } from '@/app-shell/stores/toast';
import { ROUTES } from '@/navigation';
import { useRestoreTask } from '@/queries';
import { FONT_SIZE, SPACE, useTheme } from '@/theme';
import type { Id } from '@/types';
import { Button, Screen } from '@/ui';
import { Text } from '@/ui/AppText';

export const DELETED_NOTICE_COPY = {
  title: 'Deleted',
  headline: (name: string) => `"${name}" was deleted.`,
  body: 'It is in Recently deleted, with its history. Restore it to use it again.',
  restore: 'Restore',
  open: 'Open Recently deleted',
  restoredToast: (name: string) => `Restored "${name}".`,
  failed: "Couldn't do that. Try again.",
} as const;

export const GONE_NOTICE_COPY = {
  title: 'Not found',
  headline: "This isn't here any more.",
  body: 'It was deleted forever, so there is nothing to open.',
  today: 'Go to Today',
} as const;

/** The task a link or an old screen points at no longer exists at all (deleted for good). */
export function GoneTaskNotice({ onBack }: { readonly onBack: () => void }) {
  const t = useTheme();
  const router = useRouter();
  return (
    <Screen title={GONE_NOTICE_COPY.title} onBack={onBack}>
      <Text testID="task-gone-notice" style={[styles.headline, { color: t.color.text }]}>
        {GONE_NOTICE_COPY.headline}
      </Text>
      <Text style={[styles.body, { color: t.color.textMuted }]}>{GONE_NOTICE_COPY.body}</Text>
      <Button label={GONE_NOTICE_COPY.today} variant="secondary" onPress={() => router.dismissTo(ROUTES.today as Href)} fullWidth />
    </Screen>
  );
}

export function DeletedTaskNotice({ taskId, name, onBack }: { readonly taskId: Id; readonly name: string; readonly onBack: () => void }) {
  const t = useTheme();
  const router = useRouter();
  const showToast = useToastStore((s) => s.show);
  const restore = useRestoreTask();

  async function onRestore() {
    if (restore.isPending) return;
    const result = await restore.mutateAsync(taskId).catch(() => ({ ok: false as const }));
    showToast(result.ok ? DELETED_NOTICE_COPY.restoredToast(name) : DELETED_NOTICE_COPY.failed, result.ok ? 'success' : 'warning');
  }

  return (
    <Screen title={DELETED_NOTICE_COPY.title} onBack={onBack}>
      <Text testID="task-deleted-notice" style={[styles.headline, { color: t.color.text }]}>
        {DELETED_NOTICE_COPY.headline(name)}
      </Text>
      <Text style={[styles.body, { color: t.color.textMuted }]}>{DELETED_NOTICE_COPY.body}</Text>
      <Button label={DELETED_NOTICE_COPY.restore} onPress={() => void onRestore()} loading={restore.isPending} fullWidth />
      <Button label={DELETED_NOTICE_COPY.open} variant="secondary" onPress={() => router.push(ROUTES.settingsRecentlyDeleted as Href)} fullWidth />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headline: { fontSize: FONT_SIZE.lg, fontWeight: '600', lineHeight: 26 },
  body: { fontSize: FONT_SIZE.sm, lineHeight: 20, marginBottom: SPACE.s1 },
});
