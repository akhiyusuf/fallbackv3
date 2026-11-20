/**
 * WeekdayPicker — weekday circles (D10). The one weekday control: multi-select
 * on forms, single-select as the Routines day filter.
 */
import { Pressable, StyleSheet, View } from 'react-native';
import { Lock } from 'lucide-react-native';

import { FONT_SIZE, MIN_TAP_TARGET, RADIUS, SPACE, useTheme } from '@/theme';
import type { Weekday } from '@/types';
import { Text } from '@/ui/AppText';

const LABELS: Record<Weekday, string> = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 7: 'Sun' };
const ALL: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 7];

export interface WeekdayPickerProps {
  readonly selected: readonly Weekday[];
  readonly onChange: (selected: readonly Weekday[]) => void;
  readonly mode?: 'multi' | 'single';
  readonly disabledDays?: readonly Weekday[];
  /** Day to mark with a small dot (today, on the Routines filter). */
  readonly markedDay?: Weekday;
  readonly label?: string;
  readonly accessibilityLabel: string;
  readonly error?: string;
  readonly testID?: string;
}

export function WeekdayPicker({ selected, onChange, mode = 'multi', disabledDays = [], markedDay, label, accessibilityLabel, error, testID }: WeekdayPickerProps) {
  const t = useTheme();
  const toggle = (day: Weekday) => {
    if (disabledDays.includes(day)) return;
    if (mode === 'single') {
      onChange([day]);
      return;
    }
    onChange(selected.includes(day) ? selected.filter((d) => d !== day) : [...selected, day]);
  };
  return (
    <View testID={testID} style={styles.root}>
      {label ? <Text style={[styles.label, { color: t.color.text }]}>{label}</Text> : null}
      <View style={styles.row} accessibilityRole={mode === 'single' ? 'radiogroup' : 'none'} accessibilityLabel={accessibilityLabel}>
        {ALL.map((day) => {
          const isSelected = selected.includes(day);
          const isDisabled = disabledDays.includes(day);
          return (
            <Pressable
              key={day}
              onPress={() => toggle(day)}
              disabled={isDisabled}
              accessibilityRole={mode === 'single' ? 'radio' : 'checkbox'}
              accessibilityState={{ checked: isSelected, disabled: isDisabled }}
              accessibilityLabel={isDisabled ? `${LABELS[day]}, unavailable` : LABELS[day]}
              style={[
                styles.chip,
                {
                  backgroundColor: isSelected ? t.accent.fill : t.color.bgAlt,
                  borderColor: isSelected ? t.accent.fill : t.color.borderStrong,
                  opacity: isDisabled ? 0.4 : 1,
                },
              ]}
            >
              {isDisabled ? (
                <Lock size={12} color={t.color.textDim} />
              ) : (
                <Text style={[styles.chipLabel, { color: isSelected ? t.accent.on : t.color.text }]}>{LABELS[day][0]}</Text>
              )}
              {markedDay === day ? <View style={[styles.mark, { backgroundColor: isSelected ? t.accent.on : t.accent.base }]} /> : null}
            </Pressable>
          );
        })}
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={[styles.error, { color: t.color.dangerText }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: SPACE.s1 + 2 },
  label: { fontSize: FONT_SIZE.sm, fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  chip: { width: MIN_TAP_TARGET, height: MIN_TAP_TARGET, borderRadius: RADIUS.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  chipLabel: { fontSize: FONT_SIZE.sm, fontWeight: '700' },
  mark: { position: 'absolute', bottom: 5, width: 4, height: 4, borderRadius: RADIUS.pill },
  error: { fontSize: FONT_SIZE.sm },
});
