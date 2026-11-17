/**
 * RadioGroup — single choice (D9). 2–4 options render as the segmented bar;
 * 5 or more fall back to the dropdown. Never chips.
 */
import { StyleSheet, View } from 'react-native';

import { FONT_SIZE, SPACE, useTheme } from '@/theme';
import { Select } from './Select';
import { Tabs } from './Tabs';
import { Text } from '@/ui/AppText';

export interface RadioOption {
  readonly value: string;
  readonly label: string;
}

export interface RadioGroupProps {
  readonly label: string;
  readonly value: string | null;
  readonly options: readonly RadioOption[];
  readonly onChange: (value: string) => void;
  readonly helper?: string;
  readonly testID?: string;
}

export function RadioGroup({ label, value, options, onChange, helper, testID }: RadioGroupProps) {
  const t = useTheme();
  if (options.length > 4) {
    return <Select label={label} value={value} options={options} onChange={onChange} testID={testID} />;
  }
  return (
    <View style={styles.root} testID={testID}>
      {label ? <Text style={[styles.groupLabel, { color: t.color.text }]}>{label}</Text> : null}
      <Tabs items={options} value={value} onChange={onChange} accessibilityLabel={label} />
      {helper ? <Text style={[styles.helper, { color: t.color.textMuted }]}>{helper}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: SPACE.s1 + 2 },
  groupLabel: { fontSize: FONT_SIZE.sm, fontWeight: '600' },
  helper: { fontSize: FONT_SIZE.sm, lineHeight: 20 },
});
