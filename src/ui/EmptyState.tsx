/**
 * EmptyState — a genuinely empty screen (D15): a small drawing in the theme's
 * colours, title, one muted line, one button. The round add button stays hidden until there is content.
 * It sits in the middle of whatever room it is given, and its parts keep fixed heights, so the
 * drawing, the words and the button land in the same place on every empty screen.
 * A section that is merely empty uses <EmptyLine> instead.
 */
import { StyleSheet, View } from 'react-native';

import { FONT_SIZE, RADIUS, SPACE, useTheme } from '@/theme';
import { Button } from './Button';
import { EmptyArt, type EmptyArtKind } from './EmptyArt';
import type { IconComponent } from './icon';
import { Text } from '@/ui/AppText';

export interface EmptyStateProps {
  readonly icon: IconComponent;
  /** Which drawing. Defaults to a tile carrying `icon`. */
  readonly art?: EmptyArtKind;
  /** Less vertical padding, for an empty section inside a screen that has other content. */
  readonly compact?: boolean;
  readonly headline: string;
  readonly subcopy: string;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
  readonly actionVariant?: 'primary' | 'secondary';
  readonly testID?: string;
}

export function EmptyState({ icon, art = 'tile', compact = false, headline, subcopy, actionLabel, onAction, actionVariant = 'primary', testID }: EmptyStateProps) {
  const t = useTheme();
  return (
    <View style={[styles.root, compact && styles.compact]} accessibilityRole="text" testID={testID}>
      <EmptyArt kind={art} icon={icon} />
      <Text accessibilityRole="header" numberOfLines={compact ? undefined : 1} adjustsFontSizeToFit={!compact} style={[styles.headline, { color: t.color.text }]}>
        {headline}
      </Text>
      <View style={compact ? undefined : styles.subcopyRoom}>
        <Text style={[styles.subcopy, { color: t.color.textMuted }]}>{subcopy}</Text>
      </View>
      {actionLabel && onAction ? (
        <View style={styles.action}>
          <Button label={actionLabel} onPress={onAction} variant={actionVariant} accessibilityLabel={actionLabel} />
        </View>
      ) : null}
    </View>
  );
}

/** One muted line for a section that has nothing in it right now. */
export function EmptyLine({ children }: { readonly children: string }) {
  const t = useTheme();
  return <Text style={[styles.line, { color: t.color.textMuted }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  root: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: SPACE.s2, paddingVertical: SPACE.s1, paddingHorizontal: SPACE.s4 },
  // Room for three lines, so a two-line and a three-line message leave the button in the same place.
  subcopyRoom: { minHeight: 72, justifyContent: 'center' },
  iconWrap: { width: 64, height: 64, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center', marginBottom: SPACE.s1 },
  compact: { flexGrow: 0, paddingVertical: SPACE.s3 },
  headline: { fontSize: FONT_SIZE.lg, fontWeight: '800', textAlign: 'center' },
  subcopy: { fontSize: FONT_SIZE.base, lineHeight: 24, textAlign: 'center' },
  action: { marginTop: SPACE.s2 },
  line: { fontSize: FONT_SIZE.sm, lineHeight: 20, paddingVertical: SPACE.s1 },
});
