/**
 * M0 kit — Fallback-custom `ConsistencyRing`. A computed-statistic ring (F5's %), distinct
 * from `ProgressRing` (a CTA/progress-toward-goal control, accent-filled): this ring is
 * rendered in the neutral text colour, never the accent, since it is not something to
 * "complete." `percent === null` renders the no-data dash, never a fabricated 0%.
 */
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useTheme } from '@/theme';

export interface ConsistencyRingProps {
  readonly percent: number | null;
  readonly size?: number;
  readonly strokeWidth?: number;
  readonly accessibilityLabel: string;
}

export function ConsistencyRing({ percent, size = 72, strokeWidth = 8, accessibilityLabel }: ConsistencyRingProps) {
  const t = useTheme();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = percent === null ? circumference : circumference * (1 - percent / 100);

  return (
    <View
      style={[styles.root, { width: size, height: size }]}
      accessibilityRole="text"
      accessibilityLabel={percent === null ? `${accessibilityLabel}, no data yet` : `${accessibilityLabel}, ${percent} percent`}
    >
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={t.color.surface} strokeWidth={strokeWidth} fill="none" />
        {percent !== null ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={t.color.text}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            rotation={-90}
            origin={`${size / 2}, ${size / 2}`}
          />
        ) : null}
      </Svg>
      <Text style={[styles.label, { color: percent === null ? t.color.textDim : t.color.text }]}>{percent === null ? '—' : `${percent}%`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center' },
  label: { position: 'absolute', fontSize: 16, fontWeight: '700' },
});
