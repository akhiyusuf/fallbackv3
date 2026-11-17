/** Stepper — a small counted number (doses per day). Minus, value, plus. */
import { Pressable, StyleSheet, View } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';

import { FONT_SIZE, MIN_TAP_TARGET, RADIUS, SPACE, useTheme } from '@/theme';
import { Text } from '@/ui/AppText';

export interface StepperProps {
  readonly label: string;
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly min?: number;
  readonly max?: number;
  readonly helper?: string;
  readonly testID?: string;
}

export function Stepper({ label, value, onChange, min = 1, max = 12, helper, testID }: StepperProps) {
  const t = useTheme();
  const button = (delta: number, Icon: typeof Minus, a11y: string) => {
    const next = value + delta;
    const disabled = next < min || next > max;
    return (
      <Pressable
        onPress={disabled ? undefined : () => onChange(next)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${a11y} ${label.toLowerCase()}`}
        accessibilityState={{ disabled }}
        style={[styles.button, { borderColor: t.color.borderStrong, backgroundColor: t.color.bgAlt, opacity: disabled ? 0.4 : 1 }]}
      >
        <Icon size={18} color={t.color.text} />
      </Pressable>
    );
  };
  return (
    <View style={styles.root} testID={testID}>
      <View style={styles.row}>
        <Text style={[styles.label, { color: t.color.text }]}>{label}</Text>
        <View style={styles.controls}>
          {button(-1, Minus, 'Decrease')}
          <Text style={[styles.value, { color: t.color.text }]} accessibilityLabel={`${label}: ${value}`}>
            {value}
          </Text>
          {button(1, Plus, 'Increase')}
        </View>
      </View>
      {helper ? <Text style={[styles.helper, { color: t.color.textMuted }]}>{helper}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: SPACE.s1 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.s2 },
  label: { fontSize: FONT_SIZE.sm, fontWeight: '600', flexShrink: 1 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 },
  button: { width: MIN_TAP_TARGET, height: MIN_TAP_TARGET, borderRadius: RADIUS.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  value: { fontSize: FONT_SIZE.md, fontWeight: '700', minWidth: 28, textAlign: 'center', fontVariant: ['tabular-nums'] },
  helper: { fontSize: FONT_SIZE.sm, lineHeight: 20 },
});
