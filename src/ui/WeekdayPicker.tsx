/**
 * M0 kit — Fallback-custom `WeekdayPicker`. Mon..Sun multi-select toggle chips. When
 * constrained to a parent's own occurrence days (F23/F24 sub-step editors), the days the
 * parent doesn't run render disabled/unreachable via `disabledDays`.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Lock } from 'lucide-react-native';

import { MIN_TAP_TARGET, RADIUS, SPACE, useTheme } from '@/theme';
import type { Weekday } from '@/types';

const LABELS: Record<Weekday, string> = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 7: 'Sun' };
const ALL: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 7];

export interface WeekdayPickerProps {
  readonly selected: readonly Weekday[];
  readonly onChange: (selected: readonly Weekday[]) => void;
  readonly disabledDays?: readonly Weekday[];
  readonly accessibilityLabel: string;
  readonly error?: string;
  readonly testID?: string;
}

export function WeekdayPicker({ selected, onChange, disabledDays = [], accessibilityLabel, error, testID }: WeekdayPickerProps) {
  const t = useTheme();

  const toggle = (day: Weekday) => {
    if (disabledDays.includes(day)) return;
    onChange(selected.includes(day) ? selected.filter((d) => d !== day) : [...selected, day]);
  };

  return (
    <View testID={testID}>
      <View style={styles.row} accessibilityRole="none" accessibilityLabel={accessibilityLabel}>
        {ALL.map((day) => {
          const isSelected = selected.includes(day);
          const isDisabled = disabledDays.includes(day);
          return (
            <Pressable
              key={day}
              onPress={() => toggle(day)}
              disabled={isDisabled}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected, disabled: isDisabled }}
              accessibilityLabel={isDisabled ? `${LABELS[day]}, unavailable` : LABELS[day]}
              style={[
                styles.chip,
                {
                  backgroundColor: isSelected ? t.accent.base : t.color.bg,
                  borderColor: isSelected ? t.accent.base : t.color.border,
                  opacity: isDisabled ? 0.4 : 1,
                },
              ]}
            >
              {isDisabled ? (
                <Lock size={12} color={t.color.textDim} />
              ) : (
                <Text style={[styles.chipLabel, { color: isSelected ? t.color.textOnAccent : t.color.text }]}>{LABELS[day][0]}</Text>
              )}
            </Pressable>
          );
        })}
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={[styles.error, { color: t.color.danger }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: SPACE.s1 },
  chip: {
    width: MIN_TAP_TARGET,
    height: MIN_TAP_TARGET,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipLabel: { fontSize: 14, fontWeight: '700' },
  error: { fontSize: 14, marginTop: SPACE.s1 },
});
