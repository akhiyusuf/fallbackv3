/**
 * M5 — S28's confetti burst. This is the ONLY confetti surface in the app (MODULES.md
 * non-negotiable): fired once, only here. Purely decorative — every particle colour comes
 * from the accent + celebration-gold tokens, NEVER a signal colour (ideal/fallback/off are
 * reserved and never used decoratively). Degrades to a plain opacity cross-fade under OS
 * "reduce motion" (DESIGN.md Motion → Confetti).
 */
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

const PARTICLE_COUNT = 24;

interface Particle {
  readonly left: number;
  readonly delay: number;
  readonly duration: number;
  readonly color: string;
  readonly rotate: number;
}

export function Confetti() {
  const t = useTheme();
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (mounted) setReduceMotion(reduced);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion === null) return;
    Animated.timing(fadeIn, { toValue: 1, duration: reduceMotion ? 260 : 120, useNativeDriver: true }).start();
  }, [reduceMotion, fadeIn]);

  if (reduceMotion === null) return null;

  if (reduceMotion) {
    return (
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.reducedMotionFill, { backgroundColor: t.accent.soft, opacity: fadeIn }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
    );
  }

  const decorativeColors = [t.accent.base, t.accent.hover, t.color.celebrationGold, t.color.goldDeep];
  const particles: Particle[] = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    left: (i / PARTICLE_COUNT) * 100 + (i % 3) * 2,
    delay: (i % 6) * 60,
    duration: 1400 + (i % 5) * 140,
    color: decorativeColors[i % decorativeColors.length] as string,
    rotate: (i * 37) % 360,
  }));

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {particles.map((p, i) => (
        <ConfettiPiece key={i} particle={p} />
      ))}
    </View>
  );
}

function ConfettiPiece({ particle }: { particle: Particle }) {
  const fall = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fall, {
      toValue: 1,
      duration: particle.duration,
      delay: particle.delay,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [fall, particle.duration, particle.delay]);

  const translateY = fall.interpolate({ inputRange: [0, 1], outputRange: [-20, 640] });
  const opacity = fall.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] });
  const rotate = fall.interpolate({ inputRange: [0, 1], outputRange: [`${particle.rotate}deg`, `${particle.rotate + 360}deg`] });

  return (
    <Animated.View
      style={[
        styles.piece,
        {
          left: `${particle.left}%`,
          backgroundColor: particle.color,
          opacity,
          transform: [{ translateY }, { rotate }],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  piece: { position: 'absolute', top: 0, width: 8, height: 14, borderRadius: 2 },
  reducedMotionFill: { borderRadius: 0 },
});
