/**
 * StatHero — the one block of solid theme color on a screen: the number that matters.
 * Text on the bright color is large and bold (white reads at 3:1 or better there); the small
 * line sits on a deeper band of the same color where white reads at 4.5:1.
 */
import { Pressable, StyleSheet, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

import { FONT_SIZE, RADIUS, SPACE, useTheme } from '@/theme';
import { ProgressRing, Skeleton } from '@/ui';
import { Text } from '@/ui/AppText';

export interface StatHeroProps {
  readonly percent: number | null;
  readonly loading?: boolean;
  readonly label: string;
  readonly detail: string;
  readonly detailLines?: number;
  readonly onPress?: () => void;
  readonly accessibilityLabel: string;
}

export function StatHero({ percent, loading = false, label, detail, detailLines = 1, onPress, accessibilityLabel }: StatHeroProps) {
  const t = useTheme();
  if (loading) return <Skeleton height={148} radius={RADIUS.xl} />;
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={[styles.card, { backgroundColor: t.accent.fill }]}>
      <View style={styles.top}>
        <ProgressRing
          percent={percent ?? 0}
          size={76}
          strokeWidth={8}
          label={percent === null ? '–' : `${percent}%`}
          labelColor={t.accent.onLarge}
          labelSize={20}
          color={t.accent.onLarge}
          trackColor={t.accent.onLarge}
          trackOpacity={0.3}
          accessibilityLabel={accessibilityLabel}
        />
        <Text numberOfLines={2} style={[styles.label, { color: t.accent.onLarge }]}>
          {label}
        </Text>
      </View>
      <View style={[styles.band, { backgroundColor: t.accent.band }]}>
        <Text numberOfLines={detailLines} style={[styles.detail, { color: t.accent.onBand }]}>
          {detail}
        </Text>
        {onPress ? <ChevronRight size={18} color={t.accent.onBand} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: RADIUS.xl, overflow: 'hidden' },
  top: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s3, paddingHorizontal: SPACE.s3, paddingTop: SPACE.s3, paddingBottom: SPACE.s3 },
  label: { flex: 1, fontSize: FONT_SIZE.xl, lineHeight: 28, fontWeight: '800' },
  band: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.s2, paddingHorizontal: SPACE.s3, paddingVertical: SPACE.s2 + 2 },
  detail: { flex: 1, fontSize: FONT_SIZE.sm, lineHeight: 20, fontWeight: '600' },
});
