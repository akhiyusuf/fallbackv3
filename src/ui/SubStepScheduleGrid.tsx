/**
 * SubStepScheduleGrid — which days each step applies (F23/F24).
 * One row of the shared weekday circles per step (D10); days the parent task
 * does not run on are locked.
 */
import { StyleSheet, View } from 'react-native';

import { FONT_SIZE, SPACE, useTheme } from '@/theme';
import type { Weekday } from '@/types';
import { WeekdayPicker } from './WeekdayPicker';
import { Text } from '@/ui/AppText';

const ALL: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 7];

export interface SubStepScheduleGridStep {
  readonly id: string;
  readonly text: string;
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

export function SubStepScheduleGrid({ steps, parentDays, onToggle, accessibilityLabel, testID }: SubStepScheduleGridProps) {
  const t = useTheme();
  const locked = ALL.filter((d) => !parentDays.includes(d));
  return (
    <View testID={testID} accessibilityLabel={accessibilityLabel} style={styles.root}>
      {steps.map((step) => {
        const on = (step.dueWeekdays ?? parentDays).filter((d) => parentDays.includes(d));
        return (
          <View key={step.id} style={styles.step}>
            <Text numberOfLines={1} style={[styles.stepLabel, { color: t.color.text }]}>
              {step.text}
            </Text>
            <WeekdayPicker
              selected={on}
              disabledDays={locked}
              onChange={(next) => {
                const changed = [...next.filter((d) => !on.includes(d)), ...on.filter((d) => !next.includes(d))][0];
                if (changed) onToggle(step.id, changed);
              }}
              accessibilityLabel={`Days for ${step.text}`}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: SPACE.s3 },
  step: { gap: SPACE.s1 + 2 },
  stepLabel: { fontSize: FONT_SIZE.sm, fontWeight: '600' },
});
