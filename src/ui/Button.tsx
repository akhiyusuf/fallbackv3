/**
 * M0 kit — Verdant `Button`. Tactile bottom-shadow press affordance (readme.md
 * "Depth / elevation", mode 2): a solid-colour shadow layer sits under the face; pressing
 * collapses the gap between them. `ghost` is flat — no shadow, text-only.
 */
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { MIN_TAP_TARGET, RADIUS, SPACE, useTheme } from '@/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: ButtonVariant;
  readonly disabled?: boolean;
  readonly loading?: boolean;
  readonly icon?: ReactNode;
  readonly accessibilityLabel?: string;
  readonly accessibilityHint?: string;
  readonly testID?: string;
  readonly fullWidth?: boolean;
}

const SHADOW_OFFSET = 4;

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  icon,
  accessibilityLabel,
  accessibilityHint,
  testID,
  fullWidth = false,
}: ButtonProps) {
  const t = useTheme();
  const isInert = disabled || loading;

  const tactile = variant === 'primary' || variant === 'secondary' || variant === 'danger';
  const faceColor =
    variant === 'primary' ? t.accent.base : variant === 'danger' ? t.color.danger : variant === 'secondary' ? t.color.bgAlt : 'transparent';
  const shadowColor = variant === 'primary' ? t.accent.deep : variant === 'danger' ? t.color.dangerDeep : t.color.borderStrong;
  const textColor = variant === 'primary' || variant === 'danger' ? t.color.textOnAccent : variant === 'secondary' ? t.color.text : t.accent.base;

  return (
    <Pressable
      onPress={isInert ? undefined : onPress}
      disabled={isInert}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isInert, busy: loading }}
      testID={testID}
      style={[
        tactile ? { backgroundColor: shadowColor, borderRadius: RADIUS.lg } : styles.ghostOuter,
        fullWidth && styles.fullWidth,
        isInert && styles.inert,
      ]}
    >
      {({ pressed }) => (
        <View
          style={[
            styles.face,
            {
              backgroundColor: faceColor,
              borderRadius: RADIUS.lg,
              marginBottom: tactile ? (pressed ? 0 : SHADOW_OFFSET) : 0,
              borderWidth: variant === 'secondary' ? 1 : 0,
              borderColor: t.color.borderStrong,
            },
          ]}
        >
          {loading ? (
            <ActivityIndicator color={textColor} accessibilityLabel="Loading" />
          ) : (
            <>
              {icon}
              <Text style={[styles.label, { color: textColor }]}>{label}</Text>
            </>
          )}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  face: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.s1,
    paddingVertical: SPACE.s2,
    paddingHorizontal: SPACE.s3,
    minHeight: MIN_TAP_TARGET,
  },
  ghostOuter: { borderRadius: RADIUS.lg },
  fullWidth: { alignSelf: 'stretch' },
  inert: { opacity: 0.5 },
  label: { fontSize: 16, fontWeight: '600' },
});
