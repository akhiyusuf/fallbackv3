/** M0 kit — Verdant `Tabs`. Segmented switcher (scope/window switchers, browse Active/Past, etc). */
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { RADIUS, SPACE, useTheme } from '@/theme';

export interface TabItem {
  readonly value: string;
  readonly label: string;
}

export interface TabsProps {
  readonly items: readonly TabItem[];
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly accessibilityLabel: string;
  readonly testID?: string;
}

export function Tabs({ items, value, onChange, accessibilityLabel, testID }: TabsProps) {
  const t = useTheme();
  return (
    <View
      style={[styles.root, { backgroundColor: t.color.surface }]}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <Pressable
            key={item.value}
            onPress={() => onChange(item.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={item.label}
            style={[styles.tab, selected && { backgroundColor: t.color.bg }]}
          >
            <Text style={[styles.label, { color: selected ? t.color.text : t.color.textMuted, fontWeight: selected ? '700' : '500' }]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', borderRadius: RADIUS.pill, padding: 4, gap: 4 },
  tab: { flex: 1, paddingVertical: SPACE.s1, borderRadius: RADIUS.pill, alignItems: 'center', minHeight: 36, justifyContent: 'center' },
  label: { fontSize: 14 },
});
