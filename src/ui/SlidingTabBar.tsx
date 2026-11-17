/**
 * The app's bottom tab bar. One tinted pill sits behind the chosen tab and slides to the next one
 * when the person switches, with a small spring, instead of vanishing from one tab and appearing
 * on another. The icon of the tab being chosen gives a little lift as the pill arrives. Reduced
 * motion moves the pill without the glide.
 *
 * Used as the `tabBar` of `app/(tabs)/_layout.tsx`; it keeps the navigator's own behaviour
 * (the press event, not reopening the tab you are on, long press).
 */
import { useEffect, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';

import { useTheme } from '@/theme';
import { Text } from '@/ui/AppText';
import { PRIMARY_NAV_ITEMS } from './BottomTabs';
import { useReduceMotion } from './motion';

const PILL_WIDTH = 56;
const PILL_HEIGHT = 30;
const BAR_HEIGHT = 68;

function TabIcon({ routeName, focused, color, reduced }: { routeName: string; focused: boolean; color: string; reduced: boolean }) {
  const item = PRIMARY_NAV_ITEMS.find((i) => i.key === routeName);
  const lift = useState(() => new Animated.Value(focused ? 1 : 0))[0];
  useEffect(() => {
    if (reduced) {
      lift.setValue(focused ? 1 : 0);
      return;
    }
    Animated.spring(lift, { toValue: focused ? 1 : 0, friction: 6, tension: 120, useNativeDriver: true }).start();
  }, [focused, lift, reduced]);
  if (!item) return null;
  const Icon = item.icon;
  return (
    <Animated.View style={{ transform: [{ scale: lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }] }}>
      <Icon size={24} color={color} />
    </Animated.View>
  );
}

export function SlidingTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const t = useTheme();
  const reduced = useReduceMotion();
  const [width, setWidth] = useState(0);
  const count = state.routes.length;
  const slot = width > 0 ? width / count : 0;

  const position = useState(() => new Animated.Value(state.index))[0];
  useEffect(() => {
    if (reduced) position.setValue(state.index);
    else Animated.spring(position, { toValue: state.index, friction: 8, tension: 80, useNativeDriver: true }).start();
  }, [state.index, position, reduced]);

  return (
    <View
      style={[styles.bar, { backgroundColor: t.color.bgAlt, borderTopColor: t.color.border, height: BAR_HEIGHT + insets.bottom, paddingBottom: 6 + insets.bottom }]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {slot > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pill,
            {
              backgroundColor: t.accent.soft,
              transform: [{ translateX: Animated.add(Animated.multiply(position, slot), (slot - PILL_WIDTH) / 2) }],
            },
          ]}
        />
      ) : null}
      {state.routes.map((route, i) => {
        const options = descriptors[route.key]?.options ?? {};
        const focused = state.index === i;
        const label = typeof options.title === 'string' ? options.title : route.name;
        const color = focused ? t.accent.text : t.color.textMuted;
        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
        };
        const onLongPress = () => navigation.emit({ type: 'tabLongPress', target: route.key });
        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            onLongPress={onLongPress}
            accessibilityRole={Platform.OS === 'web' ? 'link' : 'tab'}
            accessibilityState={{ selected: focused }}
            accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
            testID={options.tabBarButtonTestID}
            style={styles.item}
          >
            <View style={styles.iconBox}>
              <TabIcon routeName={route.name} focused={focused} color={color} reduced={reduced} />
            </View>
            <Text numberOfLines={1} style={[styles.label, { color }]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 4 },
  pill: { position: 'absolute', top: 4, left: 0, width: PILL_WIDTH, height: PILL_HEIGHT, borderRadius: 999 },
  item: { flex: 1, alignItems: 'center', justifyContent: 'flex-start' },
  iconBox: { height: PILL_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 12, fontWeight: '600', lineHeight: 16, marginTop: 1 },
});
