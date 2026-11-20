/**
 * M0 kit — Fallback-custom `MilestoneBadge`. The one celebratory-gold surface in the kit
 * (S27–S30 only) — gold is one of the tokens.ts signal colors, so Rule 4 applies here too:
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
import { Pressable, StyleSheet, View } from 'react-native';
import { Lock } from 'lucide-react-native';

import { INK, mix, RADIUS, SPACE, useTheme } from '@/theme';
import type { IconComponent } from './icon';
import { Text } from '@/ui/AppText';

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
          earned
            ? { backgroundColor: t.color.celebrationGold, borderColor: t.color.celebrationGold, borderBottomColor: mix(t.color.celebrationGold, INK, 0.28), borderBottomWidth: 5 }
            : { backgroundColor: t.color.surface, borderColor: t.color.border, marginTop: 3 },
        ]}
      >
        {earned ? <Icon size={26} color={INK} /> : <Lock size={20} color={t.color.textMuted} />}
      </View>
      <Text numberOfLines={2} style={[styles.label, { color: earned ? t.color.text : t.color.textMuted }]}>{label}</Text>
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
  column: { alignItems: 'center', gap: SPACE.s1 },
  pill: { width: 60, height: 60, borderRadius: RADIUS.pill, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
});
