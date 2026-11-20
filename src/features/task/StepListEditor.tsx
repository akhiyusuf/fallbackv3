/**
 * StepListEditor — the ideal / fallback step list on every form.
 * A bold heading (D19), one field per step with its delete inside the field,
 * and a single "Add step" button. When steps can run on different days, each step's days sit
 * directly under that step, never in a separate section further down.
 */
import { StyleSheet, View } from 'react-native';
import { Plus, Trash2 } from 'lucide-react-native';

import { FONT_SIZE, RADIUS, SPACE, useTheme } from '@/theme';
import { Button, IconButton, Input, SectionHeading, WeekdayPicker } from '@/ui';
import type { StepDraft, Weekday } from '@/types';
import { Text } from '@/ui/AppText';

const ALL_DAYS: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 7];

/** Per-step days. Present only when the task runs on more than one day and has more than one step. */
export interface StepDaySchedule {
  /** The days the task itself runs; other days are locked. */
  readonly parentDays: readonly Weekday[];
  readonly onToggle: (index: number, day: Weekday) => void;
  /** One line under the heading explaining the circles. */
  readonly helper: string;
  readonly footnote?: string;
  /** A day that has ended up with no step due, e.g. "Wednesday". */
  readonly bannerDay?: string;
}

export interface StepListEditorProps {
  readonly label: string;
  readonly itemLabel: string;
  readonly helper?: string;
  readonly steps: readonly StepDraft[];
  readonly onChange: (steps: readonly StepDraft[]) => void;
  readonly addLabel?: string;
  readonly placeholder?: string;
  readonly error?: string;
  readonly schedule?: StepDaySchedule;
  readonly testID?: string;
}

export function StepListEditor({ label, itemLabel, helper, steps, onChange, addLabel = 'Add step', placeholder, error, schedule, testID }: StepListEditorProps) {
  const t = useTheme();
  const updateText = (index: number, text: string) => onChange(steps.map((s, i) => (i === index ? { ...s, text } : s)));
  const removeAt = (index: number) => onChange(steps.filter((_, i) => i !== index));
  const add = () => onChange([...steps, { text: '', dueWeekdays: null }]);

  return (
    <View style={styles.root} testID={testID}>
      <SectionHeading>{label}</SectionHeading>
      {helper ? <Text style={[styles.helper, { color: t.color.textMuted }]}>{helper}</Text> : null}
      {schedule ? <Text style={[styles.helper, { color: t.color.textMuted }]}>{schedule.helper}</Text> : null}
      {schedule?.bannerDay ? (
        <View accessibilityRole="alert" style={[styles.banner, { backgroundColor: t.color.dangerSoft }]}>
          <Text style={[styles.helper, { color: t.scheme === 'dark' ? t.color.text : t.color.dangerDeep }]}>
            {schedule.bannerDay} has no ideal step due. Turn at least one step back on for {schedule.bannerDay}.
          </Text>
        </View>
      ) : null}
      {steps.map((step, i) => {
        const field = (
          <Input
            key={i}
            label=""
            value={step.text}
            onChangeText={(text) => updateText(i, text)}
            placeholder={placeholder ?? `${itemLabel} ${i + 1}`}
            accessibilityLabel={`${itemLabel} ${i + 1}`}
            right={<IconButton icon={Trash2} size={18} onPress={() => removeAt(i)} accessibilityLabel={`Delete ${itemLabel.toLowerCase()} ${i + 1}`} />}
          />
        );
        if (!schedule) return field;
        const on = (step.dueWeekdays ?? schedule.parentDays).filter((d) => schedule.parentDays.includes(d));
        return (
          <View key={i} style={[styles.stepBlock, i > 0 && styles.stepBlockGap]}>
            {field}
            <WeekdayPicker
              selected={on}
              disabledDays={ALL_DAYS.filter((d) => !schedule.parentDays.includes(d))}
              onChange={(next) => {
                const changed = [...next.filter((d) => !on.includes(d)), ...on.filter((d) => !next.includes(d))][0];
                if (changed) schedule.onToggle(i, changed);
              }}
              accessibilityLabel={`Days for ${step.text.trim() || `${itemLabel.toLowerCase()} ${i + 1}`}`}
            />
          </View>
        );
      })}
      {schedule?.footnote ? <Text style={[styles.helper, { color: t.color.textMuted }]}>{schedule.footnote}</Text> : null}
      {error ? (
        <Text accessibilityRole="alert" style={[styles.error, { color: t.color.dangerDeep }]}>
          {error}
        </Text>
      ) : null}
      <Button label={addLabel} onPress={add} variant="secondary" icon={<Plus size={18} color={t.color.text} />} accessibilityLabel={addLabel} fullWidth />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: SPACE.s2 },
  helper: { fontSize: FONT_SIZE.sm, lineHeight: 20 },
  error: { fontSize: FONT_SIZE.sm },
  stepBlock: { gap: SPACE.s2 },
  stepBlockGap: { marginTop: SPACE.s2 },
  banner: { borderRadius: RADIUS.sm, padding: SPACE.s2 + 4 },
});
