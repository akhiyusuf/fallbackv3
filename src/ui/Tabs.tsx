/**
 * Tabs — the segmented bar (D9). The one control for picking 1 of 2–4
 * options, whether it filters a list or sets a form value.
 */
import { Pressable, StyleSheet, View } from 'react-native';

import { play } from '@/services/sfx';
import { FONT_SIZE, RADIUS, useTheme } from '@/theme';
import { Text } from '@/ui/AppText';

export interface TabItem {
  readonly value: string;
  readonly label: string;
}

export interface TabsProps {
  readonly items: readonly TabItem[];
  readonly value: string | null;
  readonly onChange: (value: string) => void;
  readonly accessibilityLabel: string;
  readonly disabled?: boolean;
  readonly testID?: string;
}

export function Tabs({ items, value, onChange, accessibilityLabel, disabled = false, testID }: TabsProps) {
  const t = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: t.color.surface }, disabled && styles.disabled]} accessibilityRole="tablist" accessibilityLabel={accessibilityLabel} testID={testID}>
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <Pressable
            key={item.value}
            onPress={
              disabled
                ? undefined
                : () => {
                    if (item.value !== value) play('tap');
                    onChange(item.value);
                  }
            }
            disabled={disabled}
            accessibilityRole="tab"
            accessibilityState={{ selected, disabled }}
            accessibilityLabel={item.label}
            style={[styles.tab, selected && { backgroundColor: t.color.bgAlt, borderColor: t.color.border }]}
          >
            <Text numberOfLines={1} style={[styles.label, { color: selected ? t.color.text : t.color.textMuted, fontWeight: selected ? '700' : '500' }]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', borderRadius: RADIUS.md, padding: 4, gap: 4, minHeight: 44 },
  tab: { flex: 1, paddingHorizontal: 4, borderRadius: RADIUS.sm, alignItems: 'center', minHeight: 36, justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },
  label: { fontSize: FONT_SIZE.sm },
  disabled: { opacity: 0.5 },
});
