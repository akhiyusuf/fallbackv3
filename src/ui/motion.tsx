/**
 * Motion — small, physical feedback. Buttons press down (see `pressedSurface`), a tick pops
 * in, a bar fills, and logging the ideal throws a small burst. Everything here is skipped
 * when the OS asks for reduced motion.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

export function useReduceMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) setReduced(v);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return reduced;
}

/** Scales its child in with a small overshoot whenever `trigger` changes to a truthy value. */
export function PopIn({ trigger, children, style, from = 0.4 }: { readonly trigger: unknown; readonly children: ReactNode; readonly style?: StyleProp<ViewStyle>; readonly from?: number }) {
  const reduced = useReduceMotion();
  const scale = useState(() => new Animated.Value(1))[0];
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!trigger || reduced) return;
    scale.setValue(from);
    Animated.spring(scale, { toValue: 1, damping: 9, stiffness: 240, mass: 0.7, useNativeDriver: true }).start();
  }, [trigger, reduced, scale, from]);
  return <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>;
}

const PIECES = [
  [-38, -34], [34, -40], [-52, 4], [50, -6], [-18, -54], [20, 36], [-42, 32], [8, -60], [56, 26], [-60, -22],
] as const;

/** A small burst of pieces from its centre, once, each time `fire` increases. Decorative only. */
export function Burst({ fire, colors }: { readonly fire: number; readonly colors: readonly string[] }) {
  const reduced = useReduceMotion();
  const progress = useState(() => new Animated.Value(1))[0];
  useEffect(() => {
    if (fire <= 0 || reduced) return;
    progress.setValue(0);
    Animated.timing(progress, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [fire, reduced, progress]);
  // Nothing to draw until the first burst; after one, the pieces rest at zero opacity.
  if (fire <= 0 || reduced) return null;
  return (
    <View pointerEvents="none" style={styles.burst} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {PIECES.map(([dx, dy], i) => (
        <Animated.View
          key={i}
          style={[
            styles.piece,
            {
              backgroundColor: colors[i % colors.length],
              opacity: progress.interpolate({ inputRange: [0, 0.1, 0.7, 1], outputRange: [0, 1, 1, 0] }),
              transform: [
                { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, dx] }) },
                { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, dy] }) },
                { rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${(i % 2 ? 1 : -1) * (140 + i * 24)}deg`] }) },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  burst: { position: 'absolute', left: '50%', top: '50%', width: 0, height: 0, zIndex: 5 },
  piece: { position: 'absolute', width: 7, height: 10, borderRadius: 2 },
});
