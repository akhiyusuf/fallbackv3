/**
 * StatTile — one count, drawn: the state's own mark (the same dot the week strip uses), a
 * heavy number, a label. Four of them sit in a row and double as the legend of a bar.
 */
import { StyleSheet, View } from 'react-native';

import { FONT_SIZE, SPACE, useTheme } from '@/theme';
import type { IconComponent } from './icon';
import { cardSurface } from './surface';
import { Text } from '@/ui/AppText';

export interface StatTileProps {
  readonly value: number | string;
  readonly label: string;
  /** Solid color of the mark. Omit for an empty ring (a state with no color of its own). */
  readonly color?: string;
  readonly icon?: IconComponent;
  /** Icon color on the mark. */
  readonly ink?: string;
}

export function StatTile({ icon: Icon, value, label, color, ink }: StatTileProps) {
  const t = useTheme();
  return (
    <View style={[styles.root, cardSurface(t)]} accessible accessibilityRole="text" accessibilityLabel={`${label}: ${value}`}>
      <View style={[styles.mark, color ? { backgroundColor: color } : { borderWidth: 2.5, borderColor: t.color.borderStrong }]}>
        {Icon ? <Icon size={16} color={ink ?? t.color.iconOnSignal} /> : null}
      </View>
      <Text style={[styles.value, { color: t.color.text }]}>{value}</Text>
      <Text numberOfLines={1} style={[styles.label, { color: t.color.textMuted }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingVertical: SPACE.s2 + 4, paddingHorizontal: SPACE.s1, alignItems: 'center' },
  mark: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: SPACE.s1 + 2 },
  value: { fontSize: FONT_SIZE.xl, lineHeight: 28, fontWeight: '800', fontVariant: ['tabular-nums'] },
  label: { fontSize: 13, fontWeight: '700' },
});
