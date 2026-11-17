/**
 * M1. S01's calm loading indicator — "a thin indeterminate bar ... Decision: use an
 * indeterminate bar." Degrades to a static opacity-pulsed block under reduced motion
 * (Rule 13), mirroring `Skeleton`'s reduced-motion handling.
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';

import { RADIUS, useTheme } from '@/theme';

const BAR_WIDTH_FRACTION = 0.35;

export function IndeterminateBar() {
  const t = useTheme();
  const [progress] = useState(() => new Animated.Value(0));
  const [pulse] = useState(() => new Animated.Value(0.5));

  useEffect(() => {
    let loop: Animated.CompositeAnimation | undefined;
    // The preference is read asynchronously: if the bar unmounts first, do not start a loop nobody can stop.
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled) return;
      if (reduced) {
        loop = Animated.loop(
          Animated.sequence([
            Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
            Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
          ]),
        );
        loop.start();
        return;
      }
      loop = Animated.loop(
        Animated.timing(progress, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      );
      loop.start();
    });
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [progress, pulse]);

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [-1, 1] });

  return (
    <View
      style={[styles.track, { backgroundColor: t.color.surface }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View
        style={[
          styles.fill,
          {
            backgroundColor: t.accent.base,
            width: `${BAR_WIDTH_FRACTION * 100}%`,
            opacity: pulse,
            transform: [{ translateX: translateX.interpolate({ inputRange: [-1, 1], outputRange: ['-100%', '300%'] }) }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '60%', height: 4, borderRadius: RADIUS.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: RADIUS.pill },
});
