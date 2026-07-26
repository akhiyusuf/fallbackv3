/**
 * M0 kit — Fallback-custom `InlineRetryBanner`. ARCHITECTURE §10 error pattern 1: a failed
 * read of a region (list, heatmap, chart, stat) replaces just that region; the rest of the
 * screen keeps working. Calm — never the danger token, never a full-screen red treatment.
 */
import { StyleSheet, Text, View } from 'react-native';

import { RADIUS, SPACE, useTheme } from '@/theme';

import { Button } from './Button';

export interface InlineRetryBannerProps {
  readonly message: string;
  readonly onRetry: () => void;
  readonly retryLabel?: string;
  readonly tone?: 'neutral' | 'warning';
  readonly testID?: string;
}

export function InlineRetryBanner({ message, onRetry, retryLabel = 'Retry', tone = 'neutral', testID }: InlineRetryBannerProps) {
  const t = useTheme();
  return (
    <View
      style={[styles.root, { backgroundColor: t.color.bgAlt, borderColor: tone === 'warning' ? t.color.borderStrong : t.color.border }]}
      accessibilityRole="alert"
      testID={testID}
    >
      <Text style={[styles.message, { color: t.color.textMuted }]}>{message}</Text>
      <Button label={retryLabel} onPress={onRetry} variant="ghost" accessibilityLabel={retryLabel} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { borderWidth: 1, borderRadius: RADIUS.md, padding: SPACE.s3, gap: SPACE.s2, alignItems: 'flex-start' },
  message: { fontSize: 16, lineHeight: 24 },
});
