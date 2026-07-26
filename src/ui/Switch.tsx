/** M0 kit — Verdant `Switch`. Pill track + knob, `--ease-tactile` overshoot on toggle. */
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet } from 'react-native';

import { MIN_TAP_TARGET, MOTION, RADIUS, useTheme } from '@/theme';

export interface SwitchProps {
  readonly value: boolean;
  readonly onValueChange: (value: boolean) => void;
  readonly disabled?: boolean;
  readonly accessibilityLabel: string;
  readonly testID?: string;
}

const TRACK_WIDTH = 48;
const TRACK_HEIGHT = 28;
const KNOB_SIZE = 22;
const KNOB_INSET = 3;

export function Switch({ value, onValueChange, disabled = false, accessibilityLabel, testID }: SwitchProps) {
  const t = useTheme();
  const progress = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: value ? 1 : 0,
      duration: MOTION.durBase,
      easing: Easing.bezier(0.34, 1.56, 0.64, 1),
      useNativeDriver: false,
    });
    animation.start();
    // Stop on unmount/re-toggle so a pending timer never fires a `setState` after the
    // component (or, under Jest, the whole test) has already torn down.
    return () => animation.stop();
  }, [value, progress]);

  const trackColor = progress.interpolate({ inputRange: [0, 1], outputRange: [t.color.border, t.accent.base] });
  const knobTranslate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [KNOB_INSET, TRACK_WIDTH - KNOB_SIZE - KNOB_INSET],
  });

  return (
    <Pressable
      onPress={() => !disabled && onValueChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      testID={testID}
      hitSlop={8}
      style={[styles.hitArea, disabled && styles.disabled]}
    >
      <Animated.View style={[styles.track, { backgroundColor: trackColor }]}>
        <Animated.View style={[styles.knob, { backgroundColor: t.color.bg, transform: [{ translateX: knobTranslate }] }]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hitArea: { minWidth: MIN_TAP_TARGET, minHeight: MIN_TAP_TARGET, alignItems: 'center', justifyContent: 'center' },
  track: { width: TRACK_WIDTH, height: TRACK_HEIGHT, borderRadius: RADIUS.pill, justifyContent: 'center' },
  knob: { width: KNOB_SIZE, height: KNOB_SIZE, borderRadius: KNOB_SIZE / 2, position: 'absolute' },
  disabled: { opacity: 0.5 },
});
