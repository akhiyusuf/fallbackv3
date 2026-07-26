/** M0 kit — Verdant `Checkbox`. Plain binary control (S13 To-dos, S20 ideal-step rows). */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';

import { MIN_TAP_TARGET, RADIUS, SPACE, useTheme } from '@/theme';

export interface CheckboxProps {
  readonly checked: boolean;
  readonly onToggle: () => void;
  readonly label: string;
  readonly disabled?: boolean;
  readonly strikethrough?: boolean;
  readonly caption?: string;
  readonly accessibilityLabel?: string;
  readonly testID?: string;
}

export function Checkbox({ checked, onToggle, label, disabled = false, strikethrough = false, caption, accessibilityLabel, testID }: CheckboxProps) {
  const t = useTheme();
  return (
    <Pressable
      onPress={disabled ? undefined : onToggle}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID}
      hitSlop={8}
      style={[styles.row, disabled && styles.disabled]}
    >
      <View
        style={[
          styles.box,
          { borderColor: checked ? t.accent.base : t.color.border, backgroundColor: checked ? t.accent.base : 'transparent' },
        ]}
      >
        {checked ? <Check size={14} color={t.color.textOnAccent} /> : null}
      </View>
      <View style={styles.textCol}>
        <Text style={[styles.label, { color: t.color.text, textDecorationLine: strikethrough && checked ? 'line-through' : 'none' }]}>
          {label}
        </Text>
        {caption ? <Text style={[styles.caption, { color: t.color.textDim }]}>{caption}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2, minHeight: MIN_TAP_TARGET, paddingVertical: SPACE.s1 },
  box: { width: 22, height: 22, borderRadius: RADIUS.sm / 2, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  textCol: { flexShrink: 1, gap: 2 },
  label: { fontSize: 16 },
  caption: { fontSize: 12 },
  disabled: { opacity: 0.5 },
});
