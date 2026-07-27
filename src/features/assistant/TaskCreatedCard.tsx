/**
 * M6. S32/S35's inline "task-created card" — embedded in an assistant turn. Rule 5: never
 * celebration chrome here (no confetti/gold/MilestoneBadge — that's S24/S28 only).
 */
import { StyleSheet, Text, View } from 'react-native';
import * as Icons from 'lucide-react-native';
import { Repeat } from 'lucide-react-native';

import { SPACE, useTheme } from '@/theme';
import { Card } from '@/ui';
import type { IconComponent } from '@/ui';
import type { TaskWithSteps } from '@/types';

export interface TaskCreatedCardProps {
  readonly task: TaskWithSteps;
}

function summaryLine(task: TaskWithSteps): string {
  const cadence = task.cadence?.kind === 'daily' ? 'daily' : task.cadence?.kind ?? 'one-time';
  const time = task.timeOfDay ? `, ${task.timeOfDay}` : '';
  return `${cadence}${time}`;
}

function stepLine(task: TaskWithSteps): string | null {
  const ideal = task.idealSteps[0]?.text;
  const fallback = task.fallbackSteps[0]?.text;
  if (!ideal && !fallback) return null;
  return [ideal, fallback].filter(Boolean).join(' / ');
}

export function TaskCreatedCard({ task }: TaskCreatedCardProps) {
  const t = useTheme();
  const Icon: IconComponent = (Icons as unknown as Record<string, IconComponent>)[task.icon] ?? Repeat;
  const steps = stepLine(task);
  return (
    <Card accessibilityLabel={`${task.name}, ${summaryLine(task)}`}>
      <View style={styles.row}>
        <Icon size={20} color={t.color.textMuted} />
        <Text style={[styles.name, { color: t.color.text }]}>{task.name}</Text>
      </View>
      <Text style={[styles.meta, { color: t.color.textMuted }]}>{summaryLine(task)}</Text>
      {steps ? <Text style={[styles.meta, { color: t.color.textMuted }]}>{steps}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s1 },
  name: { fontSize: 16, fontWeight: '600' },
  meta: { fontSize: 14, lineHeight: 20 },
});
