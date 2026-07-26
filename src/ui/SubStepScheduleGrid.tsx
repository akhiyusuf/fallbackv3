/**
 * M0 kit — Fallback-custom `SubStepScheduleGrid` (F23/F24). Rows = ideal steps, columns =
 * the parent's own due weekdays. `dueWeekdays === null` on a step reads as "on" for every
 * column (the default for a new step) — see `src/types/task.ts`'s `Step.dueWeekdays`.
 * Save-time no-empty-run-occurrence validation is `@/domain`'s; this component only
 * highlights the columns the caller names as invalid.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';

import { MIN_TAP_TARGET, RADIUS, SPACE, useTheme } from '@/theme';
import type { Weekday } from '@/types';

const WEEKDAY_ABBR: Record<Weekday, string> = { 1: 'M', 2: 'T', 3: 'W', 4: 'T', 5: 'F', 6: 'S', 7: 'S' };

export interface SubStepScheduleGridStep {
  readonly id: string;
  readonly text: string;
  /** `null` == due every parent day. */
  readonly dueWeekdays: readonly Weekday[] | null;
}

export interface SubStepScheduleGridProps {
  readonly steps: readonly SubStepScheduleGridStep[];
  readonly parentDays: readonly Weekday[];
  readonly onToggle: (stepId: string, day: Weekday) => void;
  readonly errorDays?: readonly Weekday[];
  readonly accessibilityLabel: string;
  readonly testID?: string;
}

export function SubStepScheduleGrid({ steps, parentDays, onToggle, errorDays = [], accessibilityLabel, testID }: SubStepScheduleGridProps) {
  const t = useTheme();
  const sortedDays = [...parentDays].sort((a, b) => a - b);

  return (
    <View testID={testID} accessibilityLabel={accessibilityLabel}>
      <View style={styles.headerRow}>
        <View style={styles.stepLabelCol} />
        {sortedDays.map((day) => (
          <Text
            key={day}
            style={[styles.dayHeader, { color: errorDays.includes(day) ? t.color.danger : t.color.textDim }]}
          >
            {WEEKDAY_ABBR[day]}
          </Text>
        ))}
      </View>

      {steps.map((step) => (
        <View key={step.id} style={styles.row}>
          <Text style={[styles.stepLabel, { color: t.color.text }]}>{step.text}</Text>
          {sortedDays.map((day) => {
            const on = step.dueWeekdays === null || step.dueWeekdays.includes(day);
            return (
              <Pressable
                key={day}
                onPress={() => onToggle(step.id, day)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${step.text}, ${WEEKDAY_ABBR[day]}`}
                style={[
                  styles.cell,
                  { backgroundColor: on ? t.accent.base : t.color.bg, borderColor: on ? t.accent.base : t.color.border },
                ]}
              >
                {on ? <Check size={12} color={t.color.textOnAccent} /> : null}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  stepLabelCol: { flex: 1 },
  dayHeader: { width: MIN_TAP_TARGET, textAlign: 'center', fontSize: 12, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACE.s1 },
  stepLabel: { flex: 1, fontSize: 14, paddingRight: SPACE.s1 },
  cell: {
    width: MIN_TAP_TARGET - 10,
    height: MIN_TAP_TARGET - 10,
    marginHorizontal: 5,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
