/**
 * Tabs — the segmented bar (D9). The one control for picking 1 of 2–4
 * options, whether it filters a list or sets a form value.
 *
 * The highlight is one piece that slides to the chosen option, and it can be dragged: put a finger
 * on the bar and slide across, and the highlight follows and settles on the option it is let go
 * over. A plain tap still picks an option. Reduced motion moves it without the glide.
 */
import { useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { FONT_SIZE, RADIUS, useTheme } from '@/theme';
import { Text } from '@/ui/AppText';
import { useReduceMotion } from './motion';

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

const PAD = 4;
const GAP = 4;

export function Tabs({ items, value, onChange, accessibilityLabel, disabled = false, testID }: TabsProps) {
  const t = useTheme();
  const reduced = useReduceMotion();
  const [width, setWidth] = useState(0);
  const index = items.findIndex((item) => item.value === value);
  const count = Math.max(1, items.length);
  const slot = width > 0 ? (width - PAD * 2 - GAP * (count - 1)) / count : 0;
  const step = slot + GAP;

  // Where the highlight sits, in slots (0 = first option). Fractions while it moves or is dragged.
  const position = useState(() => new Animated.Value(Math.max(0, index)))[0];
  const dragging = useRef(false);
  useEffect(() => {
    if (index < 0 || dragging.current) return;
    if (reduced) position.setValue(index);
    else Animated.spring(position, { toValue: index, friction: 9, tension: 90, useNativeDriver: true }).start();
  }, [index, position, reduced]);

  // The latest values, read by the drag handlers (made once).
  const live = useRef({ items, index, step, onChange, disabled });
  useEffect(() => {
    live.current = { items, index, step, onChange, disabled };
  });
  const startAt = useRef(0);
  // The handlers read the refs only when a finger moves, never while rendering.
  // eslint-disable-next-line react-hooks/refs
  const responder = useState(() =>
    PanResponder.create({
      // Only a sideways slide takes over; a tap stays with the option under the finger.
      onMoveShouldSetPanResponder: (_e, g) => !live.current.disabled && live.current.step > 0 && Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: () => {
        dragging.current = true;
        startAt.current = Math.max(0, live.current.index);
        position.stopAnimation();
      },
      onPanResponderMove: (_e, g) => {
        const { items: list, step: s } = live.current;
        const next = Math.min(list.length - 1, Math.max(0, startAt.current + g.dx / s));
        position.setValue(next);
      },
      onPanResponderRelease: (_e, g) => {
        dragging.current = false;
        const { items: list, step: s, onChange: change, index: current } = live.current;
        const target = Math.min(list.length - 1, Math.max(0, Math.round(startAt.current + g.dx / s)));
        Animated.spring(position, { toValue: target, friction: 9, tension: 90, useNativeDriver: true }).start();
        if (target !== current && list[target]) change(list[target].value);
      },
      onPanResponderTerminate: () => {
        dragging.current = false;
        Animated.spring(position, { toValue: Math.max(0, live.current.index), friction: 9, tension: 90, useNativeDriver: true }).start();
      },
    }),
  )[0];

  function onLayout(e: LayoutChangeEvent) {
    setWidth(e.nativeEvent.layout.width);
  }

  const measured = slot > 0;
  return (
    <View
      style={[styles.root, { backgroundColor: t.color.surface }, disabled && styles.disabled]}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      onLayout={onLayout}
      {...responder.panHandlers}
    >
      {measured && index >= 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.thumb,
            {
              width: slot,
              backgroundColor: t.color.bgAlt,
              borderColor: t.color.border,
              // Kept inside the bar: the spring may overshoot the last option, the highlight never does.
              transform: [{ translateX: position.interpolate({ inputRange: [0, Math.max(1, count - 1)], outputRange: [0, Math.max(1, count - 1) * step], extrapolate: 'clamp' }) }],
            },
          ]}
        />
      ) : null}
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <Pressable
            key={item.value}
            onPress={disabled ? undefined : () => onChange(item.value)}
            disabled={disabled}
            accessibilityRole="tab"
            accessibilityState={{ selected, disabled }}
            accessibilityLabel={item.label}
            // The tab is 36 tall inside a 44 bar: the slop makes its touch target 44.
            hitSlop={{ top: 4, bottom: 4 }}
            // Before the bar has measured itself the chosen option draws its own highlight.
            style={[styles.tab, selected && !measured && { backgroundColor: t.color.bgAlt, borderColor: t.color.border }]}
          >
            <Text numberOfLines={2} style={[styles.label, { color: selected ? t.color.text : t.color.textMuted, fontWeight: selected ? '700' : '500' }]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', borderRadius: RADIUS.md, padding: PAD, gap: GAP, minHeight: 44 },
  thumb: { position: 'absolute', top: PAD, bottom: PAD, left: PAD, borderRadius: RADIUS.sm, borderWidth: 1 },
  tab: { flex: 1, paddingHorizontal: 4, borderRadius: RADIUS.sm, alignItems: 'center', minHeight: 36, justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },
  label: { fontSize: FONT_SIZE.sm },
  disabled: { opacity: 0.5 },
});
