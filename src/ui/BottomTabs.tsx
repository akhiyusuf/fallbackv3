/**
 * M0 kit — Fallback-custom `BottomTabs`. Presentational row (icon + label, accent-tinted
 * active state) matching the design's primary nav. `app/(tabs)/_layout.tsx` renders the
 * equivalent bar through expo-router's own `Tabs` (native gestures, back-swipe, etc.) styled
 * from the same tokens; this component is for any other surface that needs the identical look
 * without a real navigator underneath it (e.g. a mockup/mid-flow illustration).
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SPACE, useTheme } from '@/theme';
import type { IconComponent } from './icon';

export interface BottomTabsItem {
  readonly key: string;
  readonly label: string;
  readonly icon: IconComponent;
}

export interface BottomTabsProps {
  readonly items: readonly BottomTabsItem[];
  readonly activeKey: string;
  readonly onSelect: (key: string) => void;
  readonly testID?: string;
}

export function BottomTabs({ items, activeKey, onSelect, testID }: BottomTabsProps) {
  const t = useTheme();
  return (
    <View
      style={[styles.root, { backgroundColor: t.color.bg, borderTopColor: t.color.border }]}
      accessibilityRole="tablist"
      testID={testID}
    >
      {items.map((item) => {
        const active = item.key === activeKey;
        const Icon = item.icon;
        const color = active ? t.accent.base : t.color.textMuted;
        return (
          <Pressable
            key={item.key}
            onPress={() => onSelect(item.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={item.label}
            style={styles.tab}
          >
            <Icon size={22} color={color} />
            <Text style={[styles.label, { color }]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', borderTopWidth: 1, paddingTop: SPACE.s1, paddingBottom: SPACE.s2 },
  tab: { flex: 1, alignItems: 'center', gap: 2, minHeight: 44, justifyContent: 'center' },
  label: { fontSize: 11, fontWeight: '600' },
});
