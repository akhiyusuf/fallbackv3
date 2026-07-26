/** M0 kit — Verdant `Select`. A labeled field that opens a single-select option sheet. */
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Check, ChevronDown } from 'lucide-react-native';

import { RADIUS, SCRIM, SPACE, useTheme } from '@/theme';

export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

export interface SelectProps {
  readonly label: string;
  readonly value: string | null;
  readonly options: readonly SelectOption[];
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly accessibilityLabel?: string;
  readonly testID?: string;
}

export function Select({ label, value, options, onChange, placeholder = 'Select…', accessibilityLabel, testID }: SelectProps) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View style={styles.root}>
      <Text style={[styles.label, { color: t.color.text }]}>{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? `${label}, ${selected?.label ?? placeholder}`}
        testID={testID}
        style={[styles.field, { backgroundColor: t.color.bg, borderColor: t.color.border }]}
      >
        <Text style={[styles.value, { color: selected ? t.color.text : t.color.textDim }]}>{selected?.label ?? placeholder}</Text>
        <ChevronDown size={18} color={t.color.textMuted} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={[styles.scrim, { backgroundColor: SCRIM }]} onPress={() => setOpen(false)} accessibilityLabel="Dismiss" accessibilityRole="button">
          <Pressable style={[styles.sheet, { backgroundColor: t.color.bg }]} onPress={(e) => e.stopPropagation()}>
            <ScrollView accessibilityRole="radiogroup" accessibilityLabel={label}>
              {options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected }}
                    accessibilityLabel={option.label}
                    style={styles.option}
                  >
                    <Text style={[styles.optionLabel, { color: t.color.text }]}>{option.label}</Text>
                    {isSelected ? <Check size={18} color={t.accent.base} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: SPACE.s1 },
  label: { fontSize: 14, fontWeight: '600' },
  field: {
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    paddingVertical: SPACE.s2,
    paddingHorizontal: SPACE.s2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  value: { fontSize: 16, flexShrink: 1 },
  scrim: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg, padding: SPACE.s3, maxHeight: '70%' },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACE.s2,
    minHeight: 44,
  },
  optionLabel: { fontSize: 16, flexShrink: 1 },
});
