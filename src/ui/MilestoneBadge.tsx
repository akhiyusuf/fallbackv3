/**
 * M0 kit — Fallback-custom `MilestoneBadge`. The one celebratory-gold surface in the kit
 * (S27–S30 only) — gold is one of the tokens.ts signal colours, so Rule 4 applies here too:
 * the fill stays icon-only, the badge's name sits below it as a caption on the neutral
 * background, never printed over the fill. Locked badges render calm and non-punitive —
 * never implying a breakable run of consecutive days (MODULES.md non-negotiable: that
 * banned word itself never appears anywhere in this kit — names, props, comments or labels).
 *
 * Earned/locked treatment transcribed from the approved S27 badge grid
 * (`design-input/Fallback Handoff (standalone).html`, ~byte offset 905541): earned =
 * `--gold-soft` fill + 2px `--celebration-gold` border + a **per-badge** icon in
 * `--gold-deep` (e.g. `sunrise` for "7 days", `calendar-check` for "30 days") — never a
 * single hardcoded glyph, hence the required `icon` prop. Locked = `--surface` + 2px
 * `--border` + `lock` in `--text-dim`.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Lock } from 'lucide-react-native';

import { RADIUS, SPACE, useTheme } from '@/theme';
import type { IconComponent } from './icon';

export interface MilestoneBadgeProps {
  readonly label: string;
  readonly earned: boolean;
  /** The badge's own glyph (e.g. `Sunrise` for "7 days", `CalendarCheck` for "30 days") — rendered in `goldDeep` when earned. Locked always shows `Lock`, per the approved design. */
  readonly icon: IconComponent;
  readonly onPress?: () => void;
  readonly accessibilityLabel?: string;
  readonly testID?: string;
}

export function MilestoneBadge({ label, earned, icon: Icon, onPress, accessibilityLabel, testID }: MilestoneBadgeProps) {
  const t = useTheme();
  const content = (
    <View style={styles.column}>
      <View
        style={[
          styles.pill,
          { backgroundColor: earned ? t.color.goldSoft : t.color.surface, borderColor: earned ? t.color.celebrationGold : t.color.border },
        ]}
      >
        {earned ? <Icon size={24} color={t.color.goldDeep} /> : <Lock size={20} color={t.color.textDim} />}
      </View>
      <Text style={[styles.label, { color: earned ? t.color.text : t.color.textMuted }]}>{label}</Text>
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
  column: { alignItems: 'center', gap: SPACE.s1, minWidth: 84 },
  pill: { width: 54, height: 54, borderRadius: RADIUS.pill, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
});
