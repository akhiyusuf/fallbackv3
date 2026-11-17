/** PlanCard — a selectable plan. The ONE plan-choice style, on the paywall and in Settings (D9). */
import { StyleSheet, View } from 'react-native';
import { Check } from 'lucide-react-native';

import { FONT_SIZE, RADIUS, SPACE, useTheme } from '@/theme';
import { Badge, Card } from '@/ui';
import { Text } from '@/ui/AppText';

export interface PlanCardProps {
  readonly selected: boolean;
  readonly onPress: () => void;
  readonly title: string;
  readonly price: string;
  readonly billed: string;
  readonly badge?: string;
  readonly note?: string;
  readonly disabled?: boolean;
}

export function PlanCard({ selected, onPress, title, price, billed, badge, note, disabled }: PlanCardProps) {
  const t = useTheme();
  return (
    <Card
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}${badge ? `, ${badge}` : ''}, ${price} ${billed}${selected ? ', selected' : ', not selected'}`}
      style={[styles.card, { borderColor: selected ? t.accent.fill : t.color.border, borderWidth: selected ? 2 : 1, padding: selected ? SPACE.s3 - 1 : SPACE.s3 }]}
    >
      <View style={styles.row}>
        <View style={[styles.radio, { borderColor: selected ? t.accent.fill : t.color.borderStrong, backgroundColor: selected ? t.accent.fill : 'transparent' }]}>
          {selected ? <Check size={14} color={t.accent.on} /> : null}
        </View>
        <View style={styles.text}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: t.color.text }]}>{title}</Text>
            {badge ? <Badge label={badge} tone="accent" /> : null}
          </View>
          <Text style={[styles.price, { color: t.color.text }]}>
            {price} <Text style={[styles.billed, { color: t.color.textMuted }]}>{billed}</Text>
          </Text>
          {note ? <Text style={[styles.note, { color: t.color.textMuted }]}>{note}</Text> : null}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {},
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 + 4 },
  radio: { width: 24, height: 24, borderRadius: RADIUS.pill, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 },
  title: { fontSize: FONT_SIZE.base, fontWeight: '700' },
  price: { fontSize: FONT_SIZE.base, fontWeight: '600' },
  billed: { fontSize: FONT_SIZE.sm, fontWeight: '400' },
  note: { fontSize: FONT_SIZE.xs },
});
