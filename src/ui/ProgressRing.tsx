/** M0 kit — Verdant `ProgressRing`. Accent-filled circular progress (recolors with accent, per S43). */
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useTheme } from '@/theme';
import { Text } from '@/ui/AppText';

export interface ProgressRingProps {
  /** 0–100. */
  readonly percent: number;
  readonly size?: number;
  readonly strokeWidth?: number;
  readonly label?: string;
  /** Color and size of the text inside the ring. */
  readonly labelColor?: string;
  readonly labelSize?: number;
  /** Arc color. Defaults to the theme color. */
  readonly color?: string;
  /** Track color and opacity. Defaults to the neutral surface. */
  readonly trackColor?: string;
  readonly trackOpacity?: number;
  readonly accessibilityLabel: string;
}

export function ProgressRing({ percent, size = 64, strokeWidth = 8, label, labelColor, labelSize, color, trackColor, trackOpacity = 1, accessibilityLabel }: ProgressRingProps) {
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
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={trackColor ?? t.color.surface} strokeOpacity={trackOpacity} strokeWidth={strokeWidth} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color ?? t.accent.base}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      {label ? <Text style={[styles.label, { color: labelColor ?? t.color.text }, labelSize ? { fontSize: labelSize } : null]}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center' },
  label: { position: 'absolute', fontSize: 14, fontWeight: '800', textAlign: 'center', fontVariant: ['tabular-nums'] },
});
