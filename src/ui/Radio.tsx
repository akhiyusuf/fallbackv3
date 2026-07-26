/** M0 kit — Verdant `Radio`. Single-select group over a fixed, closed vocabulary. */
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MIN_TAP_TARGET, SPACE, useTheme } from '@/theme';

export interface RadioOption {
  readonly value: string;
  readonly label: string;
}

export interface RadioGroupProps {
  readonly label: string;
  readonly value: string | null;
  readonly options: readonly RadioOption[];
  readonly onChange: (value: string) => void;
  readonly testID?: string;
}

export function RadioGroup({ label, value, options, onChange, testID }: RadioGroupProps) {
  const t = useTheme();
  return (
    <View style={styles.root} accessibilityRole="radiogroup" accessibilityLabel={label} testID={testID}>
      <Text style={[styles.groupLabel, { color: t.color.text }]}>{label}</Text>
      <View style={styles.row}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={option.label}
              style={[
                styles.chip,
                { borderColor: selected ? t.accent.base : t.color.border, backgroundColor: selected ? t.accent.soft : t.color.bg },
              ]}
            >
              <Text style={[styles.chipLabel, { color: selected ? t.accent.deep : t.color.text }]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: SPACE.s1 },
  groupLabel: { fontSize: 14, fontWeight: '600' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.s1 },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: SPACE.s1,
    paddingHorizontal: SPACE.s2,
    minHeight: MIN_TAP_TARGET,
    justifyContent: 'center',
  },
  chipLabel: { fontSize: 14, fontWeight: '600' },
});
