/** M0 kit — Verdant `ProgressRing`. Accent-filled circular progress (recolors with accent, per S43). */
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useTheme } from '@/theme';

export interface ProgressRingProps {
  /** 0–100. */
  readonly percent: number;
  readonly size?: number;
  readonly strokeWidth?: number;
  readonly label?: string;
  readonly accessibilityLabel: string;
}

export function ProgressRing({ percent, size = 64, strokeWidth = 8, label, accessibilityLabel }: ProgressRingProps) {
  const t = useTheme();
  const clamped = Math.max(0, Math.min(100, percent));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - clamped / 100);

  return (
    <View
      style={[styles.root, { width: size, height: size }]}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: clamped }}
    >
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={t.color.surface} strokeWidth={strokeWidth} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={t.accent.base}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      {label ? <Text style={[styles.label, { color: t.color.text }]}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center' },
  label: { position: 'absolute', fontSize: 14, fontWeight: '700', textAlign: 'center' },
});
