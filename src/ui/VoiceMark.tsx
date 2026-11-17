/**
 * VoiceMark — Fallback AI's mark: a four-point star with a sound wave inside it. The star says
 * "assistant", the wave says "talk to it". `live` makes the wave move (the listening orb);
 * it stays still when the OS asks for reduced motion.
 */
import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '@/theme';
import { useReduceMotion } from './motion';

const STAR = 'M50 0 Q62 38 100 50 Q62 62 50 100 Q38 62 0 50 Q38 38 50 0Z';
/** Bar heights as a share of the star's size, centre tallest. */
const BARS = [0.13, 0.24, 0.36, 0.24, 0.13] as const;

export interface VoiceMarkProps {
  readonly size?: number;
  /** Star colour. Defaults to the theme's bright fill. */
  readonly fill?: string;
  /** Wave colour. Defaults to the theme's large-text colour for that fill. */
  readonly wave?: string;
  readonly live?: boolean;
}

export function VoiceMark({ size = 40, fill, wave, live = false }: VoiceMarkProps) {
  const t = useTheme();
  const reduced = useReduceMotion();
  const phase = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    if (!live || reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(phase, { toValue: 1, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(phase, { toValue: 0, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [live, reduced, phase]);
  const barW = Math.max(2, Math.round(size * 0.055));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
        <Path d={STAR} fill={fill ?? t.accent.fill} />
      </Svg>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Math.max(1.5, size * 0.035) }}>
        {BARS.map((h, i) => (
          <Animated.View
            key={i}
            style={{
              width: barW,
              height: Math.round(size * h),
              borderRadius: barW,
              backgroundColor: wave ?? t.accent.onLarge,
              transform: [{ scaleY: live ? phase.interpolate({ inputRange: [0, 1], outputRange: i % 2 ? [1, 0.55] : [0.6, 1.1] }) : 1 }],
            }}
          />
        ))}
      </View>
    </View>
  );
}
