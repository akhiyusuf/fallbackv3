/** M0 kit — Fallback-custom `Tag`. Fixed-vocabulary label chip (type/importance/necessity/cadence). Never color-coded. */
import { StyleSheet, Text, View } from 'react-native';

import { RADIUS, SPACE, useTheme } from '@/theme';

export interface TagProps {
  readonly label: string;
  readonly accessibilityLabel?: string;
}

export function Tag({ label, accessibilityLabel }: TagProps) {
  const t = useTheme();
  return (
    <View
      style={[styles.root, { backgroundColor: t.color.surface, borderColor: t.color.border }]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <Text style={[styles.label, { color: t.color.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { borderWidth: 1, borderRadius: RADIUS.pill, paddingVertical: SPACE.s1 / 2, paddingHorizontal: SPACE.s2, alignSelf: 'flex-start' },
  label: { fontSize: 12, fontWeight: '600' },
});
