/**
 * M0 kit — Fallback-custom `AsNeededCard` (F27). Deliberately lean: no due-badge, no
 * cadence text, no heatmap, no Importance/Necessity — those never render here regardless
 * of what a caller passes, by construction, matching the design's "simplified detail"
 * framing (S10's "Other routines" section, S23's reference card).
 */
import { StyleSheet, Text, View } from 'react-native';

import { SPACE, useTheme } from '@/theme';

import { Button } from './Button';
import { Card } from './Card';
import type { IconComponent } from './icon';

export interface AsNeededCardProps {
  readonly name: string;
  readonly icon?: IconComponent;
  readonly lastUsedLabel?: string;
  readonly idealLabel?: string;
  readonly fallbackLabel?: string;
  readonly onPress?: () => void;
  readonly onLogUsedIt?: () => void;
  readonly logButtonLabel?: string;
  readonly accessibilityLabel?: string;
  readonly testID?: string;
}

export function AsNeededCard({
  name,
  icon: Icon,
  lastUsedLabel,
  idealLabel,
  fallbackLabel,
  onPress,
  onLogUsedIt,
  logButtonLabel = 'Log used it',
  accessibilityLabel,
  testID,
}: AsNeededCardProps) {
  const t = useTheme();
  return (
    <Card onPress={onPress} accessibilityLabel={accessibilityLabel ?? name} testID={testID}>
      <View style={styles.headerRow}>
        {Icon ? <Icon size={22} color={t.color.textMuted} /> : null}
        <Text style={[styles.name, { color: t.color.text }]}>{name}</Text>
      </View>
      {idealLabel ? <Text style={[styles.reference, { color: t.color.textMuted }]}>{idealLabel}</Text> : null}
      {fallbackLabel ? <Text style={[styles.reference, { color: t.color.textMuted }]}>{fallbackLabel}</Text> : null}
      <View style={styles.footerRow}>
        {onLogUsedIt ? <Button label={logButtonLabel} onPress={onLogUsedIt} variant="secondary" accessibilityLabel={logButtonLabel} /> : null}
        {lastUsedLabel ? <Text style={[styles.lastUsed, { color: t.color.textDim }]}>{lastUsedLabel}</Text> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 },
  name: { fontSize: 16, fontWeight: '600', flexShrink: 1 },
  reference: { fontSize: 14, lineHeight: 20 },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.s2, marginTop: SPACE.s1 },
  lastUsed: { fontSize: 13 },
});
