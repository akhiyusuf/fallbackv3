/**
 * Ended. Habits the person stopped with "End routine" (or "End event"): no longer due, their
 * past days still in the record. Opening one shows its history and "Start again".
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
  heading: 'Ended',
  meta: (endedOn: LocalDate) => `Ended ${format(parseLocalDate(endedOn), 'MMM d')}`,
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
