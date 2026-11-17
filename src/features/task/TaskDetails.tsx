/**
 * TaskDetails — the ONE way a task's details are shown on a card or screen
 * (D13 + decision 22, option C).
 *
 *  - <MetaLine>: a single quiet middot line — schedule · importance · necessity.
 *    Unset values are simply left out.
 *  - <PlanTiles>: ideal and fallback as two tinted tiles side by side.
 *  - <StatusPill>: the only pills — live status (Due, Off today, One-time, As-needed).
 */
import { StyleSheet, View } from 'react-native';
import { Check, CheckCheck } from 'lucide-react-native';

import { importanceLabel, necessityLabel } from '@/features/browse/format';
import { FONT_SIZE, RADIUS, SPACE, useTheme } from '@/theme';
import type { Importance, Necessity, Step } from '@/types';
import { Text } from '@/ui/AppText';

export function metaParts(input: {
  readonly schedule?: string | null;
  readonly importance?: Importance | null;
  readonly necessity?: Necessity | null;
  readonly extra?: readonly (string | null | undefined)[];
  /** Cards: leave out the defaults (medium importance, recommended) so only what stands out shows. */
  readonly compact?: boolean;
}): string[] {
  const parts: (string | null | undefined)[] = [input.schedule];
  if (input.extra) parts.push(...input.extra);
  if (input.importance && !(input.compact && input.importance === 'med')) parts.push(`${importanceLabel(input.importance)} importance`);
  if (input.necessity && !(input.compact && input.necessity === 'recommended')) parts.push(necessityLabel(input.necessity));
  return parts.filter((p): p is string => !!p && p.length > 0);
}

export function MetaLine({ parts, numberOfLines = 1 }: { readonly parts: readonly string[]; readonly numberOfLines?: number }) {
  const t = useTheme();
  if (parts.length === 0) return null;
  return (
    <Text numberOfLines={numberOfLines} style={[styles.meta, { color: t.color.textMuted }]}>
      <Text style={[styles.metaLead, { color: t.color.text }]}>{parts[0]}</Text>
      {parts.length > 1 ? ` · ${parts.slice(1).join(' · ')}` : ''}
    </Text>
  );
}

/** "Full workout" or "Warm-up +2 more" from a step list. */
export function planSummary(steps: readonly Pick<Step, 'text'>[] | null | undefined): string | null {
  if (!steps || steps.length === 0) return null;
  const first = steps[0]!.text;
  return steps.length === 1 ? first : `${first} +${steps.length - 1} more`;
}

export interface PlanTilesProps {
  readonly ideal?: string | null;
  readonly fallback?: string | null;
  readonly numberOfLines?: number;
}

export function PlanTiles({ ideal, fallback, numberOfLines = 2 }: PlanTilesProps) {
  const t = useTheme();
  if (!ideal && !fallback) return null;
  return (
    <View style={styles.tiles}>
      {ideal ? (
        <View style={[styles.tile, { backgroundColor: t.color.idealSoft }]} accessible accessibilityLabel={`Ideal: ${ideal}`}>
          <View style={styles.tileHead}>
            <CheckCheck size={12} color={t.color.idealDeep} />
            <Text style={[styles.tileLabel, { color: t.color.idealDeep }]}>Ideal</Text>
          </View>
          <Text numberOfLines={numberOfLines} style={[styles.tileText, { color: t.color.text }]}>
            {ideal}
          </Text>
        </View>
      ) : null}
      {fallback ? (
        <View style={[styles.tile, { backgroundColor: t.color.fallbackSoft }]} accessible accessibilityLabel={`Fallback: ${fallback}`}>
          <View style={styles.tileHead}>
            <Check size={12} color={t.color.fallbackDeep} />
            <Text style={[styles.tileLabel, { color: t.color.fallbackDeep }]}>Fallback</Text>
          </View>
          <Text numberOfLines={numberOfLines} style={[styles.tileText, { color: t.color.text }]}>
            {fallback}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export type StatusTone = 'due' | 'off' | 'neutral' | 'done';

export function StatusPill({ label, tone = 'neutral' }: { readonly label: string; readonly tone?: StatusTone }) {
  const t = useTheme();
  const bg = tone === 'due' ? t.accent.soft : tone === 'off' ? t.color.offSoft : tone === 'done' ? t.color.idealSoft : t.color.surface;
  const fg = tone === 'due' ? t.accent.text : tone === 'off' ? t.color.offDeep : tone === 'done' ? t.color.idealDeep : t.color.textMuted;
  return (
    <View style={[styles.pill, { backgroundColor: bg }]} accessible accessibilityRole="text" accessibilityLabel={label}>
      <Text style={[styles.pillLabel, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  meta: { fontSize: FONT_SIZE.sm, lineHeight: 20 },
  metaLead: { fontWeight: '500' },
  tiles: { flexDirection: 'row', gap: SPACE.s2 },
  tile: { flex: 1, borderRadius: RADIUS.sm, paddingVertical: SPACE.s2, paddingHorizontal: SPACE.s2 + 2, gap: 2 },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s1 },
  tileLabel: { fontSize: FONT_SIZE.xs, fontWeight: '700' },
  tileText: { fontSize: FONT_SIZE.sm, lineHeight: 20 },
  pill: { borderRadius: RADIUS.pill, paddingVertical: 2, paddingHorizontal: SPACE.s2, alignSelf: 'flex-start' },
  pillLabel: { fontSize: FONT_SIZE.xs, fontWeight: '700' },
});
