/**
 * Paused. Habits the person paused (for an emergency or a hard stretch): nothing is due and the
 * days away do not count. Opening one shows its history and "Resume".
 */
import { StyleSheet, View } from 'react-native';
import { format } from 'date-fns';

import { parseLocalDate } from '@/lib/date';
import { SPACE } from '@/theme';
import { SectionHeading } from '@/ui';
import type { LocalDate, TaskWithSteps } from '@/types';

import { TaskCard } from '@/features/task/TaskCard';
import { metaParts } from '@/features/task/TaskDetails';

export const ENDED_COPY = {
  heading: 'Paused',
  meta: (endedOn: LocalDate) => `Paused since ${format(parseLocalDate(endedOn), 'MMM d')}`,
} as const;

export function EndedSection({ tasks, onOpen }: { readonly tasks: readonly TaskWithSteps[]; readonly onOpen: (id: string) => void }) {
  if (tasks.length === 0) return null;
  const sorted = [...tasks].sort((a, b) => ((a.endedOn ?? '') < (b.endedOn ?? '') ? 1 : -1));
  return (
    <View style={styles.list} testID="ended-section">
      <SectionHeading>{ENDED_COPY.heading}</SectionHeading>
      {sorted.map((tk) => (
        <TaskCard key={tk.id} task={tk} meta={metaParts({ schedule: ENDED_COPY.meta(tk.endedOn as LocalDate), compact: true })} onPress={() => onOpen(tk.id)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: SPACE.s2 + 4 },
});
