/**
 * The Skip sheet. One place to skip, with two honest choices and no extra button on the card:
 *
 * - Skip it: logged as a miss. The sheet shows what that does to the consistency number before
 *   the person commits ("78% → 76%"), so a skip is never a silent cost.
 * - Take today off: for when something comes up. That habit is off for the day and does not count
 *   for or against them (the same "Off today" a task's own page has). Undo is offered at once.
 *
 * Mounted once in app/_layout.tsx, next to the add menu.
 */
import { LifeBuoy, Minus } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useToastStore } from '@/app-shell';
import { useMarkOffDay, useSkipPreview } from '@/queries';
import { play } from '@/services/sfx';
import { FONT_SIZE, SPACE, useTheme } from '@/theme';
import { Dialog, ListGroup, ListRow, TaskIcon } from '@/ui';
import { Text } from '@/ui/AppText';

import { useSkipSheetStore } from './skipSheet';
import { SAVE_FAILED } from './formShared';

export const SKIP_COPY = {
  title: (name: string) => `Skip ${name} today?`,
  skipLabel: 'Skip it',
  skipCost: (now: number, next: number) => (next < now ? `Counts as a miss. Your consistency goes from ${now}% to ${next}%.` : `Counts as a miss. Your consistency stays at ${now}%.`),
  skipCostPlain: 'Counts as a miss in your consistency.',
  offLabel: 'Take today off',
  offBody: "Something came up? Today won't count for or against you.",
  offToast: 'Taken off today',
  offToastDetail: "Won't count",
} as const;

export function SkipSheetHost() {
  const t = useTheme();
  const request = useSkipSheetStore((s) => s.request);
  const close = useSkipSheetStore((s) => s.close);
  const preview = useSkipPreview(request ? { taskId: request.taskId, date: request.date } : null);
  const markOffDay = useMarkOffDay();
  const showToast = useToastStore((s) => s.show);

  const now = preview.data?.now ?? null;
  const next = preview.data?.ifSkipped ?? null;
  const drops = now !== null && next !== null && next < now;
  // The numbers sit in the bar above when the skip costs something; the row only names the rule.
  const cost = drops ? SKIP_COPY.skipCostPlain : now !== null && next !== null ? SKIP_COPY.skipCost(now, next) : SKIP_COPY.skipCostPlain;

  function skip() {
    if (!request) return;
    close();
    request.onSkip();
  }

  async function takeOff() {
    if (!request) return;
    const { taskId, date } = request;
    close();
    const result = await markOffDay.mutateAsync({ date, taskId, mark: true }).catch(() => ({ ok: false as const }));
    if (!result.ok) {
      showToast(SAVE_FAILED, 'warning');
      return;
    }
    play('log_skip');
    showToast(SKIP_COPY.offToast, 'neutral', {
      icon: 'skip',
      detail: SKIP_COPY.offToastDetail,
      action: {
        label: 'Undo',
        onPress: () =>
          void markOffDay
            .mutateAsync({ date, taskId, mark: false })
            .then((undone) => showToast(undone.ok ? 'Undone' : SAVE_FAILED, undone.ok ? 'neutral' : 'warning'))
            .catch(() => showToast(SAVE_FAILED, 'warning')),
      },
    });
  }

  return (
    <Dialog visible={request !== null} onClose={close} title={request ? SKIP_COPY.title(request.name) : undefined} accessibilityLabel={request ? SKIP_COPY.title(request.name) : 'Skip'} showClose testID="skip-sheet">
      {now !== null && next !== null && drops ? (
        <View style={[styles.meter, { backgroundColor: t.color.surface }]} accessibilityLabel={`Consistency ${now}% now, ${next}% if skipped`}>
          <Text style={[styles.meterNow, { color: t.color.text }]}>{now}%</Text>
          <Text style={[styles.meterArrow, { color: t.color.textMuted }]}>→</Text>
          <Text style={[styles.meterNext, { color: t.color.danger }]}>{next}%</Text>
          <Text style={[styles.meterCaption, { color: t.color.textMuted }]}>if you skip</Text>
        </View>
      ) : null}
      <ListGroup>
        <ListRow
          leading={<TaskIcon icon={Minus} color={t.color.offDeep} />}
          label={SKIP_COPY.skipLabel}
          sublabel={cost}
          onPress={skip}
          testID="skip-sheet-skip"
        />
        <ListRow
          leading={<TaskIcon icon={LifeBuoy} color={t.accent.fill} />}
          label={SKIP_COPY.offLabel}
          sublabel={SKIP_COPY.offBody}
          onPress={() => void takeOff()}
          testID="skip-sheet-off"
        />
      </ListGroup>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  meter: { flexDirection: 'row', alignItems: 'baseline', gap: SPACE.s2, borderRadius: 16, paddingVertical: SPACE.s2 + 2, paddingHorizontal: SPACE.s3, marginBottom: SPACE.s3 },
  meterNow: { fontSize: FONT_SIZE.xl, fontWeight: '800' },
  meterArrow: { fontSize: FONT_SIZE.lg, fontWeight: '700' },
  meterNext: { fontSize: FONT_SIZE.xl, fontWeight: '800' },
  meterCaption: { fontSize: FONT_SIZE.sm, fontWeight: '600', marginLeft: 'auto' },
});
