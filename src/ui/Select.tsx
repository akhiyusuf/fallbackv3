/** M0 kit — Verdant `Select`. A labeled field that opens a single-select option sheet. */
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Check, ChevronDown } from 'lucide-react-native';

import { RADIUS, SPACE, useTheme } from '@/theme';
import { Dialog } from './Dialog';
import { Text } from '@/ui/AppText';

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
      {label ? <Text style={[styles.label, { color: t.color.text }]}>{label}</Text> : null}
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? `${label}, ${selected?.label ?? placeholder}`}
        testID={testID}
        style={[styles.field, { backgroundColor: t.color.bgAlt, borderColor: t.color.borderStrong }]}
      >
        <Text style={[styles.value, { color: selected ? t.color.text : t.color.textDim }]}>{selected?.label ?? placeholder}</Text>
        <ChevronDown size={18} color={t.color.textMuted} />
      </Pressable>

      <Dialog visible={open} onClose={() => setOpen(false)} title={label} accessibilityLabel={label}>
        <View accessibilityRole="radiogroup" accessibilityLabel={label}>
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
                style={[styles.option, { borderBottomColor: t.color.border }]}
              >
                <Text style={[styles.optionLabel, { color: t.color.text, fontWeight: isSelected ? '700' : '400' }]}>{option.label}</Text>
                {isSelected ? <Check size={18} color={t.accent.text} /> : null}
              </Pressable>
            );
          })}
        </View>
      </Dialog>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: SPACE.s1 + 2, flex: 1 },
  label: { fontSize: 14, fontWeight: '600' },
  field: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingVertical: SPACE.s2,
    paddingHorizontal: SPACE.s2 + 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  value: { fontSize: 16, flexShrink: 1 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACE.s2,
    minHeight: 48,
    borderBottomWidth: 1,
  },
  optionLabel: { fontSize: 16, flexShrink: 1 },
});
