/**
 * M0 kit — Verdant `Card`. Flat, border-only document surface (readme.md "Cards"):
 * `bg-alt` fill, 1px border, radius 12. Never a tactile shadow — that's reserved for
 * pressable controls (Button/exercise tiles).
 */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { RADIUS, SPACE, useTheme } from '@/theme';

export interface CardProps {
  readonly children: ReactNode;
  readonly onPress?: () => void;
  readonly accessibilityLabel?: string;
  readonly accessibilityRole?: 'button' | 'summary' | 'none';
  readonly accessibilityHint?: string;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
  /** S27's "corner slot" — reserved for the celebration-gold treatment, never used from a browse/list card. */
  readonly corner?: ReactNode;
}

export function Card({ children, onPress, accessibilityLabel, accessibilityRole, accessibilityHint, style, testID, corner }: CardProps) {
  const t = useTheme();
  const base: StyleProp<ViewStyle> = [
    styles.root,
    { backgroundColor: t.color.bgAlt, borderColor: t.color.border },
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole={accessibilityRole ?? 'button'}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        testID={testID}
        style={({ pressed }) => [base, pressed && { backgroundColor: t.color.surface, borderColor: t.color.borderStrong }]}
      >
        {children}
        {corner ? <View style={styles.corner}>{corner}</View> : null}
      </Pressable>
    );
  }

  return (
    <View
      style={base}
      accessible={!!accessibilityLabel}
      accessibilityRole={accessibilityRole ?? 'none'}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      {children}
      {corner ? <View style={styles.corner}>{corner}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { borderWidth: 1, borderRadius: RADIUS.md, padding: SPACE.s3, gap: SPACE.s2 },
  corner: { position: 'absolute', top: SPACE.s1, right: SPACE.s1 },
});
