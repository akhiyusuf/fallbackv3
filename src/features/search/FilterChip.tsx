/** M3. S14's multi-select filter chip — a fixed-vocabulary one-tap toggle, never free-form. */
import { Pressable, StyleSheet, Text } from 'react-native';

import { MIN_TAP_TARGET, RADIUS, SPACE, useTheme } from '@/theme';

export function FilterChip({ label, selected, onToggle }: { label: string; selected: boolean; onToggle: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      style={[
        styles.chip,
        { backgroundColor: selected ? t.accent.base : t.color.bg, borderColor: selected ? t.accent.base : t.color.border },
      ]}
    >
      <Text style={[styles.label, { color: selected ? t.color.textOnAccent : t.color.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { minHeight: MIN_TAP_TARGET, paddingHorizontal: SPACE.s2, borderRadius: RADIUS.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 14, fontWeight: '600' },
});
