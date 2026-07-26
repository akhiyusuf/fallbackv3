/** M0 kit — Fallback-custom `Skeleton`. Calm shimmer placeholder; static block under reduced motion. */
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, type StyleProp, type ViewStyle } from 'react-native';

import { RADIUS, useTheme } from '@/theme';

export interface SkeletonProps {
  readonly width?: number | `${number}%`;
  readonly height?: number;
  readonly radius?: number;
  readonly style?: StyleProp<ViewStyle>;
  readonly accessibilityLabel?: string;
}

export function Skeleton({ width = '100%', height = 16, radius = RADIUS.sm, style, accessibilityLabel = 'Loading' }: SkeletonProps) {
  const t = useTheme();
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    let loop: Animated.CompositeAnimation | undefined;
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (reduced) {
        opacity.setValue(0.6);
        return;
      }
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
        ]),
      );
      loop.start();
    });
    return () => loop?.stop();
  }, [opacity]);

  return (
    <Animated.View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      style={[{ width, height, borderRadius: radius, backgroundColor: t.color.surface, opacity }, style]}
    />
  );
}
