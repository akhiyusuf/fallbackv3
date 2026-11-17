/**
 * ListGroup / ListRow / SectionHeading — the grouped list (D7, D19).
 * A bold heading above ONE card; rows separated by hairlines; a row is
 * icon, label, muted value, chevron. The chevron is the only sign that a
 * row opens another screen.
 */
import { Children, Fragment, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

import { FONT_SIZE, HAIRLINE, MIN_TAP_TARGET, RADIUS, SPACE, useTheme } from '@/theme';
import { cardSurface } from './surface';
import type { IconComponent } from './icon';
import { Text } from '@/ui/AppText';

export function SectionHeading({ children, right }: { readonly children: string; readonly right?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={styles.headingRow}>
      <Text accessibilityRole="header" style={[styles.heading, { color: t.color.text }]}>
        {children}
      </Text>
      {right}
    </View>
  );
}

export interface ListGroupProps {
  readonly title?: string;
  readonly titleRight?: ReactNode;
  readonly footer?: string;
  readonly children: ReactNode;
  readonly testID?: string;
}

export function ListGroup({ title, titleRight, footer, children, testID }: ListGroupProps) {
  const t = useTheme();
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <View style={styles.group} testID={testID}>
      {title ? <SectionHeading right={titleRight}>{title}</SectionHeading> : null}
      <View style={[styles.card, cardSurface(t)]}>
        {rows.map((row, i) => (
          <Fragment key={i}>
            {i > 0 ? <View style={[styles.divider, { backgroundColor: t.color.border }]} /> : null}
            {row}
          </Fragment>
        ))}
      </View>
      {footer ? <Text style={[styles.footer, { color: t.color.textMuted }]}>{footer}</Text> : null}
    </View>
  );
}

export interface ListRowProps {
  readonly icon?: IconComponent;
  /** Custom leading node (e.g. a task icon circle) instead of `icon`. */
  readonly leading?: ReactNode;
  readonly label: string;
  readonly sublabel?: string;
  /** Muted value shown before the chevron. */
  readonly value?: string;
  readonly onPress?: () => void;
  /** Right accessory (a switch, a chip). Suppresses the chevron. */
  readonly right?: ReactNode;
  /** Force the chevron on/off. Defaults to "on when the row opens something". */
  readonly chevron?: boolean;
  readonly danger?: boolean;
  readonly disabled?: boolean;
  readonly accessibilityLabel?: string;
  readonly accessibilityHint?: string;
  readonly testID?: string;
}

export function ListRow({ icon: Icon, leading, label, sublabel, value, onPress, right, chevron, danger = false, disabled = false, accessibilityLabel, accessibilityHint, testID }: ListRowProps) {
  const t = useTheme();
  const showChevron = chevron ?? (!!onPress && !right);
  const labelColor = danger ? t.color.dangerDeep : t.color.text;
  const content = (
    <>
      {leading ??
        (Icon ? (
          <View style={[styles.iconTile, { backgroundColor: danger ? t.color.dangerSoft : t.accent.soft }]}>
            <Icon size={18} color={danger ? t.color.dangerDeep : t.accent.text} />
          </View>
        ) : null)}
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: labelColor }]}>{label}</Text>
        {sublabel ? (
          <Text numberOfLines={2} style={[styles.rowSub, { color: t.color.textMuted }]}>
            {sublabel}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text style={[styles.rowValue, { color: t.color.textMuted }]} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {right}
      {showChevron ? <ChevronRight size={18} color={t.color.textDim} /> : null}
    </>
  );
  if (!onPress) {
    return (
      <View style={[styles.row, disabled && styles.disabled]} testID={testID}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? [label, value, sublabel].filter(Boolean).join(', ')}
      accessibilityHint={accessibilityHint}
      testID={testID}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: t.color.surface }, disabled && styles.disabled]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.s2, minHeight: 28 },
  heading: { fontSize: FONT_SIZE.md, fontWeight: '800', flexShrink: 1 },
  group: { gap: SPACE.s2 },
  card: { overflow: 'hidden' },
  iconTile: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  divider: { height: HAIRLINE, marginLeft: SPACE.s3 },
  footer: { fontSize: FONT_SIZE.sm, lineHeight: 20, paddingHorizontal: SPACE.s1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 + 4, minHeight: MIN_TAP_TARGET + 8, paddingVertical: SPACE.s2 + 2, paddingHorizontal: SPACE.s3 },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { fontSize: FONT_SIZE.base, fontWeight: '600' },
  rowSub: { fontSize: FONT_SIZE.sm, lineHeight: 20 },
  rowValue: { fontSize: FONT_SIZE.sm, flexShrink: 1, maxWidth: '45%', textAlign: 'right' },
  disabled: { opacity: 0.5 },
});
