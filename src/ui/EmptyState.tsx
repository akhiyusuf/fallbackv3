/** M0 kit — Fallback-custom `EmptyState`. Icon + headline + subcopy + optional primary action. */
import { StyleSheet, Text, View } from 'react-native';

import { SPACE, useTheme } from '@/theme';

import { Button } from './Button';
import type { IconComponent } from './icon';

export interface EmptyStateProps {
  readonly icon: IconComponent;
  readonly headline: string;
  readonly subcopy: string;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
  readonly actionVariant?: 'primary' | 'secondary';
  readonly testID?: string;
}

export function EmptyState({ icon: Icon, headline, subcopy, actionLabel, onAction, actionVariant = 'primary', testID }: EmptyStateProps) {
  const t = useTheme();
  return (
    <View style={styles.root} accessibilityRole="text" testID={testID}>
      <Icon size={40} color={t.color.textDim} accessibilityElementsHidden importantForAccessibility="no" />
      <Text accessibilityRole="header" style={[styles.headline, { color: t.color.text }]}>
        {headline}
      </Text>
      <Text style={[styles.subcopy, { color: t.color.textMuted }]}>{subcopy}</Text>
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} variant={actionVariant} accessibilityLabel={actionLabel} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', gap: SPACE.s2, padding: SPACE.s4 },
  headline: { fontSize: 20, fontWeight: '600', textAlign: 'center' },
  subcopy: { fontSize: 16, lineHeight: 24, textAlign: 'center' },
});
