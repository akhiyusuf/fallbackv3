/** M0 kit — Fallback-custom `OffDayToggle`. F4 whole-day or task-day off mark. Two independent instances per S09/S20. */
import { StyleSheet, Text, View } from 'react-native';

import { SPACE, useTheme } from '@/theme';

import { Switch } from './Switch';

export interface OffDayToggleProps {
  readonly value: boolean;
  readonly onValueChange: (value: boolean) => void;
  readonly label: string;
  readonly helper?: string;
  readonly accessibilityLabel?: string;
  readonly testID?: string;
}

export function OffDayToggle({ value, onValueChange, label, helper, accessibilityLabel, testID }: OffDayToggleProps) {
  const t = useTheme();
  return (
    <View style={styles.root} testID={testID}>
      <View style={styles.textCol}>
        <Text style={[styles.label, { color: t.color.text }]}>{label}</Text>
        {helper ? <Text style={[styles.helper, { color: t.color.textMuted }]}>{helper}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onValueChange} accessibilityLabel={accessibilityLabel ?? label} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.s2 },
  textCol: { flexShrink: 1, gap: 2 },
  label: { fontSize: 16, fontWeight: '600' },
  helper: { fontSize: 14, lineHeight: 20 },
});
