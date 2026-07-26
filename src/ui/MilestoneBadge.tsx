/**
 * M0 kit — Fallback-custom `MilestoneBadge`. The one celebratory-gold surface in the kit
 * (S27–S30 only) — gold is one of the tokens.ts signal colours, so Rule 4 applies here too:
 * the fill stays icon-only, the badge's name sits below it as a caption on the neutral
 * background, never printed over the fill. Locked badges render calm and non-punitive —
 * never implying a breakable run of consecutive days (MODULES.md non-negotiable: that
 * banned word itself never appears anywhere in this kit — names, props, comments or labels).
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Award, Lock } from 'lucide-react-native';

import { RADIUS, SPACE, useTheme } from '@/theme';

export interface MilestoneBadgeProps {
  readonly label: string;
  readonly earned: boolean;
  readonly onPress?: () => void;
  readonly accessibilityLabel?: string;
  readonly testID?: string;
}

export function MilestoneBadge({ label, earned, onPress, accessibilityLabel, testID }: MilestoneBadgeProps) {
  const t = useTheme();
  const content = (
    <View style={styles.column}>
      <View
        style={[
          styles.pill,
          { backgroundColor: earned ? t.color.celebrationGold : t.color.surface, borderColor: earned ? t.color.celebrationGold : t.color.border, borderWidth: earned ? 0 : 1 },
        ]}
      >
        {earned ? <Award size={20} color={t.color.iconOnSignal} /> : <Lock size={18} color={t.color.textDim} />}
      </View>
      <Text style={[styles.label, { color: earned ? t.color.text : t.color.textMuted }]} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );

  if (!onPress) {
    return (
      <View accessible accessibilityRole="text" accessibilityLabel={accessibilityLabel ?? `${label}, ${earned ? 'earned' : 'locked'}`} testID={testID}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `${label}, ${earned ? 'earned' : 'locked'}`}
      testID={testID}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  column: { alignItems: 'center', gap: SPACE.s1, width: 84 },
  pill: { width: 48, height: 48, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
});
