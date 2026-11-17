/**
 * TabSummary — the quiet headline at the top of a list tab: one mark, one fact, one line.
 * Deliberately not the solid card Today uses, so Today stays the only "main" headline. The
 * figure sits inside the ring; the text is ordinary size.
 */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

import { FONT_SIZE, RADIUS, SPACE, useTheme } from '@/theme';
import { ProgressRing } from './ProgressRing';
import { tintedSurface } from './surface';
import { Text } from '@/ui/AppText';

export type TabSummaryMark =
  | { readonly kind: 'ring'; readonly done: number; readonly total: number }
  | { readonly kind: 'date'; readonly top: string; readonly main: string }
  | { readonly kind: 'count'; readonly value: number };

export interface TabSummaryProps {
  readonly mark: TabSummaryMark;
  readonly title: string;
  readonly detail?: string;
  readonly onPress?: () => void;
  readonly right?: ReactNode;
  readonly testID?: string;
}

export function TabSummary({ mark, title, detail, onPress, right, testID }: TabSummaryProps) {
  const t = useTheme();
  const leading =
    mark.kind === 'ring' ? (
      <ProgressRing
        percent={mark.total > 0 ? (mark.done / mark.total) * 100 : 0}
        size={52}
        strokeWidth={6}
        label={`${mark.done}/${mark.total}`}
        trackColor={t.color.bgAlt}
        accessibilityLabel={`${mark.done} of ${mark.total}`}
      />
    ) : mark.kind === 'date' ? (
      <View style={[styles.tile, { backgroundColor: t.color.bgAlt }]}>
        <Text style={[styles.tileTop, { color: t.accent.text }]}>{mark.top}</Text>
        <Text style={[styles.tileMain, { color: t.color.text }]}>{mark.main}</Text>
      </View>
    ) : (
      <View style={[styles.tile, styles.round, { backgroundColor: t.color.bgAlt }]}>
        <Text style={[styles.tileMain, { color: t.color.text }]}>{mark.value}</Text>
      </View>
    );
  const body = (
    <>
      {leading}
      <View style={styles.text}>
        <Text numberOfLines={1} style={[styles.title, { color: t.color.text }]}>
          {title}
        </Text>
        {detail ? (
          <Text numberOfLines={2} style={[styles.detail, { color: t.color.text }]}>
            {detail}
          </Text>
        ) : null}
      </View>
      {right}
      {onPress ? <ChevronRight size={18} color={t.accent.text} /> : null}
    </>
  );
  const style = [styles.root, tintedSurface(t, t.accent.fill)];
  if (!onPress) {
    return (
      <View style={style} accessible accessibilityRole="text" accessibilityLabel={[title, detail].filter(Boolean).join('. ')} testID={testID}>
        {body}
      </View>
    );
  }
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={[title, detail].filter(Boolean).join('. ')} testID={testID} style={style}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 + 4, paddingVertical: SPACE.s2 + 4, paddingHorizontal: SPACE.s3 - 2 },
  text: { flex: 1, gap: 2 },
  title: { fontSize: FONT_SIZE.base, fontWeight: '800' },
  detail: { fontSize: FONT_SIZE.sm, lineHeight: 20 },
  tile: { width: 52, height: 52, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  round: { borderRadius: RADIUS.pill },
  tileTop: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  tileMain: { fontSize: FONT_SIZE.lg, lineHeight: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
