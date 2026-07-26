/** M0 kit — Verdant `Badge`. Text-only status pill (e.g. "Due", "One-time", "Completed Jul 5"). */
import { StyleSheet, Text, View } from 'react-native';

import { RADIUS, SPACE, useTheme } from '@/theme';

export interface BadgeProps {
  readonly label: string;
  readonly tone?: 'neutral' | 'accent';
  readonly accessibilityLabel?: string;
}

export function Badge({ label, tone = 'neutral', accessibilityLabel }: BadgeProps) {
  const t = useTheme();
  const bg = tone === 'accent' ? t.accent.soft : t.color.surface;
  const fg = tone === 'accent' ? t.accent.deep : t.color.textMuted;
  return (
    <View
      style={[styles.root, { backgroundColor: bg }]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <Text style={[styles.label, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { borderRadius: RADIUS.pill, paddingVertical: SPACE.s1 / 2, paddingHorizontal: SPACE.s2, alignSelf: 'flex-start' },
  label: { fontSize: 12, fontWeight: '600' },
});
