/** TaskIcon — a colored circle with a white icon. The only task icon style (D14). */
import { StyleSheet, View } from 'react-native';

import { RADIUS, useTheme } from '@/theme';
import type { IconComponent } from './icon';

export interface TaskIconProps {
  readonly icon: IconComponent;
  /** Circle color. Defaults to the app accent. */
  readonly color?: string | null;
  readonly size?: number;
  /** Muted (grey) rendering for unavailable items. */
  readonly muted?: boolean;
}

export function TaskIcon({ icon: Icon, color, size = 40, muted = false }: TaskIconProps) {
  const t = useTheme();
  return (
    <View style={[styles.root, { width: size, height: size, backgroundColor: muted ? t.color.off : (color ?? t.accent.fill) }]}>
      {/* A task's own color takes a white icon; the theme color takes whatever reads on it. */}
      <Icon size={Math.round(size * 0.5)} color={color || muted ? t.color.textOnAccent : t.accent.onLarge} />
    </View>
  );
}

const styles = StyleSheet.create({ root: { borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center' } });
