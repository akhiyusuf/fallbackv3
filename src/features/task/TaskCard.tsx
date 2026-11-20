/**
 * TaskCard — one task on any list (Routines, Events, Courses, Search).
 * Colored icon circle (D14), name, one quiet meta line and status pills
 * (D13), ideal/fallback tiles (decision 22-C), chevron = opens the task (D7).
 */
import { isValidElement, memo, type ComponentProps, useCallback, useRef, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

import { taskIconProps } from '@/features/browse/resolveIcon';
import { FONT_SIZE, SPACE, useTheme } from '@/theme';
import type { TaskWithSteps } from '@/types';
import type { Id } from '@/types';
import { Card, TaskIcon, WeekStrip } from '@/ui';

import { MetaLine, planSummary } from './TaskDetails';
import { useWeekStripsContext } from '@/features/today/weekStrips';
import { useWeekStrip } from './useWeekStrip';
import { Text } from '@/ui/AppText';

export interface TaskCardProps {
  readonly task: TaskWithSteps;
  readonly meta: readonly string[];
  /** Small node before the meta line (e.g. a progress ring). */
  readonly metaLeading?: ReactNode;
  /** Status pills, right of the name. */
  readonly status?: ReactNode;
  readonly showPlan?: boolean;
  /** The last seven days as dots. Defaults to on for routines and courses that run on a schedule. */
  readonly showWeek?: boolean;
  readonly muted?: boolean;
  readonly onPress: () => void;
  readonly footer?: ReactNode;
  readonly accessibilityLabel?: string;
}

/**
 * Two nodes that would draw the same: the very same node, or elements of one type whose props are
 * shallow-equal (a list rebuilds `<StatusPill label=... />` on every render).
 */
function sameNode(a: ReactNode, b: ReactNode): boolean {
  if (a === b) return true;
  if (!isValidElement(a) || !isValidElement(b)) return false;
  if (a.type !== b.type || a.key !== b.key) return false;
  const pa = a.props as Record<string, unknown>;
  const pb = b.props as Record<string, unknown>;
  const keys = Object.keys(pa);
  if (keys.length !== Object.keys(pb).length) return false;
  return keys.every((k) => (pa[k] === pb[k] || (k === 'children' && sameNode(pa[k] as ReactNode, pb[k] as ReactNode))));
}

/**
 * A list that re-renders (a log elsewhere, a refetch) hands every card new `meta` arrays, new
 * `onPress` closures and new status elements with the same content. A card redraws only when what
 * it shows changed; `onPress` is read through a ref so a stale closure is never called.
 */
function sameCard(a: TaskCardProps, b: TaskCardProps): boolean {
  return (
    a.task === b.task &&
    a.showPlan === b.showPlan &&
    a.showWeek === b.showWeek &&
    a.muted === b.muted &&
    a.accessibilityLabel === b.accessibilityLabel &&
    a.meta.length === b.meta.length &&
    a.meta.every((m, i) => m === b.meta[i]) &&
    sameNode(a.metaLeading, b.metaLeading) &&
    sameNode(a.status, b.status) &&
    sameNode(a.footer, b.footer)
  );
}

export const TaskCard = memo(TaskCardImpl, sameCard);

function TaskCardImpl({ task, meta, metaLeading, status, showPlan = true, showWeek, muted = false, onPress, footer, accessibilityLabel }: TaskCardProps) {
  const t = useTheme();
  const latestPress = useRef(onPress);
  latestPress.current = onPress;
  const press = useCallback(() => latestPress.current(), []);
  const ideal = showPlan ? planSummary(task.idealSteps) : null;
  const fallback = showPlan ? planSummary(task.fallbackSteps) : null;
  const week = showWeek ?? ((task.type === 'routine' || task.type === 'course') && !task.isAsNeeded);
  return (
    <Card onPress={press} accessibilityLabel={accessibilityLabel ?? `${task.name}, ${meta.join(', ')}`} style={styles.card}>
      <View style={styles.head}>
        <TaskIcon {...taskIconProps(task)} muted={muted} />
        <View style={styles.textCol}>
          <Text numberOfLines={1} style={[styles.name, { color: t.color.text }]}>
            {task.name}
          </Text>
          <View style={styles.metaRow}>
            {metaLeading}
            <View style={styles.metaText}>
              <MetaLine parts={meta} numberOfLines={2} />
            </View>
          </View>
        </View>
        {status}
        <ChevronRight size={18} color={t.color.textDim} accessibilityElementsHidden importantForAccessibility="no" />
      </View>
      {week ? <TaskWeek taskId={task.id as Id} /> : null}
      {ideal || fallback ? (
        <View style={[styles.plan, { borderTopColor: t.color.border }]}>
          {ideal ? <PlanLine dot={t.color.ideal} text={ideal} /> : null}
          {fallback ? <PlanLine dot={t.color.fallback} text={fallback} /> : null}
        </View>
      ) : null}
      {footer}
    </Card>
  );
}

function TaskWeek({ taskId }: { readonly taskId: Id }) {
  const batch = useWeekStripsContext();
  return batch ? <BatchedWeek days={batch.daysFor(taskId)} /> : <OwnWeek taskId={taskId} />;
}

/** A card outside a list that reads the strips once (Search) reads its own. */
function OwnWeek({ taskId }: { readonly taskId: Id }) {
  return <WeekStrip days={useWeekStrip(taskId)} />;
}

const BatchedWeek = memo(function BatchedWeek({ days }: { readonly days: ComponentProps<typeof WeekStrip>['days'] }) {
  return <WeekStrip days={days} />;
});

/** One side of the plan on one line: a dot in the state color, then the words. */
function PlanLine({ dot, text }: { readonly dot: string; readonly text: string }) {
  const t = useTheme();
  return (
    <View style={styles.planLine}>
      <View style={[styles.planDot, { backgroundColor: dot }]} />
      <Text numberOfLines={1} style={[styles.planText, { color: t.color.textMuted }]}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  plan: { flexDirection: 'row', gap: SPACE.s3, borderTopWidth: 1, paddingTop: SPACE.s2 + 2 },
  planLine: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACE.s1 + 2 },
  planDot: { width: 8, height: 8, borderRadius: 4 },
  planText: { flex: 1, fontSize: FONT_SIZE.sm },
  card: { gap: SPACE.s2 + 4 },
  head: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 },
  textCol: { flex: 1, gap: 2, marginLeft: SPACE.s1 },
  name: { fontSize: FONT_SIZE.base, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s1 + 2 },
  metaText: { flex: 1 },
});
