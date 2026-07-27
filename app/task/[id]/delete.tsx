/**
 * S22 — Delete Confirmation    route: /task/:id/delete
 * Owner: M4. Features: F7.
 * Spec: design-input/fallback-handoff/uploads/ALLSCREENS_1.md (S22)
 *
 * TWO SEPARATE origin rules (see `src/features/task/deleteOrigin.ts`'s header — do not merge):
 *  - "Keep it" / scrim / hardware back -> whichever screen opened S22 (S20 or S23). S22 is
 *    always reached by a push from one of those two, so `router.back()` already implements
 *    this correctly with no extra param.
 *  - Confirmed delete -> a DIFFERENT, two-level lookup through the ORIGIN of whichever screen
 *    opened S22 (`confirmedDeleteDestination`), never S22's own opener.
 *
 * Query params (set by S20/S23, this module's own routes): `openedFrom` ('manage' | 'as-needed'),
 * `origin` (the opener's own `from` value, only consulted for the 'manage' path).
 */
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AlertCircle } from 'lucide-react-native';

import { SPACE, useTheme } from '@/theme';
import { Button, InlineRetryBanner } from '@/ui';
import { useDeleteTask, useTask } from '@/queries';
import { confirmedDeleteDestination } from '@/features/task/deleteOrigin';
import type { Id } from '@/types';

const TYPE_NOUN: Record<string, string> = { routine: 'routine', event: 'event', course: 'course', todo: 'to-do' };

export default function S22DeleteConfirmation() {
  const t = useTheme();
  const router = useRouter();
  const { id, openedFrom, origin } = useLocalSearchParams<{ id: string; openedFrom?: string; origin?: string }>();
  const taskId = id as Id;
  const taskQuery = useTask(taskId);
  const deleteTask = useDeleteTask();
  const [failed, setFailed] = useState(false);

  const openedFromResolved: 'manage' | 'as-needed' = openedFrom === 'as-needed' ? 'as-needed' : 'manage';

  function keepIt() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace((openedFromResolved === 'as-needed' ? `/task/${taskId}/as-needed` : `/task/${taskId}`) as never);
  }

  async function confirmDelete() {
    setFailed(false);
    const result = await deleteTask.mutateAsync(taskId);
    if (!result.ok) {
      setFailed(true);
      return;
    }
    const taskType = taskQuery.data?.type ?? 'routine';
    const dest = confirmedDeleteDestination({ openedFrom: openedFromResolved, s20Origin: origin, taskType });
    router.replace(dest as never);
  }

  const noun = TYPE_NOUN[taskQuery.data?.type ?? 'routine'] ?? 'routine';
  const name = taskQuery.data?.name ?? 'this task';

  return (
    <View style={[styles.scrim, { backgroundColor: t.color.bg }]} accessibilityViewIsModal>
      <View style={[styles.dialog, { backgroundColor: t.color.bgAlt, borderColor: t.color.border }]} accessibilityLabel={`Delete this ${noun}?`}>
        <AlertCircle size={28} color={t.color.textMuted} accessibilityElementsHidden importantForAccessibility="no" />
        <Text accessibilityRole="header" style={[styles.headline, { color: t.color.text }]}>
          Delete this {noun}?
        </Text>
        <Text style={[styles.body, { color: t.color.textMuted }]}>
          "{name}" and its history will be removed. This can't be undone.
        </Text>

        {failed ? (
          <InlineRetryBanner message="Couldn't delete — try again." onRetry={confirmDelete} tone="warning" />
        ) : (
          <View style={styles.buttons}>
            <Button
              label={`Delete ${noun}`}
              onPress={confirmDelete}
              variant="danger"
              loading={deleteTask.isPending}
              disabled={deleteTask.isPending}
              accessibilityLabel={`Delete ${noun}`}
              fullWidth
            />
            <Button label="Keep it" onPress={keepIt} variant="secondary" disabled={deleteTask.isPending} accessibilityLabel="Keep it" fullWidth />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACE.s4 },
  dialog: { width: '100%', maxWidth: 360, borderWidth: 1, borderRadius: 16, padding: SPACE.s4, gap: SPACE.s2 },
  headline: { fontSize: 20, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 22 },
  buttons: { gap: SPACE.s2, marginTop: SPACE.s2 },
});
