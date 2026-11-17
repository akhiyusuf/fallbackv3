/** A task the assistant created — the same card pieces as everywhere else in the app. */
import { StyleSheet, View } from 'react-native';

import { taskIconProps } from '@/features/browse/resolveIcon';
import { MetaLine, PlanTiles, planSummary } from '@/features/task/TaskDetails';
import { FONT_SIZE, SPACE, useTheme } from '@/theme';
import { Card, TaskIcon } from '@/ui';
import type { TaskWithSteps } from '@/types';
import { Text } from '@/ui/AppText';

export interface TaskCreatedCardProps {
  readonly task: TaskWithSteps;
  readonly onPress?: () => void;
}

const TYPE_LABEL: Record<string, string> = { routine: 'Routine', event: 'Event', course: 'Course', todo: 'To-do' };

function scheduleLabel(task: TaskWithSteps): string {
  const kind = task.cadence?.kind;
  const cadence = kind === 'daily' ? 'Daily' : kind ? kind.charAt(0).toUpperCase() + kind.slice(1) : 'One time';
  return task.timeOfDay ? `${cadence}, ${task.timeOfDay}` : cadence;
}

export function TaskCreatedCard({ task, onPress }: TaskCreatedCardProps) {
  const t = useTheme();
  const ideal = planSummary(task.idealSteps);
  const fallback = planSummary(task.fallbackSteps);
  return (
    <Card onPress={onPress} accessibilityLabel={`${task.name}, ${scheduleLabel(task)}`} style={styles.card}>
      <View style={styles.row}>
        <TaskIcon {...taskIconProps(task)} />
        <View style={styles.text}>
          <Text style={[styles.name, { color: t.color.text }]}>{task.name}</Text>
          <MetaLine parts={[TYPE_LABEL[task.type] ?? 'Task', scheduleLabel(task)]} />
        </View>
      </View>
      {ideal || fallback ? <PlanTiles ideal={ideal} fallback={fallback} numberOfLines={2} /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: SPACE.s2 + 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 + 4 },
  text: { flex: 1, gap: 2 },
  name: { fontSize: FONT_SIZE.base, fontWeight: '600' },
});
