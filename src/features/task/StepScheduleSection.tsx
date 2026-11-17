/** "When does each step apply?" — the per-step weekday grid, shared by every form. */
import { StyleSheet, View } from 'react-native';

import { FONT_SIZE, RADIUS, SPACE, useTheme } from '@/theme';
import { SectionHeading, SubStepScheduleGrid } from '@/ui';
import type { StepDraft, Weekday } from '@/types';
import { Text } from '@/ui/AppText';

export const WEEKDAY_NAME_TO_NUM: Record<string, Weekday> = { Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6, Sunday: 7 };

export function toggleStepDay(steps: readonly StepDraft[], parentDays: readonly Weekday[], stepIndex: number, day: Weekday): readonly StepDraft[] {
  return steps.map((s, i) => {
    if (i !== stepIndex) return s;
    const current = s.dueWeekdays ?? parentDays;
    const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day];
    return { ...s, dueWeekdays: parentDays.every((d) => next.includes(d)) ? null : next };
  });
}

export interface StepScheduleSectionProps {
  readonly steps: readonly StepDraft[];
  readonly parentDays: readonly Weekday[];
  readonly onToggle: (stepIndex: number, day: Weekday) => void;
  readonly helper: string;
  readonly footnote?: string;
  readonly bannerDay?: string;
  readonly errorDays?: readonly Weekday[];
}

export function StepScheduleSection({ steps, parentDays, onToggle, helper, footnote, bannerDay, errorDays }: StepScheduleSectionProps) {
  const t = useTheme();
  return (
    <View style={styles.root}>
      <SectionHeading>When each step applies</SectionHeading>
      <Text style={[styles.helper, { color: t.color.textMuted }]}>{helper}</Text>
      {bannerDay ? (
        <View accessibilityRole="alert" style={[styles.banner, { backgroundColor: t.color.dangerSoft }]}>
          <Text style={[styles.bannerText, { color: t.scheme === 'dark' ? t.color.text : t.color.dangerDeep }]}>
            {bannerDay} has no ideal step due. Turn at least one step back on for {bannerDay}.
          </Text>
        </View>
      ) : null}
      <SubStepScheduleGrid
        steps={steps.map((s, i) => ({ id: String(i), text: s.text || `Step ${i + 1}`, dueWeekdays: s.dueWeekdays }))}
        parentDays={parentDays}
        onToggle={(stepId, day) => onToggle(Number(stepId), day)}
        errorDays={errorDays}
        accessibilityLabel="When each step applies"
      />
      {footnote ? <Text style={[styles.helper, { color: t.color.textMuted }]}>{footnote}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: SPACE.s2 },
  helper: { fontSize: FONT_SIZE.sm, lineHeight: 20 },
  banner: { borderRadius: RADIUS.sm, padding: SPACE.s2 + 4 },
  bannerText: { fontSize: FONT_SIZE.sm, lineHeight: 20 },
});
