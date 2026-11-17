/**
 * TodayTaskCard — the one task card used on Today. The theme screen's preview renders this
 * same component, so what a person sees in the preview is exactly what the app shows.
 *
 * Once logged, the whole card takes the state colour (green ideal, blue fallback), so the list
 * fills with colour as the day goes on.
 */
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { StatusPill, MetaLine } from '@/features/task/TaskDetails';
import { FONT_SIZE, RADIUS, SPACE, useTheme } from '@/theme';
import { ChevronDown } from 'lucide-react-native';

import { Burst, cardSurface, isLogged, LogButtons, logStateVisual, PopIn, settledSurface, TaskIcon, type IconComponent } from '@/ui';
import type { ChipState } from '@/types';
import { Text } from '@/ui/AppText';

export interface TodayTaskCardProps {
  readonly name: string;
  readonly icon: IconComponent;
  readonly color?: string | null;
  readonly meta: readonly string[];
  readonly chip: ChipState | null;
  /** Logged, but the buttons are open again to change it. */
  readonly reopened?: boolean;
  readonly isOff?: boolean;
  readonly offLabel?: string;
  readonly idealHint?: string | null;
  readonly fallbackHint?: string | null;
  readonly onLog: (chip: ChipState) => void;
  readonly onToggleReopen: () => void;
  readonly onOpen?: () => void;
}

export function TodayTaskCard({ name, icon, color, meta, chip, reopened = false, isOff = false, offLabel = 'Off today', idealHint, fallbackHint, onLog, onToggleReopen, onOpen }: TodayTaskCardProps) {
  const t = useTheme();
  const logged = isLogged(chip);
  const showButtons = !isOff && (!logged || reopened);
  const v = logged && !isOff ? logStateVisual(t, chip) : null;
  const StateIcon = v?.icon;
  // Celebrate only the moment the ideal lands, never on first paint.
  const [burst, setBurst] = useState(0);
  const prevChip = useRef(chip);
  useEffect(() => {
    if (chip === 'done' && prevChip.current !== 'done') setBurst((n) => n + 1);
    prevChip.current = chip;
  }, [chip]);
  const head = (
    <>
      <TaskIcon icon={icon} color={color} muted={isOff} />
      <View style={styles.textCol}>
        <Text numberOfLines={1} style={[styles.name, { color: t.color.text }]}>
          {name}
        </Text>
        {v ? <Text style={[styles.status, { color: v.deep }]}>{v.doneLabel}</Text> : <MetaLine parts={meta} />}
      </View>
    </>
  );
  return (
    <PopIn trigger={v ? chip : null} from={0.97} style={[styles.card, v ? settledSurface(v.soft) : cardSurface(t)]}>
      <View style={styles.head}>
        {onOpen ? (
          <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`${name}, ${meta.join(', ')}. Opens the task`} style={styles.open}>
            {head}
          </Pressable>
        ) : (
          <View style={styles.open}>{head}</View>
        )}
        {isOff ? (
          <StatusPill label={offLabel} tone="off" />
        ) : v && StateIcon ? (
          <Pressable onPress={onToggleReopen} accessibilityRole="button" accessibilityLabel={`${name}, ${v.doneLabel}. Change`} accessibilityState={{ expanded: reopened }} hitSlop={8} style={styles.change}>
            <PopIn trigger={chip} style={[styles.tick, { backgroundColor: v.line }]}>
              <StateIcon size={18} color={t.color.iconOnSignal} />
              <Burst fire={burst} colors={[t.color.ideal, t.color.celebrationGold, t.accent.fill]} />
            </PopIn>
            <ChevronDown size={16} color={v.deep} />
          </Pressable>
        ) : null}
      </View>
      {showButtons ? <LogButtons value={chip} onChange={onLog} accessibilityLabel={name} idealHint={idealHint ?? undefined} fallbackHint={fallbackHint ?? undefined} /> : null}
    </PopIn>
  );
}

const styles = StyleSheet.create({
  card: { padding: SPACE.s3, gap: SPACE.s2 + 4 },
  head: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 },
  open: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 + 4 },
  textCol: { flex: 1, gap: 2 },
  name: { fontSize: FONT_SIZE.base, fontWeight: '700' },
  status: { fontSize: FONT_SIZE.sm, fontWeight: '800' },
  change: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s1, minHeight: 44 },
  tick: { width: 32, height: 32, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center' },
});
