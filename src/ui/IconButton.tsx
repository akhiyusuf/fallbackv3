/** M0 kit — Verdant `IconButton`. Ghost by default (header/toolbar glyphs); `accent` for the FAB. */
import { Pressable, StyleSheet, View } from 'react-native';

import { MIN_TAP_TARGET, RADIUS, useTheme } from '@/theme';
import type { IconComponent } from './icon';

export interface IconButtonProps {
  readonly icon: IconComponent;
  readonly onPress: () => void;
  readonly accessibilityLabel: string;
  readonly variant?: 'ghost' | 'accent' | 'danger';
  readonly disabled?: boolean;
  readonly size?: number;
  readonly testID?: string;
}

export function IconButton({ icon: Icon, onPress, accessibilityLabel, variant = 'ghost', disabled = false, size = 22, testID }: IconButtonProps) {
  const t = useTheme();
  const bg = variant === 'accent' ? t.accent.base : variant === 'danger' ? t.color.danger : 'transparent';
  const shadow = variant === 'accent' ? t.accent.deep : variant === 'danger' ? t.color.dangerDeep : undefined;
  const iconColor = variant === 'ghost' ? t.color.textMuted : t.color.iconOnSignal;

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      testID={testID}
      hitSlop={8}
      style={shadow ? [styles.shadowWrap, { backgroundColor: shadow }] : undefined}
    >
      {({ pressed }) => (
        <View
          style={[styles.face, { backgroundColor: bg, marginBottom: shadow ? (pressed ? 0 : 3) : 0 }, disabled && styles.disabled]}
        >
          <Icon size={size} color={iconColor} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shadowWrap: { borderRadius: RADIUS.pill },
  face: {
    minWidth: MIN_TAP_TARGET,
    minHeight: MIN_TAP_TARGET,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.5 },
});
